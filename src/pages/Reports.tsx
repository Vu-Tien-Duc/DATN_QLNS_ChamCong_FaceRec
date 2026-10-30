import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  PieChart as PieIcon,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { UserAvatar } from '../components/ui/UserAvatar';
import { DepartmentSelect } from '../components/ui/DepartmentSelect';
import * as XLSX from 'xlsx';
import { departmentApi } from '../api/department.api';
import { DepartmentItem } from '../types';
import {
  reportApi,
  AttendanceReportSummary,
  MonthlyReportResponse,
  ExportReportDataResponse,
  MonthlyUserReportItem,
} from '../api/report.api';

// =============================================================================
// FORMATTERS & CONSTANTS
// =============================================================================

const COLORS = {
  onTime: '#10b981', // emerald-500
  late: '#f59e0b', // amber-500
  early: '#f97316', // orange-500
  excused: '#3b82f6', // blue-500
  absent: '#f43f5e', // rose-500
};

// Helper chuẩn nhận diện và loại trừ tài khoản Quản trị hệ thống IT & Lãnh đạo BGH khỏi báo cáo
const isSystemAdminUser = (u: any): boolean => {
  if (!u) return false;
  const role = String(u.role || u.user?.role || u.user?.primaryRole || u.vai_tro_chinh || '').toLowerCase();
  const code = String(u.staffCode || u.user?.staffCode || u.employeeId || u.ma_can_bo || '').toUpperCase();
  const email = String(u.email || u.user?.email || '').toLowerCase();
  const name = String(u.fullName || u.user?.fullName || u.ho_ten || '').toLowerCase();
  return (
    role === 'admin' ||
    role === 'bgh' ||
    role.includes('quản trị') ||
    role.includes('giám hiệu') ||
    code.startsWith('ADMIN') ||
    code.startsWith('BGH') ||
    email.startsWith('admin@') ||
    email.includes('daihocdtd@') ||
    email.startsWith('hieutruong@') ||
    name.includes('quản trị viên') ||
    name.includes('hiệu trưởng') ||
    name.includes('ban giám hiệu')
  );
};

// =============================================================================
// MAIN COMPONENT: Reports
// =============================================================================

