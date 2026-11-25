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
  BarChart3,
  ChevronDown,
  PieChart as PieIcon,
  ShieldAlert,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
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
import { useAuthStore } from '../../stores/useXacThucStore';
import { Button } from '../../components/chung/NutBam';
import { Badge } from '../../components/chung/NhanTrangThai';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { SearchInput } from '../../components/chung/OTimKiem';
import { DepartmentSelect } from '../../components/chung/ChonDonVi';
import * as XLSX from 'xlsx';
import { departmentApi } from '../../api/phongBan.api';
import { DepartmentItem } from '../../types/index';
import { hasRole, normalizeRoleKey } from '../../utils/phanQuyen';
import {
  reportApi,
  AttendanceReportSummary,
  MonthlyReportResponse,
  ExportReportDataResponse,
  MonthlyUserReportItem,
} from '../../api/baoCao.api';

// =============================================================================
// FORMATTERS & CONSTANTS
// =============================================================================

const COLORS = {
  onTime: '#10b981', // emerald-500
  late: '#f59e0b', // amber-500
  early: '#f97316', // orange-500
  excused: '#3b82f6', // blue-500
  absent: '#f43f5e', // rose-500
  missingCheckout: '#9333ea', // purple-600
};

// Kiểm tra vai trò kỹ thuật Admin / BGH theo mã vai trò chuẩn
const isSystemAdminUser = (u: any): boolean => {
  if (!u) return false;
  const role = String(u.vai_tro_chinh || '').trim().toLowerCase();
  return role === 'admin' || role === 'bgh';
};

// Chống Excel Formula Injection ở client cho các ô chuỗi
const sanitizeExcelCell = (value: any): any => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

const sanitizeExcelRowClient = (row: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitizeExcelCell(v);
  }
  return out;
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

  const canViewAllDepts = useMemo(() => {
    if (!user) return false;
    const perms = Array.isArray((user as any).quyen_han) ? (user as any).quyen_han : [];
    return (
      perms.includes('CONG:XEM_TOAN_TRUONG') ||
      hasRole(user, ['admin', 'bgh', 'tccb', 'ke_toan'])
    );
  }, [user]);

  const scopedDepartments = useMemo(() => {
    if (canViewAllDepts || !user || departments.length === 0) return departments;

    const normUuid = (val: unknown): string => String(val || '').trim().toLowerCase();
    const leaderRoleSet = new Set([
      'truong_khoa',
      'pho_khoa',
      'truong_bo_mon',
      'pho_bo_mon',
      'truong_phong',
      'pho_phong',
    ]);
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const seedIds = new Set<string>();

    const primaryRole = normalizeRoleKey(user.vai_tro_chinh);
    const primaryDeptId = normUuid(
      typeof user.don_vi_chinh_id === 'object' && user.don_vi_chinh_id !== null
        ? (user.don_vi_chinh_id as any).id
        : user.don_vi_chinh_id
    );
    if (leaderRoleSet.has(primaryRole) && primaryDeptId) {
      seedIds.add(primaryDeptId);
    }

    if (Array.isArray(user.danh_sach_vai_tro)) {
      user.danh_sach_vai_tro.forEach((r: any) => {
        if (!r) return;
        const code = normalizeRoleKey(r.ma_vai_tro);
        if (!leaderRoleSet.has(code)) return;
        const tuNgay = r.tu_ngay ? String(r.tu_ngay).slice(0, 10) : '';
        const denNgay = r.den_ngay ? String(r.den_ngay).slice(0, 10) : '';
        if (tuNgay && tuNgay > todayIso) return;
        if (denNgay && denNgay < todayIso) return;
        const deptId = normUuid(
          typeof r.don_vi_id === 'object' && r.don_vi_id !== null
            ? r.don_vi_id.id
            : r.don_vi_id
        ) || primaryDeptId;
        if (deptId) seedIds.add(deptId);
      });
    }

    if (seedIds.size === 0 && primaryDeptId) {
      seedIds.add(primaryDeptId);
    }
    if (seedIds.size === 0) return [];

    // Mở rộng đệ quy toàn bộ bộ môn con thuộc các đơn vị quản lý
    const allowedIds = new Set<string>(seedIds);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const d of departments) {
        const deptKey = normUuid(d.id);
        const parentId = normUuid(
          typeof d.don_vi_cha_id === 'object' && d.don_vi_cha_id !== null
            ? (d.don_vi_cha_id as any).id
            : d.don_vi_cha_id
        );
        if (parentId && allowedIds.has(parentId) && deptKey && !allowedIds.has(deptKey)) {
          allowedIds.add(deptKey);
          expanded = true;
        }
      }
    }

    return departments.filter((d) => allowedIds.has(normUuid(d.id)));
  }, [canViewAllDepts, user, departments]);

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

      const deptParam = selectedDeptId && selectedDeptId !== 'ALL' ? selectedDeptId : undefined;
      const [summarySettled, monthlySettled, exportSettled] = await Promise.allSettled([
        reportApi.getAttendanceReport({
          don_vi_id: deptParam,
          tu_ngay: fromStr,
          den_ngay: toStr,
        }),
        reportApi.getMonthlyReport({
          thang: selectedMonth,
          nam: selectedYear,
          don_vi_id: deptParam,
          gioi_han: 1000,
        }),
        reportApi.getExportReportData({
          thang: selectedMonth,
          nam: selectedYear,
          don_vi_id: deptParam,
        }),
      ]);

      setSummaryData(summarySettled.status === 'fulfilled' ? summarySettled.value : null);
      setMonthlyData(monthlySettled.status === 'fulfilled' ? monthlySettled.value : null);
      setExportData(exportSettled.status === 'fulfilled' ? exportSettled.value : null);

      const firstErr = [summarySettled, monthlySettled, exportSettled].find((r) => r.status === 'rejected') as
        | PromiseRejectedResult
        | undefined;
      if (firstErr) {
        const msg = firstErr.reason?.response?.data?.message || 'Một số dữ liệu báo cáo chưa thể tải từ máy chủ.';
        toast.error(msg);
      }
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
        thieuCheckOutCount: 0,
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
      thieuCheckOutCount = 0,
      approvedLeaveDays,
    } = summaryData;

    const valid = onTimeCount + excusedAbsenceCount;
    const attendanceRate = totalShifts > 0 ? Math.round((valid / totalShifts) * 100) : 0;
    const lateRate = totalShifts > 0 ? Math.round(((lateCount + earlyLeaveCount) / totalShifts) * 100) : 0;

    return {
      totalShifts,
      onTimeCount,
      lateCount,
      earlyLeaveCount,
      absentCount,
      excusedAbsenceCount,
      thieuCheckOutCount,
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
      { name: 'Thiếu Check-out', value: summaryData.thieuCheckOutCount || 0, color: COLORS.missingCheckout },
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
      'Tỷ Lệ Chuyên Cần (%)': w.rate,
      'Đi Muộn (%)': w.lateRate || 0,
      'Tổng Số Lượt': w.total,
    }));
  }, [summaryData]);

  // Filtered staff list (loại bỏ hoàn toàn tài khoản Admin kỹ thuật khỏi thống kê chuyên cần)
  const filteredStaffList = useMemo(() => {
    const rawList = monthlyData?.report || exportData?.thong_ke_nhan_su || [];
    const nonAdminList = rawList.filter((item: any) => !isSystemAdminUser(item));
    if (!tableSearchKeyword.trim()) return nonAdminList;
    const kw = tableSearchKeyword.toLowerCase();
    return nonAdminList.filter((item: any) => {
      const name = (item.ho_ten || '').toLowerCase();
      const email = (item.email || '').toLowerCase();
      const code = (item.ma_can_bo || '').toLowerCase();
      const dept = (item.ten_phong_ban || '').toLowerCase();
      return name.includes(kw) || email.includes(kw) || code.includes(kw) || dept.includes(kw);
    });
  }, [monthlyData, exportData, tableSearchKeyword]);

  // Department Comparison Data (loại trừ Admin kỹ thuật)
  const departmentStats = useMemo(() => {
    const rawStaff = exportData?.thong_ke_nhan_su || [];
    const staff = rawStaff.filter((s: any) => !isSystemAdminUser(s));
    const deptMap: Record<string, { totalShifts: number; onTime: number; late: number; count: number }> = {};

    staff.forEach((s) => {
      const dName = s.ten_phong_ban || 'Chưa phân bổ';
      if (!deptMap[dName]) {
        deptMap[dName] = { totalShifts: 0, onTime: 0, late: 0, count: 0 };
      }
      deptMap[dName].totalShifts += s.tong_so_ca || 0;
      deptMap[dName].onTime += (s.so_lan_dung_gio || 0) + (s.so_lan_co_phep || 0);
      deptMap[dName].late += (s.so_lan_di_muon || 0) + (s.so_lan_ve_som || 0);
      deptMap[dName].count += 1;
    });

    return Object.entries(deptMap).map(([deptName, val]) => {
      const rate = val.totalShifts > 0 ? Math.round((val.onTime / val.totalShifts) * 100) : 0;
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
      const { tong_quan, nhat_ky_cham_cong, don_nghi_phep, thong_ke_nhan_su, thong_ke_theo_ngay } = exportData;

      // 1. SHEET 1: BÁO CÁO TỔNG QUAN
      const overviewRows = [
        ['BÁO CÁO TỔNG QUAN CHẤM CÔNG VÀ CHUYÊN CẦN'],
        ['Ứng dụng thị giác máy tính xây dựng hệ thống chấm công nhân sự - Đại Học Nguyễn Trãi (NTU)'],
        [],
        ['CHỈ TIÊU BÁO CÁO', 'GIÁ TRỊ'],
        ['Kỳ báo cáo', sanitizeExcelCell(tong_quan.ky_bao_cao || `Tháng ${selectedMonth}/${selectedYear}`)],
        ['Đơn vị áp dụng', sanitizeExcelCell(tong_quan.don_vi || 'Toàn Trường')],
        ['Tổng số nhân sự theo dõi', tong_quan.tong_so_nhan_su],
        ['Tổng số lượt ca làm việc / giảng dạy', tong_quan.tong_so_ca],
        ['Số ca đúng giờ', tong_quan.so_lan_dung_gio],
        ['Số ca đi muộn', tong_quan.so_lan_di_muon],
        ['Số ca về sớm', tong_quan.so_lan_ve_som],
        ['Số ca vắng mặt không phép', tong_quan.so_lan_vang_mat],
        ['Số ca nghỉ có phép hợp lệ', tong_quan.so_lan_co_phep],
        ['Số ca thiếu check-out', tong_quan.so_lan_thieu_check_out ?? 0],
        ['Tỷ lệ chuyên cần chung (%)', `${tong_quan.ty_le_chuyen_can}%`],
        ['Tổng số ngày nghỉ phép đã duyệt', `${tong_quan.so_ngay_nghi_phep_da_duyet} ngày`],
        ['Thời điểm trích xuất dữ liệu', sanitizeExcelCell(tong_quan.thoi_diem_xuat || new Date().toLocaleString('vi-VN'))],
      ];
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
      wsOverview['!cols'] = [{ wch: 38 }, { wch: 32 }];

      // 2. SHEET 2: BẢNG TỔNG HỢP CÔNG THEO NHÂN SỰ (Loại trừ Admin kỹ thuật)
      const cleanStaff = (thong_ke_nhan_su || []).filter((s: any) => !isSystemAdminUser(s));
      const staffRows = cleanStaff.map((s: any, idx: number) =>
        sanitizeExcelRowClient({
          'STT': idx + 1,
          'Mã Cán Bộ': s.ma_can_bo || '',
          'Họ Và Tên': s.ho_ten || '',
          'Email': s.email || '',
          'Khoa / Đơn Vị': s.ten_phong_ban || '',
          'Chức Vụ / Vai Trò': s.vai_tro_chinh || '',
          'Tổng Số Ca': s.tong_so_ca || 0,
          'Đúng Giờ': s.so_lan_dung_gio || 0,
          'Đi Muộn': s.so_lan_di_muon || 0,
          'Về Sớm': s.so_lan_ve_som || 0,
          'Vắng Mặt': s.so_lan_vang_mat || 0,
          'Nghỉ Phép': s.so_lan_co_phep || 0,
          'Thiếu Check-out': s.so_lan_thieu_check_out || 0,
          'Tỷ Lệ Chuyên Cần (%)': `${s.ty_le_chuyen_can || 0}%`,
        })
      );
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
        { wch: 15 },
        { wch: 20 },
      ];

      // 3. SHEET 3: CHI TIẾT NHẬT KÝ ĐIỂM DANH FACE ID
      const logsRows = (nhat_ky_cham_cong || []).map((l: any, idx: number) =>
        sanitizeExcelRowClient({
          'STT': l.stt || idx + 1,
          'Mã Cán Bộ': l.ma_can_bo || '',
          'Họ Và Tên': l.ho_ten || '',
          'Khoa / Đơn Vị': l.ten_phong_ban || '',
          'Ngày': l.ngay || '',
          'Thứ': l.thu || '',
          'Ca Làm Việc': l.ten_ca || '',
          'Khung Giờ Chuẩn': l.khung_gio_chuan || '',
          'Giờ Check-in': l.thoi_gian_vao || '',
          'Giờ Check-out': l.thoi_gian_ra || '',
          'Trạng Thái': l.trang_thai || '',
          'Độ Lệch Phút': l.so_phut_lech || 0,
          'Phương Thức': l.phuong_thuc || '',
          'Tọa Độ GPS': l.toa_do_gps || '',
          'Ghi Chú': l.ghi_chu || '',
        })
      );
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
      const leavesRows = (don_nghi_phep || []).map((r: any, idx: number) =>
        sanitizeExcelRowClient({
          'STT': r.stt || idx + 1,
          'Mã Đơn': r.ma_don || '',
          'Họ Và Tên': r.ho_ten || '',
          'Khoa / Đơn Vị': r.ten_phong_ban || '',
          'Loại Đơn': r.loai_don || '',
          'Từ Ngày': r.ngay_bat_dau || '',
          'Đến Ngày': r.ngay_ket_thuc || '',
          'Số Ngày': r.so_ngay ?? 0,
          'Lý Do': r.ly_do || '',
          'Trạng Thái': r.trang_thai || '',
          'Người Phê Duyệt': r.nguoi_duyet || '',
          'Ghi Chú Phê Duyệt': r.ghi_chu_duyet || '',
        })
      );
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
      const dailyRows = (thong_ke_theo_ngay || []).map((d: any, idx: number) =>
        sanitizeExcelRowClient({
          'STT': d.stt || idx + 1,
          'Ngày': d.ngay || '',
          'Thứ': d.thu || '',
          'Tổng Ca': d.tong_so_ca || 0,
          'Đúng Giờ': d.so_lan_dung_gio || 0,
          'Đi Muộn': d.so_lan_di_muon || 0,
          'Về Sớm': d.so_lan_ve_som || 0,
          'Vắng Mặt': d.so_lan_vang_mat || 0,
          'Nghỉ Phép': d.so_lan_co_phep || 0,
          'Thiếu Check-out': d.so_lan_thieu_check_out || 0,
          'Tỷ Lệ Đạt (%)': `${d.ty_le_chuyen_can || 0}%`,
        })
      );
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
    <div className="w-full space-y-4 pb-12 animate-fade-in">
      {/* 1. PAGE HEADER + ACTIONS */}
      <PageHeader
        title="Báo Cáo & Thống Kê Chuyên Sâu"
        subtitle={`Tháng ${String(selectedMonth).padStart(2, '0')}/${selectedYear} • Tổng hợp chuyên cần, đi muộn, nghỉ phép và xuất Excel 5 Sheets.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-brand-500 cursor-pointer"
              aria-label="Tháng báo cáo"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 px-3 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-brand-500 cursor-pointer"
              aria-label="Năm báo cáo"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>

            <div className="w-48 sm:w-56">
              <DepartmentSelect
                departments={scopedDepartments}
                value={selectedDeptId || 'ALL'}
                onChange={(val) => setSelectedDeptId(!val || val === 'ALL' ? '' : val)}
                placeholder="Chọn đơn vị..."
                allLabel={canViewAllDepts ? 'Toàn Trường (Tất cả)' : 'Tất cả đơn vị quản lý'}
                allowAll={true}
                size="sm"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchReports}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Làm mới
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />}
            >
              In báo cáo
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExportFullExcel}
              disabled={isExporting || isLoading}
              leftIcon={<FileSpreadsheet className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />}
            >
              {isExporting ? 'Đang xuất Excel...' : 'Xuất Excel (5 Sheets)'}
            </Button>
          </div>
        }
      />

      {/* 2. FLUX SEPARATE STATS ROW */}
      <CompactStatsBar
        items={[
          {
            label: 'Tỷ lệ chuyên cần',
            value: `${kpis.attendanceRate}%`,
            badge: `${kpis.onTimeCount}/${kpis.totalShifts} đúng giờ`,
            progress: Number(kpis.attendanceRate) || 0,
            tone: 'success',
          },
          { label: 'Tổng số ca', value: kpis.totalShifts, unit: 'lượt', subtext: 'Trong kỳ báo cáo', tone: 'brand' },
          { label: 'Đi muộn / Về sớm', value: kpis.lateCount + kpis.earlyLeaveCount, badge: `${kpis.lateRate}%`, subtext: 'Cần lưu ý kỷ luật', tone: 'warning' },
          { label: 'Vắng không phép', value: kpis.absentCount, badge: `${kpis.approvedLeaveDays}d phép`, subtext: 'Không có đơn duyệt', tone: 'danger' },
        ]}
      />

      {/* 3. MAIN REPORTS CARD: CHARTS + DETAILED TABS (FLUX STYLE) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* =====================================================================
            4. CHARTS SECTION (WEEKLY TREND & DONUT BREAKDOWN)
        ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800">
        {/* Weekly Trend Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 space-y-4">
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
                  <Bar dataKey="Tỷ Lệ Chuyên Cần (%)" fill={COLORS.onTime} radius={[6, 6, 0, 0]} />
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
        <div className="p-5 space-y-4">
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
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <span className="text-slate-600 dark:text-slate-400">Thiếu C/O:</span>
              <span className="font-bold">{kpis.thieuCheckOutCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. 3 TABBED DETAILED VIEWS
      ===================================================================== */}
      <div className="overflow-hidden">
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
            <SearchInput
              value={tableSearchKeyword}
              onChange={setTableSearchKeyword}
              debounceMs={180}
              placeholder="Tìm cán bộ trong bảng..."
              className="relative w-64"
            />
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
                  <th className="py-3 px-4 text-center text-purple-600">Thiếu C/O</th>
                  <th className="py-3 px-4">Tỷ Lệ Chuyên Cần</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-brand-600" />
                      Đang tổng hợp báo cáo chuyên cần cán bộ...
                    </td>
                  </tr>
                ) : filteredStaffList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400">
                      Không tìm thấy dữ liệu thống kê cán bộ trong tháng này.
                    </td>
                  </tr>
                ) : (
                  filteredStaffList.map((item: any, idx: number) => {
                    const fullName = item.ho_ten || 'Cán bộ';
                    const staffCode = item.ma_can_bo || '--';
                    const email = item.email || '';
                    const departmentName = item.ten_phong_ban || 'Chưa phân bổ';
                    const avatarUrl = item.anh_dai_dien || null;

                    const totalShifts = Number(item.tong_so_ca ?? 0);
                    const onTime = Number(item.so_lan_dung_gio ?? 0);
                    const late = Number(item.so_lan_di_muon ?? 0);
                    const early = Number(item.so_lan_ve_som ?? 0);
                    const excused = Number(item.so_lan_co_phep ?? 0);
                    const absent = Number(item.so_lan_vang_mat ?? 0);
                    const thieuCheckOut = Number(item.so_lan_thieu_check_out ?? 0);

                    const hasShifts = totalShifts > 0;
                    const calculatedRate = hasShifts ? Math.round(((onTime + excused) / totalShifts) * 100) : 0;
                    const rawRate = item.ty_le_chuyen_can;
                    const rate = rawRate !== undefined && hasShifts ? Number(rawRate) : calculatedRate;

                    return (
                      <tr key={item.nguoi_dung_id || idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        {/* Cán bộ kèm Avatar nhận diện */}
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              name={fullName}
                              avatarUrl={avatarUrl}
                              staffCode={staffCode}
                              size="sm"
                              shape="circle"
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

                        {/* Thiếu check-out */}
                        <td className="py-2.5 px-4 text-center font-bold text-purple-600">
                          {thieuCheckOut}
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
                  Dữ liệu trích xuất trực tiếp từ API `/api/bao-cao/du-lieu-xuat` theo CSDL v2.5.
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
                      <th className="py-2.5 px-3 text-center">Muộn</th>
                      <th className="py-2.5 px-3 text-center">Về Sớm</th>
                      <th className="py-2.5 px-3 text-center">Vắng</th>
                      <th className="py-2.5 px-3 text-center">Thiếu C/O</th>
                      <th className="py-2.5 px-3 text-center">Tỷ Lệ %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.thong_ke_nhan_su || []).filter((s: any) => !isSystemAdminUser(s)).slice(0, 15).map((s: any, sIdx: number) => (
                      <tr key={s.stt || sIdx}>
                        <td className="py-2 px-3">{sIdx + 1}</td>
                        <td className="py-2 px-3 font-mono">{s.ma_can_bo}</td>
                        <td className="py-2 px-3 font-semibold">{s.ho_ten}</td>
                        <td className="py-2 px-3">{s.ten_phong_ban}</td>
                        <td className="py-2 px-3">{s.vai_tro_chinh}</td>
                        <td className="py-2 px-3 text-center">{s.tong_so_ca}</td>
                        <td className="py-2 px-3 text-center text-emerald-600 font-bold">{s.so_lan_dung_gio}</td>
                        <td className="py-2 px-3 text-center text-amber-600 font-bold">{s.so_lan_di_muon ?? 0}</td>
                        <td className="py-2 px-3 text-center text-orange-600 font-bold">{s.so_lan_ve_som ?? 0}</td>
                        <td className="py-2 px-3 text-center text-rose-600 font-bold">{s.so_lan_vang_mat ?? 0}</td>
                        <td className="py-2 px-3 text-center text-purple-600 font-bold">{s.so_lan_thieu_check_out ?? 0}</td>
                        <td className="py-2 px-3 text-center font-bold">{s.ty_le_chuyen_can}%</td>
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
                      <th className="py-2.5 px-3">Chi Tiết</th>
                      <th className="py-2.5 px-3">Phương Thức</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.nhat_ky_cham_cong || []).slice(0, 15).map((l: any) => (
                      <tr key={l.stt}>
                        <td className="py-2 px-3">{l.stt}</td>
                        <td className="py-2 px-3 font-semibold">{l.ho_ten}</td>
                        <td className="py-2 px-3">{l.ngay}</td>
                        <td className="py-2 px-3">{l.ten_ca}</td>
                        <td className="py-2 px-3 font-mono">{l.thoi_gian_vao}</td>
                        <td className="py-2 px-3 font-mono">{l.thoi_gian_ra}</td>
                        <td className="py-2 px-3 font-bold">{l.trang_thai}</td>
                        <td className="py-2 px-3 text-slate-500">{l.so_phut_lech || l.ghi_chu || '—'}</td>
                        <td className="py-2 px-3">{l.phuong_thuc}</td>
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
                      <th className="py-2.5 px-3">Lý Do</th>
                      <th className="py-2.5 px-3">Người Duyệt</th>
                      <th className="py-2.5 px-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.don_nghi_phep || []).slice(0, 15).map((r: any) => (
                      <tr key={r.stt}>
                        <td className="py-2 px-3">{r.stt}</td>
                        <td className="py-2 px-3 font-mono">{r.ma_don}</td>
                        <td className="py-2 px-3 font-semibold">{r.ho_ten}</td>
                        <td className="py-2 px-3">{r.loai_don}</td>
                        <td className="py-2 px-3">{r.ngay_bat_dau}</td>
                        <td className="py-2 px-3">{r.ngay_ket_thuc}</td>
                        <td className="py-2 px-3 text-center font-bold">{r.so_ngay}</td>
                        <td className="py-2 px-3 max-w-[180px] truncate" title={r.ly_do || ''}>{r.ly_do || '—'}</td>
                        <td className="py-2 px-3">{r.nguoi_duyet || '—'}</td>
                        <td className="py-2 px-3 font-bold text-emerald-600">{r.trang_thai}</td>
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
                      <th className="py-2.5 px-3 text-center text-orange-600">Về Sớm</th>
                      <th className="py-2.5 px-3 text-center text-rose-600">Vắng</th>
                      <th className="py-2.5 px-3 text-center text-purple-600">Thiếu C/O</th>
                      <th className="py-2.5 px-3 text-center font-bold">Tỷ Lệ %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(exportData?.thong_ke_theo_ngay || []).slice(0, 15).map((d: any) => (
                      <tr key={d.stt}>
                        <td className="py-2 px-3">{d.stt}</td>
                        <td className="py-2 px-3 font-mono">{d.ngay}</td>
                        <td className="py-2 px-3">{d.thu}</td>
                        <td className="py-2 px-3 text-center">{d.tong_so_ca}</td>
                        <td className="py-2 px-3 text-center text-emerald-600 font-bold">{d.so_lan_dung_gio}</td>
                        <td className="py-2 px-3 text-center text-amber-600 font-bold">{d.so_lan_di_muon}</td>
                        <td className="py-2 px-3 text-center text-orange-600 font-bold">{d.so_lan_ve_som ?? 0}</td>
                        <td className="py-2 px-3 text-center text-rose-600 font-bold">{d.so_lan_vang_mat}</td>
                        <td className="py-2 px-3 text-center text-purple-600 font-bold">{d.so_lan_thieu_check_out ?? 0}</td>
                        <td className="py-2 px-3 text-center font-bold">{d.ty_le_chuyen_can}%</td>
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
    </div>
  );
};

export default Reports;