export const Reports: React.FC = () => {
  const { user } = useAuthStore();

  // Filter States
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'staff-summary' | 'dept-comparison' | 'export-preview'>('staff-summary');

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Data States
  const [summaryData, setSummaryData] = useState<AttendanceReportSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReportResponse | null>(null);
  const [exportData, setExportData] = useState<ExportReportDataResponse | null>(null);

  // Search keyword in table
  const [tableSearchKeyword, setTableSearchKeyword] = useState<string>('');
  const [previewSheet, setPreviewSheet] = useState<'attendance' | 'leaves' | 'staff' | 'daily'>('staff');

  // ===========================================================================
  // LOAD DEPARTMENTS
  // ===========================================================================

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await departmentApi.getDepartmentsFlat();
        const depts = res.data || [];
        setDepartments(Array.isArray(depts) ? depts : []);
      } catch (err) {
        console.error('Lỗi khi tải danh sách phòng ban:', err);
      }
    };
    fetchDepts();
  }, []);

  // ===========================================================================
  // FETCH REPORTS DATA
  // ===========================================================================

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const fromStr = `${selectedYear}-${pad(selectedMonth)}-01`;
      const toStr = `${selectedYear}-${pad(selectedMonth)}-${pad(lastDay)}`;

      const [summaryRes, monthlyRes, exportRes] = await Promise.all([
        reportApi.getAttendanceReport({
          departmentId: selectedDeptId || undefined,
          from: fromStr,
          to: toStr,
        }).catch(() => null),
        reportApi.getMonthlyReport({
          month: selectedMonth,
          year: selectedYear,
          departmentId: selectedDeptId || undefined,
          limit: 200,
        }).catch(() => null),
        reportApi.getExportReportData({
          month: selectedMonth,
          year: selectedYear,
          departmentId: selectedDeptId || undefined,
        }).catch(() => null),
      ]);

      setSummaryData(summaryRes);
      setMonthlyData(monthlyRes);
      setExportData(exportRes);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu báo cáo:', err);
      toast.error(err.response?.data?.message || 'Không thể tải dữ liệu báo cáo thống kê.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedDeptId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ===========================================================================
  // COMPUTED STATS & CHARTS
  // ===========================================================================

  const kpis = useMemo(() => {
    if (!summaryData) {
      return {
        totalShifts: 0,
        onTimeCount: 0,
        lateCount: 0,
        earlyLeaveCount: 0,
        absentCount: 0,
        excusedAbsenceCount: 0,
        approvedLeaveDays: 0,
        attendanceRate: 0,
        lateRate: 0,
      };
    }

    const {
      totalRecords: totalShifts,
      onTimeCount,
      lateCount,
      earlyLeaveCount,
      absentCount,
      excusedAbsenceCount,
      approvedLeaveDays,
    } = summaryData;

    const valid = onTimeCount + excusedAbsenceCount;
    const attendanceRate = totalShifts > 0 ? Math.round((valid / totalShifts) * 100) : 100;
    const lateRate = totalShifts > 0 ? Math.round(((lateCount + earlyLeaveCount) / totalShifts) * 100) : 0;

    return {
      totalShifts,
      onTimeCount,
      lateCount,
      earlyLeaveCount,
      absentCount,
      excusedAbsenceCount,
      approvedLeaveDays,
      attendanceRate,
      lateRate,
    };
  }, [summaryData]);

  // Donut chart data for status distribution
  const pieData = useMemo(() => {
    if (!summaryData) return [];
    return [
      { name: 'Đúng Giờ', value: summaryData.onTimeCount, color: COLORS.onTime },
      { name: 'Đi Muộn', value: summaryData.lateCount, color: COLORS.late },
      { name: 'Về Sớm', value: summaryData.earlyLeaveCount, color: COLORS.early },
      { name: 'Nghỉ Có Phép', value: summaryData.excusedAbsenceCount, color: COLORS.excused },
      { name: 'Vắng Mặt', value: summaryData.absentCount, color: COLORS.absent },
    ].filter((item) => item.value > 0);
  }, [summaryData]);

  // Weekly Trend Chart Data
  const weeklyChartData = useMemo(() => {
    if (!summaryData?.weeklyTrend || summaryData.weeklyTrend.length === 0) {
      return [];
    }
    return summaryData.weeklyTrend.map((w) => ({
      name: w.label,
      subLabel: w.subLabel,
      'Tỷ Lệ Đúng Giờ (%)': w.rate,
      'Đi Muộn (%)': w.lateRate || 0,
      'Tổng Số Lượt': w.total,
    }));
  }, [summaryData]);

  // Filtered staff list (loại bỏ hoàn toàn tài khoản Admin kỹ thuật khỏi thống kê chuyên cần)
  const filteredStaffList = useMemo(() => {
    const rawList = monthlyData?.report || exportData?.staffStats || [];
    const nonAdminList = rawList.filter((item: any) => !isSystemAdminUser(item));
    if (!tableSearchKeyword.trim()) return nonAdminList;
    const kw = tableSearchKeyword.toLowerCase();
    return nonAdminList.filter((item: any) => {
      const name = (item.fullName || item.user?.fullName || '').toLowerCase();
      const email = (item.email || item.user?.email || '').toLowerCase();
      const code = (item.staffCode || item.user?.staffCode || item.employeeId || '').toLowerCase();
      const dept = (item.departmentName || item.user?.departmentName || '').toLowerCase();
      return name.includes(kw) || email.includes(kw) || code.includes(kw) || dept.includes(kw);
    });
  }, [monthlyData, exportData, tableSearchKeyword]);

  // Department Comparison Data (loại trừ Admin kỹ thuật)
  const departmentStats = useMemo(() => {
    const rawStaff = exportData?.staffStats || [];
    const staff = rawStaff.filter((s: any) => !isSystemAdminUser(s));
    const deptMap: Record<string, { totalShifts: number; onTime: number; late: number; count: number }> = {};

    staff.forEach((s) => {
      const dName = s.departmentName || 'Chưa phân bổ';
      if (!deptMap[dName]) {
        deptMap[dName] = { totalShifts: 0, onTime: 0, late: 0, count: 0 };
      }
      deptMap[dName].totalShifts += s.totalShifts || 0;
      deptMap[dName].onTime += (s.onTime || 0) + (s.excused || 0);
      deptMap[dName].late += (s.late || 0) + (s.early || 0);
      deptMap[dName].count += 1;
    });

    return Object.entries(deptMap).map(([deptName, val]) => {
      const rate = val.totalShifts > 0 ? Math.round((val.onTime / val.totalShifts) * 100) : 100;
      return {
        name: deptName,
        totalStaff: val.count,
        totalShifts: val.totalShifts,
        onTimeRate: rate,
        lateShifts: val.late,
      };
    }).sort((a, b) => b.onTimeRate - a.onTimeRate);
  }, [exportData]);

  // ===========================================================================
  // EXPORT EXCEL 5 SHEETS (MULTI-CSV / COMBINED CSV)
  // ===========================================================================

  const handleExportFullExcel = async () => {
    if (!exportData) {
      toast.error('Chưa có dữ liệu trích xuất báo cáo.');
      return;
    }

    setIsExporting(true);
    try {
      const { overview, attendanceLogs, leaveRequests, staffStats, dailyStats } = exportData;

      // 1. SHEET 1: BÁO CÁO TỔNG QUAN
      const overviewRows = [
        ['BÁO CÁO TỔNG QUAN CHẤM CÔNG VÀ CHUYÊN CẦN'],
        ['Hệ Thống Quản Lý Nhân Sự & Chấm Công Face Recognition (CSDL v2.5)'],
        [],
        ['CHỈ TIÊU BÁO CÁO', 'GIÁ TRỊ'],
        ['Kỳ báo cáo', overview.period || `Tháng ${selectedMonth}/${selectedYear}`],
        ['Đơn vị áp dụng', overview.department || 'Toàn Trường'],
        ['Tổng số nhân sự theo dõi', overview.totalUsers],
        ['Tổng số lượt ca làm việc / giảng dạy', overview.totalShifts],
        ['Số ca đúng giờ', overview.onTimeCount],
        ['Số ca đi muộn', overview.lateCount],
        ['Số ca về sớm', overview.earlyLeaveCount],
        ['Số ca vắng mặt không phép', overview.absentCount],
        ['Số ca nghỉ có phép hợp lệ', overview.excusedAbsenceCount],
        ['Tỷ lệ chuyên cần chung (%)', `${overview.overallAttendanceRate}%`],
        ['Tổng số ngày nghỉ phép đã duyệt', `${overview.approvedLeaveDays} ngày`],
        ['Thời điểm trích xuất dữ liệu', overview.exportedAt || new Date().toLocaleString('vi-VN')],
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
      wsOverview['!cols'] = [{ wch: 38 }, { wch: 32 }];

      // 2. SHEET 2: BẢNG TỔNG HỢP CÔNG THEO NHÂN SỰ (Loại trừ Admin kỹ thuật)
      const cleanStaff = (staffStats || []).filter((s: any) => !isSystemAdminUser(s));
      const staffRows = cleanStaff.map((s: any, idx: number) => ({
        'STT': idx + 1,
        'Mã Cán Bộ': s.employeeId || '',
        'Họ Và Tên': s.fullName || '',
        'Email': s.email || '',
        'Khoa / Đơn Vị': s.departmentName || '',
        'Chức Vụ / Vai Trò': s.role || '',
        'Tổng Số Ca': s.totalShifts || 0,
        'Đúng Giờ': s.onTime || 0,
        'Đi Muộn': s.late || 0,
        'Về Sớm': s.early || 0,
        'Vắng Mặt': s.absent || 0,
        'Nghỉ Phép': s.excused || 0,
        'Tỷ Lệ Chuyên Cần (%)': `${s.attendanceRate || 0}%`,
      }));
      const wsStaff = XLSX.utils.json_to_sheet(staffRows);
      wsStaff['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 28 },
        { wch: 26 },
        { wch: 20 },
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 20 },
      ];

      // 3. SHEET 3: CHI TIẾT NHẬT KÝ ĐIỂM DANH FACE ID
      const logsRows = (attendanceLogs || []).map((l: any, idx: number) => ({
        'STT': l.stt || idx + 1,
        'Mã Cán Bộ': l.employeeId || '',
        'Họ Và Tên': l.fullName || '',
        'Khoa / Đơn Vị': l.departmentName || '',
        'Ngày': l.date || '',
        'Thứ': l.weekday || '',
        'Ca Làm Việc': l.shiftName || '',
        'Khung Giờ Chuẩn': l.scheduledTime || '',
        'Giờ Check-in': l.checkInTime || '',
        'Giờ Check-out': l.checkOutTime || '',
        'Trạng Thái': l.status || '',
        'Độ Lệch Phút': l.lateEarlyMinutes || 0,
        'Phương Thức': l.method || '',
        'Tọa Độ GPS': l.gpsCoordinates || '',
        'Ghi Chú': l.notes || '',
      }));
      const wsLogs = XLSX.utils.json_to_sheet(logsRows);
      wsLogs['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 24 },
        { wch: 14 },
        { wch: 10 },
        { wch: 22 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        { wch: 26 },
        { wch: 22 },
      ];

      // 4. SHEET 4: CHI TIẾT ĐƠN NGHỈ PHÉP VÀ DẠY BÙ
      const leavesRows = (leaveRequests || []).map((r: any, idx: number) => ({
        'STT': r.stt || idx + 1,
        'Mã Đơn': r.requestId || '',
        'Họ Và Tên': r.fullName || '',
        'Khoa / Đơn Vị': r.departmentName || '',
        'Loại Đơn': r.leaveType || '',
        'Từ Ngày': r.startDate || '',
        'Đến Ngày': r.endDate || '',
        'Số Ngày': r.numberOfDays || 0,
        'Lý Do': r.reason || '',
        'Trạng Thái': r.status || '',
        'Người Phê Duyệt': r.approver || '',
        'Ghi Chú Phê Duyệt': r.approvalNote || '',
      }));
      const wsLeaves = XLSX.utils.json_to_sheet(leavesRows);
      wsLeaves['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 24 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 10 },
        { wch: 32 },
        { wch: 14 },
        { wch: 22 },
        { wch: 26 },
      ];

      // 5. SHEET 5: THỐNG KÊ CHUYÊN CẦN THEO TỪNG NGÀY TRONG THÁNG
      const dailyRows = (dailyStats || []).map((d: any, idx: number) => ({
        'STT': d.stt || idx + 1,
        'Ngày': d.date || '',
        'Thứ': d.weekday || '',
        'Tổng Ca': d.totalShifts || 0,
        'Đúng Giờ': d.onTime || 0,
        'Đi Muộn': d.late || 0,
        'Về Sớm': d.early || 0,
        'Vắng Mặt': d.absent || 0,
        'Nghỉ Phép': d.excused || 0,
        'Tỷ Lệ Đạt (%)': `${d.attendanceRate || 0}%`,
      }));
      const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
      wsDaily['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 16 },
      ];

      // TẠO WORKBOOK & ĐÍNH KÈM ĐỦ 5 SHEETS
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Tổng Quan');
      XLSX.utils.book_append_sheet(wb, wsStaff, 'Tổng Hợp Nhân Sự');
      XLSX.utils.book_append_sheet(wb, wsLogs, 'Nhật Ký FaceID');
      XLSX.utils.book_append_sheet(wb, wsLeaves, 'Đơn Phép & Dạy Bù');
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Chuyên Cần Theo Ngày');

      // Tự động tải xuống file .xlsx chuẩn Microsoft Excel
      XLSX.writeFile(wb, `Bao_Cao_Tong_Hop_Thang_${selectedMonth}_${selectedYear}.xlsx`);

      toast.success('Đã xuất báo cáo trích xuất Excel (.xlsx) 5 Sheets thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất báo cáo Excel:', err);
      toast.error('Lỗi khi đóng gói tệp báo cáo Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* =====================================================================
          1. HEADER CARD: BÁO CÁO & THỐNG KÊ
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          Báo Cáo & Thống Kê Chuyên Sâu
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
            Tháng {String(selectedMonth).padStart(2, '0')}/{selectedYear}
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Tổng hợp tỷ lệ chuyên cần, phân tích tần suất đi muộn, thống kê nghỉ phép và hỗ trợ trích xuất báo cáo Excel 5 Sheets chuẩn hóa phục vụ Ban Giám Hiệu và các Khoa.
        </p>
      </div>

      {/* =====================================================================
          2. FILTER CONTROL BAR (THÁNG, NĂM, KHOA / PHÒNG BAN)
      ===================================================================== */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Chọn Tháng */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tháng:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Năm */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          {/* Chọn Khoa / Bộ môn phân cấp */}
          <div className="w-full sm:w-auto min-w-[220px] sm:min-w-[270px]">
            <DepartmentSelect
              departments={departments}
              value={selectedDeptId}
              onChange={(val) => setSelectedDeptId(val || '')}
              placeholder="-- Chọn đơn vị trực thuộc --"
              allLabel="-- Toàn Trường (Tất cả đơn vị) --"
              allowAll={true}
              size="sm"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm Mới</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-500" />
            <span>In Báo Cáo</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportFullExcel}
            disabled={isExporting || isLoading}
            className="bg-brand-600 hover:bg-brand-500 text-white shadow-md text-xs font-medium flex items-center gap-1.5"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 text-emerald-300 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Đang Tạo File Excel...' : 'Xuất File Excel .xlsx (5 Sheets)'}</span>
          </Button>
        </div>
      </div>

      {/* =====================================================================
          3. 4 EXECUTIVE KPI SUMMARY CARDS
      ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Tỷ Lệ Chuyên Cần Chung */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Tỷ Lệ Chuyên Cần
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {kpis.attendanceRate}%
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
              Chuẩn Đào Tạo
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {kpis.onTimeCount} ca đúng giờ / {kpis.totalShifts} tổng ca
          </div>
        </div>

        {/* Card 2: Tổng Số Lượt Ca Hoạt Động */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng Số Ca Làm / Giảng
            </span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
              {kpis.totalShifts}
            </span>
            <span className="text-xs text-slate-400">lượt</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Bao gồm ca hành chính & ca giảng đường
          </div>
        </div>

        {/* Card 3: Đi Muộn & Về Sớm */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/40 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Đi Muộn / Về Sớm
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {kpis.lateCount + kpis.earlyLeaveCount}
            </span>
            <span className="text-xs text-slate-400">ca ({kpis.lateRate}%)</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {kpis.lateCount} đi muộn, {kpis.earlyLeaveCount} về sớm
          </div>
        </div>

        {/* Card 4: Vắng Mặt & Nghỉ Phép */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/40 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Vắng & Phép Năm
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
              {kpis.absentCount}
            </span>
            <span className="text-xs text-slate-400">vắng không phép</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {kpis.approvedLeaveDays} ngày nghỉ phép hợp lệ đã duyệt
          </div>
        </div>
      </div>

      {/* =====================================================================
          4. CHARTS SECTION (WEEKLY TREND & DONUT BREAKDOWN)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Trend Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Xu Hướng Chuyên Cần 4 Tuần Trong Tháng
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Đơn vị: Tỷ lệ %</span>
          </div>

          <div className="h-64 w-full">
            {weeklyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Tỷ Lệ Đúng Giờ (%)" fill={COLORS.onTime} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Đi Muộn (%)" fill={COLORS.late} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Chưa có dữ liệu xu hướng tuần trong tháng này.
              </div>
            )}
          </div>
        </div>

        {/* Donut Chart: Status Distribution (1 col) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Cơ Cấu Điểm Danh
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Toàn tháng</span>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-xs">Không có dữ liệu</div>
            )}
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-slate-900 dark:text-slate-100">
                {kpis.attendanceRate}%
              </span>
              <span className="text-[9px] uppercase font-bold text-slate-400">Chuyên Cần</span>
            </div>
          </div>

          {/* Legend items */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 dark:text-slate-400">Đúng giờ:</span>
              <span className="font-bold">{kpis.onTimeCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600 dark:text-slate-400">Đi muộn:</span>
              <span className="font-bold">{kpis.lateCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600 dark:text-slate-400">Nghỉ phép:</span>
              <span className="font-bold">{kpis.excusedAbsenceCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 dark:text-slate-400">Vắng mặt:</span>
              <span className="font-bold">{kpis.absentCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. 3 TABBED DETAILED VIEWS
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Tab Headers */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('staff-summary')}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                activeTab === 'staff-summary'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Bảng Tổng Hợp Theo Cán Bộ
            </button>
            <button
              onClick={() => setActiveTab('dept-comparison')}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                activeTab === 'dept-comparison'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              So Sánh Giữa Các Khoa / Đơn Vị
            </button>
            <button
              onClick={() => setActiveTab('export-preview')}
              className={`px-3.5 py-2 rounded-lg transition-all ${
                activeTab === 'export-preview'
                  ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Xem Trước Dữ Liệu Excel (5 Sheets)
            </button>
          </div>

          {activeTab === 'staff-summary' && (
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearchKeyword}
                onChange={(e) => setTableSearchKeyword(e.target.value)}
                placeholder="Tìm cán bộ trong bảng..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* ===================================================================
            TAB 1: BẢNG TỔNG HỢP THEO CÁN BỘ (STAFF SUMMARY)
        =================================================================== */}
        {activeTab === 'staff-summary' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Cán Bộ / Giảng Viên</th>
                  <th className="py-3 px-4">Khoa / Bộ Môn</th>
                  <th className="py-3 px-4 text-center">Tổng Ca</th>
                  <th className="py-3 px-4 text-center text-emerald-600">Đúng Giờ</th>
                  <th className="py-3 px-4 text-center text-amber-600">Đi Muộn</th>
                  <th className="py-3 px-4 text-center text-orange-600">Về Sớm</th>
                  <th className="py-3 px-4 text-center text-blue-600">Nghỉ Phép</th>
                  <th className="py-3 px-4 text-center text-rose-600">Vắng</th>
                  <th className="py-3 px-4">Tỷ Lệ Chuyên Cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-brand-600" />
                      Đang tổng hợp báo cáo chuyên cần cán bộ...
                    </td>
                  </tr>
                ) : filteredStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Không tìm thấy dữ liệu thống kê cán bộ trong tháng này.
                    </td>
                  </tr>
                ) : (
                  filteredStaffList.map((item: any, idx: number) => {
                    const fullName = item.fullName || item.user?.fullName || 'Cán bộ';
                    const staffCode = item.staffCode || item.user?.staffCode || item.employeeId || '--';
                    const email = item.email || item.user?.email || '';
                    const departmentName = item.departmentName || item.user?.departmentName || 'Chưa phân bổ';
                    const avatarUrl = item.avatar || item.user?.avatar || null;

                    const totalShifts = Number(item.totalShifts ?? item.totalWorkingDays ?? 0);
                    const onTime = Number(item.onTime ?? item.onTimeCount ?? 0);
                    const late = Number(item.late ?? item.lateCount ?? 0);
                    const early = Number(item.early ?? item.earlyLeaveCount ?? 0);
                    const excused = Number(item.excused ?? item.excusedCount ?? 0);
                    const absent = Number(item.absent ?? item.absentCount ?? 0);

                    const hasShifts = totalShifts > 0;
                    const calculatedRate = hasShifts ? Math.round(((onTime + excused) / totalShifts) * 100) : 0;
                    const rate = item.attendanceRate !== undefined && hasShifts ? Number(item.attendanceRate) : calculatedRate;

                    return (
                      <tr key={item.userId || item.user?.id || item.employeeId || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        {/* Cán bộ kèm Avatar nhận diện */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              name={fullName}
                              avatarUrl={avatarUrl}
                              staffCode={staffCode}
                              size="sm"
                              shape="rounded"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 truncate" title={fullName}>
                                {fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">
                                {staffCode}{email ? ` | ${email}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Khoa */}
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          {departmentName}
                        </td>

                        {/* Tổng Ca */}
                        <td className="py-2.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {totalShifts}
                        </td>

                        {/* Đúng giờ */}
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-600">
                          {onTime}
                        </td>

                        {/* Đi muộn */}
                        <td className="py-2.5 px-4 text-center font-bold text-amber-600">
                          {late}
                        </td>

                        {/* Về sớm */}
                        <td className="py-2.5 px-4 text-center font-bold text-orange-600">
                          {early}
                        </td>

                        {/* Nghỉ phép */}
                        <td className="py-2.5 px-4 text-center font-bold text-blue-600">
                          {excused}
                        </td>

                        {/* Vắng mặt */}
                        <td className="py-2.5 px-4 text-center font-bold text-rose-600">
                          {absent}
                        </td>

                        {/* Tỷ Lệ Chuyên Cần & Progress Bar */}
                        <td className="py-2.5 px-4 w-44">
                          {hasShifts ? (
                            <>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={`font-bold ${rate >= 90 ? 'text-emerald-600' : rate >= 75 ? 'text-amber-600' : 'text-rose-600'}`}>
                                  {rate}%
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {rate >= 90 ? 'Xuất sắc' : rate >= 75 ? 'Khá' : 'Cần lưu ý'}
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    rate >= 90 ? 'bg-emerald-500' : rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Chưa có ca</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================================================================
            TAB 2: SO SÁNH GIỮA CÁC KHOA / ĐƠN VỊ (DEPT COMPARISON)
        =================================================================== */}
        {activeTab === 'dept-comparison' && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Bảng Xếp Hạng Chuyên Cần Theo Khoa & Phòng Ban
                </h3>
                <p className="text-xs text-slate-500">
                  So sánh tỷ lệ chấp hành giờ giấc và số lượt vi phạm đi muộn giữa các đơn vị trong trường.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentStats.map((d, idx) => (
                <div
                  key={d.name}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={d.name}>
                      {d.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      Hạng #{idx + 1}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {d.onTimeRate}%
                      </span>
                      <span className="text-xs text-slate-400 ml-1">chuyên cần</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {d.totalStaff} nhân sự
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${d.onTimeRate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span>Tổng ca: <strong>{d.totalShifts}</strong></span>
                    <span className="text-amber-600">Muộn: <strong>{d.lateShifts}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: XEM TRƯỚC DỮ LIỆU EXCEL 5 SHEETS (EXPORT PREVIEW)
        =================================================================== */}
        {activeTab === 'export-preview' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Xem Trước Cấu Trúc File Excel 5 Sheets
                </h3>
                <p className="text-xs text-slate-500">
                  Dữ liệu trích xuất trực tiếp từ API `/api/reports/export-data` theo CSDL v2.5.
                </p>
              </div>

              {/* Sheet selector */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                <button
                  onClick={() => setPreviewSheet('staff')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    previewSheet === 'staff' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Sheet 2: Nhân Sự
                </button>
                <button
                  onClick={() => setPreviewSheet('attendance')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    previewSheet === 'attendance' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Sheet 3: Điểm Danh
                </button>
                <button
                  onClick={() => setPreviewSheet('leaves')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    previewSheet === 'leaves' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Sheet 4: Đơn Nghỉ
                </button>
                <button
                  onClick={() => setPreviewSheet('daily')}
                  className={`px-3 py-1 rounded-lg font-semibold ${
                    previewSheet === 'daily' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Sheet 5: Theo Ngày
                </button>
              </div>
            </div>

            {/* Sheet Content Preview */}
            <div className="overflow-x-auto max-h-96 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              {previewSheet === 'staff' && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã CB</th>
                      <th className="py-2.5 px-3">Họ Tên</th>
                      <th className="py-2.5 px-3">Khoa</th>
                      <th className="py-2.5 px-3">Vai Trò</th>
                      <th className="py-2.5 px-3 text-center">Tổng Ca</th>
                      <th className="py-2.5 px-3 text-center">Đúng Giờ</th>
                      <th className="py-2.5 px-3 text-center">Tỷ Lệ %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.staffStats || []).filter((s: any) => !isSystemAdminUser(s)).slice(0, 15).map((s: any, sIdx: number) => (
                      <tr key={s.stt || sIdx}>
                        <td className="py-2 px-3">{sIdx + 1}</td>
                        <td className="py-2 px-3 font-mono">{s.employeeId}</td>
                        <td className="py-2 px-3 font-semibold">{s.fullName}</td>
                        <td className="py-2 px-3">{s.departmentName}</td>
                        <td className="py-2 px-3">{s.role}</td>
                        <td className="py-2 px-3 text-center">{s.totalShifts}</td>
                        <td className="py-2 px-3 text-center text-emerald-600 font-bold">{s.onTime}</td>
                        <td className="py-2 px-3 text-center font-bold">{s.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewSheet === 'attendance' && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Cán Bộ</th>
                      <th className="py-2.5 px-3">Ngày</th>
                      <th className="py-2.5 px-3">Ca</th>
                      <th className="py-2.5 px-3">Check-in</th>
                      <th className="py-2.5 px-3">Check-out</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                      <th className="py-2.5 px-3">Phương Thức</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.attendanceLogs || []).slice(0, 15).map((l: any) => (
                      <tr key={l.stt}>
                        <td className="py-2 px-3">{l.stt}</td>
                        <td className="py-2 px-3 font-semibold">{l.fullName}</td>
                        <td className="py-2 px-3">{l.date}</td>
                        <td className="py-2 px-3">{l.shiftName}</td>
                        <td className="py-2 px-3 font-mono">{l.checkInTime}</td>
                        <td className="py-2 px-3 font-mono">{l.checkOutTime}</td>
                        <td className="py-2 px-3 font-bold">{l.status}</td>
                        <td className="py-2 px-3">{l.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewSheet === 'leaves' && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã Đơn</th>
                      <th className="py-2.5 px-3">Cán Bộ</th>
                      <th className="py-2.5 px-3">Loại Đơn</th>
                      <th className="py-2.5 px-3">Từ Ngày</th>
                      <th className="py-2.5 px-3">Đến Ngày</th>
                      <th className="py-2.5 px-3 text-center">Số Ngày</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.leaveRequests || []).slice(0, 15).map((r: any) => (
                      <tr key={r.stt}>
                        <td className="py-2 px-3">{r.stt}</td>
                        <td className="py-2 px-3 font-mono">{r.requestId}</td>
                        <td className="py-2 px-3 font-semibold">{r.fullName}</td>
                        <td className="py-2 px-3">{r.leaveType}</td>
                        <td className="py-2 px-3">{r.startDate}</td>
                        <td className="py-2 px-3">{r.endDate}</td>
                        <td className="py-2 px-3 text-center font-bold">{r.numberOfDays}</td>
                        <td className="py-2 px-3 font-bold text-emerald-600">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {previewSheet === 'daily' && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Ngày</th>
                      <th className="py-2.5 px-3">Thứ</th>
                      <th className="py-2.5 px-3 text-center">Tổng Ca</th>
                      <th className="py-2.5 px-3 text-center text-emerald-600">Đúng Giờ</th>
                      <th className="py-2.5 px-3 text-center text-amber-600">Đi Muộn</th>
                      <th className="py-2.5 px-3 text-center text-rose-600">Vắng</th>
                      <th className="py-2.5 px-3 text-center font-bold">Tỷ Lệ %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.dailyStats || []).slice(0, 15).map((d: any) => (
                      <tr key={d.stt}>
                        <td className="py-2 px-3">{d.stt}</td>
                        <td className="py-2 px-3 font-mono">{d.date}</td>
                        <td className="py-2 px-3">{d.weekday}</td>
                        <td className="py-2 px-3 text-center">{d.totalShifts}</td>
                        <td className="py-2 px-3 text-center text-emerald-600 font-bold">{d.onTime}</td>
                        <td className="py-2 px-3 text-center text-amber-600 font-bold">{d.late}</td>
                        <td className="py-2 px-3 text-center text-rose-600 font-bold">{d.absent}</td>
                        <td className="py-2 px-3 text-center font-bold">{d.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleExportFullExcel}
                disabled={isExporting}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Tải Toàn Bộ Gói Báo Cáo Excel .xlsx (5 Sheets)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
