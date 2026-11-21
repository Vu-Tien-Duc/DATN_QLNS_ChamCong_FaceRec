import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Camera,
  FilePlus,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Zap,
  RefreshCw,
  Calendar,
  Building2,
  AlertCircle,
  ScanFace,
  ChevronRight,
  Radio,
  FileText,
  Layers,
  Video,
  CheckCheck,
  MapPin,
  Search,
  MoreVertical,
  CalendarDays,
  ExternalLink,
  Award,
  BookOpen,
  FileSpreadsheet,
  Users,
  DollarSign,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DepartmentSelect, DepartmentItem } from '../../components/chung/ChonDonVi';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { Button } from '../../components/chung/NutBam';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { canPersonalCheckIn } from '../../utils/phanQuyen';
import { apiClient, extractArray } from '../../api/apiClient';
import { attendanceApi, AttendanceHistoryItem } from '../../api/chamCong.api';
import { leaveRequestApi, LeaveRequestData } from '../../api/donNghiPhep.api';
import { payrollApi } from '../../api/phieuLuong.api';
import { scheduleApi } from '../../api/lichTrinh.api';
import { useSocketEvent, useSocketStatus } from '../../api/socket';
import { FaceAttendanceScannerModal } from '../../components/sinhTracHoc/ModalQuetChamCong';
import { ScheduleItem } from '../../types/index';
import { getRoleLabel, hasRole } from '../../utils/phanQuyen';
import { formatVND, formatTimeVN, getInitials } from '../../utils/dinhDang';

// =============================================================================
// HELPER FORMATTERS
// =============================================================================

const STATUS_CONFIGS: Record<string, { label: string; dotCls: string; badgeCls: string }> = {
  on_time: {
    label: 'Đúng giờ',
    dotCls: 'bg-emerald-500',
    badgeCls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  },
  late: {
    label: 'Đi muộn',
    dotCls: 'bg-amber-500',
    badgeCls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  },
  early_leave: {
    label: 'Về sớm',
    dotCls: 'bg-orange-500',
    badgeCls: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
  },
  excused_absence: {
    label: 'Nghỉ có phép',
    dotCls: 'bg-indigo-500',
    badgeCls: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  },
  thieu_check_out: {
    label: 'Thiếu check-out',
    dotCls: 'bg-purple-500',
    badgeCls: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  },
  absent: {
    label: 'Vắng không phép',
    dotCls: 'bg-rose-500',
    badgeCls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  },
};

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

// Chống Excel Formula Injection ở client
const sanitizeExcelCell = (value: any): any => {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
};

// Duyệt cây đơn vị đa cấp từ danh sách phẳng
const getDescendantDepartmentIds = (rootDeptId: string, departments: DepartmentItem[]): Set<string> => {
  const result = new Set<string>([String(rootDeptId)]);
  let added = true;
  while (added) {
    added = false;
    for (const d of departments) {
      const id = String(d.id || '');
      const rawParent = d.don_vi_cha_id;
      const parentId = rawParent
        ? typeof rawParent === 'object' && rawParent !== null
          ? String((rawParent as any).id || '')
          : String(rawParent)
        : '';
      if (id && parentId && result.has(parentId) && !result.has(id)) {
        result.add(id);
        added = true;
      }
    }
  }
  return result;
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSocketConnected = useSocketStatus();

  // Loading & Modal states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [scannerMode, setScannerMode] = useState<'check-in' | 'check-out' | null>(null);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);

  // Real backend metrics
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [totalDepartments, setTotalDepartments] = useState<number>(0);
  const [pendingLeaveCount, setPendingLeaveCount] = useState<number>(0);
  const [pendingLeaveList, setPendingLeaveList] = useState<LeaveRequestData[]>([]);
  const [payrollNetSalary, setPayrollNetSalary] = useState<number>(0);
  const [payrollStatus, setPayrollStatus] = useState<string>('Dự thảo');
  const [campusInfo, setCampusInfo] = useState<{ name: string; radiusMeters: number } | null>(null);

  // Today schedules & events
  const [todaySchedules, setTodaySchedules] = useState<ScheduleItem[]>([]);

  // Live recent punches, today punches & 7-day logs
  const [recentPunches, setRecentPunches] = useState<AttendanceHistoryItem[]>([]);
  const [todayAttendanceRecords, setTodayAttendanceRecords] = useState<AttendanceHistoryItem[]>([]);
  const [sevenDaysRecords, setSevenDaysRecords] = useState<AttendanceHistoryItem[]>([]);
  const [tableFilter, setTableFilter] = useState<'ALL' | 'face_ai' | 'GPS'>('ALL');
  const [searchPunchKeyword, setSearchPunchKeyword] = useState<string>('');

  // Realtime clock
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('00:00:00');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setCurrentTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);

      const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayName = daysOfWeek[now.getDay()];
      setCurrentDateStr(`${dayName}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Today ISO Date string (YYYY-MM-DD)
  const todayDateIso = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // ===========================================================================
  // DATA FETCHING (100% REAL APIS)
  // ===========================================================================

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const canViewUsers = hasRole(user, ['admin', 'bgh', 'tccb', 'truong_khoa', 'pho_khoa']);
      const canViewLeaves = true;
      const canViewPayrollSummary = hasRole(user, ['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']);

      // 1. Tải danh sách nhân sự (theo phân quyền) & đơn vị & cấu hình khuôn viên
      const [usersRes, deptsRes, campusRes] = await Promise.all([
        canViewUsers
          ? apiClient.get('/nguoi-dung?gioi_han=500').catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } }),
        apiClient.get('/phong-ban?cay=false').catch(() => ({ data: { data: [] } })),
        attendanceApi.getCampusConfig().catch(() => null),
      ]);
      const rawUsersList = extractArray(usersRes.data);
      const usersList = rawUsersList.filter(
        (u: any) => !['admin', 'bgh'].includes(String(u.vai_tro_chinh || '').trim().toLowerCase())
      );
      const deptsList = extractArray(deptsRes.data);
      setAllUsersList(usersList);
      setDepartments(deptsList as DepartmentItem[]);
      setTotalDepartments(deptsList.length || 0);
      if (campusRes) {
        setCampusInfo({
          name: campusRes.name || 'Cơ sở chính Trường Đại học Nguyễn Trãi',
          radiusMeters: Number(campusRes.radiusMeters ?? 150),
        });
      }

      // 2. Tải dữ liệu chấm công hôm nay
      const todayRes = await attendanceApi
        .getAttendanceHistory({
          tu_ngay: todayDateIso,
          den_ngay: todayDateIso,
          gioi_han: 500,
        })
        .catch(() => ({ records: [], pagination: { total: 0, page: 1, limit: 500, totalPages: 1 } }));

      const todayRecords = todayRes.records || [];
      setTodayAttendanceRecords(todayRecords);

      // 3. Tải đơn nghỉ phép chờ duyệt
      if (canViewLeaves) {
        const leaveRes = await leaveRequestApi
          .getLeaveRequests({ trang_thai: 'pending' })
          .catch(() => ({ data: [] }));
        const requests = Array.isArray(leaveRes?.data)
          ? leaveRes.data
          : Array.isArray(leaveRes?.requests)
            ? leaveRes.requests
            : [];
        setPendingLeaveCount(requests.length);
        setPendingLeaveList(requests.slice(0, 3));
      } else {
        setPendingLeaveCount(0);
        setPendingLeaveList([]);
      }

      // 4. Tải quỹ lương tháng hiện tại
      if (canViewPayrollSummary) {
        const payrollRes = await payrollApi
          .getPayrollSummary(currentMonth, currentYear)
          .catch(() => ({ tong_thuc_linh: 0, da_khoa: false, da_khoa_mot_phan: false }));
        setPayrollNetSalary(payrollRes.tong_thuc_linh || 0);
        setPayrollStatus(
          payrollRes.da_khoa
            ? 'Đã khóa sổ'
            : payrollRes.da_khoa_mot_phan
              ? 'Khóa một phần'
              : 'Dự thảo'
        );
      } else {
        setPayrollNetSalary(0);
        setPayrollStatus('Không áp dụng');
      }

      // 5. Tải lịch sử quét sinh trắc học gần nhất
      const recentRes = await attendanceApi
        .getAttendanceHistory({ gioi_han: 100 })
        .catch(() => ({ records: [] }));
      setRecentPunches(recentRes.records || []);

      // 6. Tải lịch trình / thời khóa biểu hôm nay
      const schedRes = await scheduleApi
        .getTodaySchedules({ ngay: todayDateIso })
        .catch(() => ({ data: [] }));
      setTodaySchedules(extractArray<ScheduleItem>(schedRes.data || []));

      // 7. Tải dữ liệu chấm công 7 ngày gần nhất để dựng biểu đồ xu hướng theo bộ lọc đơn vị
      const pad = (n: number) => String(n).padStart(2, '0');
      const dStart = new Date();
      dStart.setDate(dStart.getDate() - 6);
      const startIso = `${dStart.getFullYear()}-${pad(dStart.getMonth() + 1)}-${pad(dStart.getDate())}`;

      const sevenDaysRes = await attendanceApi
        .getAttendanceHistory({
          tu_ngay: startIso,
          den_ngay: todayDateIso,
          gioi_han: 500,
        })
        .catch(() => ({ records: [] }));

      setSevenDaysRecords(sevenDaysRes.records || []);
    } catch (err: any) {
      console.error('Lỗi khi tải dữ liệu Dashboard:', err);
      toast.error('Không thể đồng bộ toàn bộ dữ liệu Dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [todayDateIso, user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // ===========================================================================
  // REALTIME SOCKET.IO LISTENERS (< 100ms UI UPDATE)
  // ===========================================================================
  useSocketEvent('attendance:new-punch', (punchData: any) => {
    const isCheckOut = punchData?.loai_quet === 'check_out';
    const punchUserName = punchData?.ho_ten || 'Cán bộ';
    toast.success(
      `Điểm danh: ${punchUserName} vừa quét ${
        isCheckOut ? 'tan ca' : 'vào ca'
      }!`,
      { icon: '⚡' }
    );
    fetchDashboardData();
  });

  useSocketEvent('attendance:update', () => {
    fetchDashboardData();
  });

  useSocketEvent('security:fraud-alert', (alertData: any) => {
    toast.error(`Cảnh báo an ninh: ${alertData?.message || 'Phát hiện vị trí chấm công ngoài vùng trường!'}`, {
      icon: '🚨',
      duration: 6000,
    });
  });

  useSocketEvent('leave:status-changed', () => {
    fetchDashboardData();
  });

  // Handler duyệt nhanh 1-click đơn nghỉ phép
  const handleQuickApproveLeave = async (requestId: string) => {
    setIsApprovingId(requestId);
    try {
      await leaveRequestApi.approveLeaveRequest(requestId, 'Phê duyệt nhanh qua Dashboard BGH.');
      toast.success('Đã phê duyệt đơn nghỉ phép thành công!');
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể phê duyệt đơn.');
    } finally {
      setIsApprovingId(null);
    }
  };

  // Helper lấy ID đơn vị của nhân sự
  const getEmpDepartmentId = (u: any): string => {
    if (u.don_vi_chinh_id) return String(u.don_vi_chinh_id);
    if (u.don_vi_chinh && typeof u.don_vi_chinh === 'object') return String(u.don_vi_chinh.id || '');
    return '';
  };

  // Helper lấy tên hiển thị đơn vị chính xác
  const getEmpDepartmentName = (u: any): string => {
    if (u.ten_phong_ban && String(u.ten_phong_ban).trim()) return String(u.ten_phong_ban).trim();
    if (u.don_vi_chinh && typeof u.don_vi_chinh === 'object' && u.don_vi_chinh.ten_phong_ban) {
      return String(u.don_vi_chinh.ten_phong_ban);
    }
    const deptId = getEmpDepartmentId(u);
    if (deptId && departments.length > 0) {
      const found = departments.find((d) => String(d.id) === deptId);
      if (found) return found.ten_phong_ban || 'Văn phòng / Ban';
    }
    return 'Văn phòng / Ban';
  };

  // Tập đơn vị con đa cấp theo bộ lọc Khoa/Viện
  const scopedDeptIds = useMemo(() => {
    if (departmentFilter === 'ALL') return null;
    return getDescendantDepartmentIds(departmentFilter, departments);
  }, [departmentFilter, departments]);

  // Lọc danh sách nhân viên áp dụng bộ lọc Khoa / Bộ môn đa cấp
  const filteredUsersList = useMemo(() => {
    if (!scopedDeptIds) return allUsersList;
    const selectedDept = departments.find((d) => String(d.id) === String(departmentFilter));
    const isBghFilter = selectedDept
      ? String(selectedDept.loai_don_vi || '').toLowerCase().includes('bgh') ||
        String(selectedDept.ten_phong_ban || '').toLowerCase().includes('giám hiệu')
      : false;

    return allUsersList.filter((u) => {
      const uDeptId = getEmpDepartmentId(u);
      if (isBghFilter) {
        return String(u.vai_tro_chinh || '').toLowerCase().includes('bgh') || scopedDeptIds.has(uDeptId);
      }
      if (uDeptId && scopedDeptIds.has(uDeptId)) return true;

      const roleList = Array.isArray(u.danh_sach_vai_tro) ? u.danh_sach_vai_tro : [];
      return roleList.some((r: any) => {
        const rDept = r.don_vi_id;
        if (!rDept) return false;
        const rId = typeof rDept === 'object' && rDept !== null ? String(rDept.id || '') : String(rDept);
        return scopedDeptIds.has(rId);
      });
    });
  }, [allUsersList, departmentFilter, departments, scopedDeptIds]);

  const totalStaff = filteredUsersList.length;

  const isLogInScopedDept = useCallback(
    (log: any) => {
      if (!scopedDeptIds) return true;
      const uObj = log?.nguoi_dung;
      if (uObj) {
        const uDept = getEmpDepartmentId(uObj);
        if (uDept && scopedDeptIds.has(uDept)) return true;
      }
      const uid = String(log?.nguoi_dung_id || uObj?.id || '');
      return filteredUsersList.some((u) => String(u.id) === uid);
    },
    [scopedDeptIds, filteredUsersList]
  );

  // Thống kê điểm danh hôm nay tính động theo bộ lọc đơn vị & đọc đúng trường chuẩn trang_thai
  const todayAttendanceStats = useMemo(() => {
    const scopedToday = todayAttendanceRecords.filter(isLogInScopedDept);
    let onTime = 0;
    let late = 0;
    let early = 0;
    let absent = 0;
    let excused = 0;
    let thieuCheckOut = 0;

    scopedToday.forEach((r: any) => {
      const st = r.trang_thai;
      if (st === 'on_time') onTime++;
      else if (st === 'late') late++;
      else if (st === 'early_leave') early++;
      else if (st === 'excused_absence') excused++;
      else if (st === 'absent') absent++;
      else if (st === 'thieu_check_out') thieuCheckOut++;
    });

    const present = onTime + late + early;
    const totalExpected = totalStaff > 0 ? totalStaff : present + absent + thieuCheckOut || 1;
    const calculatedRate = totalExpected > 0 ? Math.round((present / totalExpected) * 100) : 0;

    return {
      present,
      onTime,
      late,
      earlyLeave: early,
      absent,
      excused,
      thieuCheckOut,
      rate: Math.min(100, calculatedRate),
    };
  }, [todayAttendanceRecords, isLogInScopedDept, totalStaff]);

  // Biểu đồ xu hướng 7 ngày tính động theo bộ lọc đơn vị
  const weeklyTrendData = useMemo(() => {
    const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const past7Days: Array<{ day: string; dateStr: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dayLabel = i === 0 ? 'Hôm nay' : `${daysOfWeek[d.getDay()]} (${pad(d.getDate())})`;
      past7Days.push({ day: dayLabel, dateStr: dStr });
    }

    const scopedSevenDays = sevenDaysRecords.filter(isLogInScopedDept);
    return past7Days.map((item) => {
      const dayLogs = scopedSevenDays.filter((r: any) => r.ngay_cong === item.dateStr);
      const pCount = dayLogs.filter((r: any) => r.trang_thai === 'on_time').length;
      const lCount = dayLogs.filter((r: any) => r.trang_thai === 'late' || r.trang_thai === 'early_leave').length;
      const eCount = dayLogs.filter((r: any) => r.trang_thai === 'excused_absence').length;
      const aCount = dayLogs.filter((r: any) => r.trang_thai === 'absent').length;
      return {
        day: item.day,
        dateStr: item.dateStr,
        present: pCount,
        late: lCount,
        excused: eCount,
        absent: aCount,
      };
    });
  }, [sevenDaysRecords, isLogInScopedDept]);

  // Xuất Báo Cáo Chấm Công Sáng Nay ra file Excel (.xlsx)
  const handleExportMorningReportExcel = () => {
    if (!filteredUsersList.length) {
      toast.error('Không có dữ liệu nhân sự để xuất báo cáo.');
      return;
    }
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString('vi-VN');

      const dataRows = filteredUsersList.map((emp, i) => {
        const empId = String(emp.id);
        const deptName = getEmpDepartmentName(emp);

        // Tìm kiếm log chấm công hôm nay của cán bộ này
        const punchLog: any = todayAttendanceRecords.find((p: any) => {
          const pUserId = p.nguoi_dung_id || p.nguoi_dung?.id;
          return String(pUserId || '') === empId;
        });

        const hasIn = Boolean(punchLog?.thoi_gian_vao);
        const hasOut = Boolean(punchLog?.thoi_gian_ra);
        const checkInFormatted = hasIn ? formatTimeVN(punchLog?.thoi_gian_vao) : '--:--:--';
        const checkOutFormatted = hasOut ? formatTimeVN(punchLog?.thoi_gian_ra) : '--:--:--';
        const statusMeta = punchLog
          ? STATUS_CONFIGS[punchLog.trang_thai] || { label: 'Có mặt' }
          : { label: 'Chưa check-in' };

        const firstPunch = punchLog?.luot_quet?.[0];
        const rawMethod = String(firstPunch?.phuong_thuc || '').toLowerCase();
        const methodStr = punchLog
          ? rawMethod.includes('gps')
            ? 'Mobile GPS'
            : rawMethod.includes('qr')
              ? 'Mã QR động'
              : rawMethod.includes('thu_cong') || rawMethod.includes('manual')
                ? 'Thủ công (Admin)'
                : 'Face AI Kiosk'
          : '--';

        return {
          'STT': i + 1,
          'Mã Cán Bộ': sanitizeExcelCell(emp.ma_can_bo || '--'),
          'Họ Và Tên': sanitizeExcelCell(emp.ho_ten || '--'),
          'Khoa / Bộ Môn': sanitizeExcelCell(deptName),
          'Chức Vụ': sanitizeExcelCell(emp.chuc_vu || 'Giảng viên'),
          'Ngày Điểm Danh': dateStr,
          'Giờ Check-in': checkInFormatted,
          'Giờ Check-out': checkOutFormatted,
          'Trạng Thái Sáng Nay': statusMeta.label,
          'Phương Thức Xác Thực': methodStr,
          'Độ Tin Cậy AI': firstPunch?.do_tin_cay_ai ? `${Number(firstPunch.do_tin_cay_ai).toFixed(2)} cos` : '--',
          'Face ID': emp.da_dang_ky_face ? 'Đã kích hoạt' : 'Chưa đăng ký',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 28 },
        { wch: 18 },
        { wch: 16 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Sáng Nay');

      const fileName = `Bao_Cao_Cham_Cong_Sang_Nay_${todayDateIso}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Báo cáo chấm công sáng nay (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Báo cáo sáng nay:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  // Filtered live punch list
  const filteredPunches = useMemo(() => {
    return recentPunches.filter((item: any) => {
      const rawMethod = String(item.luot_quet?.[0]?.phuong_thuc || '').toLowerCase();
      const isGps = rawMethod.includes('gps');
      const isFace = rawMethod.includes('face') || (!rawMethod && Boolean(item.thoi_gian_vao));

      // Filter by device type
      if (tableFilter === 'face_ai' && !isFace) return false;
      if (tableFilter === 'GPS' && !isGps) return false;

      // Filter by Department (đa cấp)
      if (scopedDeptIds) {
        if (!isLogInScopedDept(item)) return false;
      }

      // Filter by keyword
      if (searchPunchKeyword.trim()) {
        const kw = searchPunchKeyword.toLowerCase().trim();
        const userObj = item.nguoi_dung;
        const name = (userObj?.ho_ten || '').toLowerCase();
        const code = (userObj?.ma_can_bo || '').toLowerCase();
        const dept = (userObj?.don_vi_chinh?.ten_phong_ban || '').toLowerCase();
        if (!name.includes(kw) && !code.includes(kw) && !dept.includes(kw)) return false;
      }

      return true;
    });
  }, [recentPunches, tableFilter, searchPunchKeyword, departmentFilter, departments]);

  // Donut chart calculations (100% REAL, bao gồm đủ các trạng thái)
  const lateAndEarlyToday = todayAttendanceStats.late + todayAttendanceStats.earlyLeave;
  const totalRecordsToday =
    todayAttendanceStats.present + todayAttendanceStats.absent + todayAttendanceStats.excused + todayAttendanceStats.thieuCheckOut;
  const onTimePct = totalRecordsToday > 0 ? Math.round((todayAttendanceStats.onTime / totalRecordsToday) * 100) : 0;
  const latePct = totalRecordsToday > 0 ? Math.round((lateAndEarlyToday / totalRecordsToday) * 100) : 0;
  const excusedPct = totalRecordsToday > 0 ? Math.round((todayAttendanceStats.excused / totalRecordsToday) * 100) : 0;
  const absentPct = totalRecordsToday > 0 ? Math.round((todayAttendanceStats.absent / totalRecordsToday) * 100) : 0;
  const missingCoPct = totalRecordsToday > 0 ? Math.round((todayAttendanceStats.thieuCheckOut / totalRecordsToday) * 100) : 0;

  // Donut SVG circumference calculation (r = 38 => circumference = 2 * PI * 38 = 238.76)
  const circumference = 238.76;
  const strokeOnTime = totalRecordsToday > 0 ? (onTimePct / 100) * circumference : 0;
  const strokeLate = totalRecordsToday > 0 ? (latePct / 100) * circumference : 0;
  const strokeExcused = totalRecordsToday > 0 ? (excusedPct / 100) * circumference : 0;
  const strokeAbsent = totalRecordsToday > 0 ? (absentPct / 100) * circumference : 0;

  return (
    <div className="space-y-4">
      {/* =====================================================================
          1. PAGE HEADER & ACTIONS
      ===================================================================== */}
      <PageHeader
        title="Bảng Điều Khiển Giám Sát"
        subtitle="Theo dõi chấm công nhận diện khuôn mặt, đơn từ và lịch trình toàn trường."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-52">
              <DepartmentSelect
                departments={departments}
                value={departmentFilter}
                onChange={(val) => setDepartmentFilter(val)}
                allowAll={true}
                allLabel="Toàn trường (Tất cả đơn vị)"
                placeholder="Lọc theo Khoa / Viện..."
                size="sm"
              />
            </div>

            <Button
              onClick={handleExportMorningReportExcel}
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              type="button"
              title="Xuất danh sách điểm danh sáng nay ra file Excel (.xlsx)"
            >
              Xuất sáng nay
            </Button>

            <Button
              onClick={() => navigate('/don-nghi-phep')}
              variant="outline"
              size="sm"
              leftIcon={<CheckCheck className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
              type="button"
            >
              Nộp đơn phép
            </Button>

            <Button
              onClick={() => setScannerMode('check-in')}
              variant="primary"
              size="sm"
              leftIcon={<Camera className="w-3.5 h-3.5" />}
              type="button"
            >
              Điểm danh Face ID
            </Button>
          </div>
        }
      />

      {/* =====================================================================
          FLUX HERO CARD: GOOD MORNING BANNER + 4 EMBEDDED METRICS
      ===================================================================== */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 p-6 sm:p-7 text-white shadow-md shadow-indigo-500/15">
        <div className="relative z-10 flex flex-col justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-indigo-100 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Hệ thống Nhân sự & Điểm danh Thông minh NTU</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {(() => {
                  const hour = new Date().getHours();
                  if (hour < 12) return 'Chào buổi sáng';
                  if (hour < 18) return 'Chào buổi chiều';
                  return 'Chào buổi tối';
                })()}
                , {user?.ho_ten || 'Quý Thầy/Cô'}!
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100/90 mt-1">
                {currentDateStr} • {currentTimeStr} — Chúc Thầy/Cô một ngày làm việc và giảng dạy hiệu quả.
              </p>
            </div>

            {canPersonalCheckIn(user) && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setScannerMode('check-in')}
                  type="button"
                  className="h-9 px-4 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold shadow-sm inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span>Điểm danh Face ID</span>
                </button>
                <button
                  onClick={() => navigate('/don-nghi-phep')}
                  type="button"
                  className="h-9 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 backdrop-blur-sm text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FilePlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Nộp đơn phép</span>
                </button>
              </div>
            )}
          </div>

          {/* 4 Metric Cards inside Hero Banner (Flux Style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-100">
                <span>Tổng nhân sự</span>
                <Users className="w-4 h-4 text-indigo-200" />
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
                  {totalStaff}
                </div>
                <div className="text-[11px] text-indigo-200 mt-1">
                  {totalDepartments} khoa & phòng ban
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-100">
                <span>Tỷ lệ đi làm</span>
                <Clock className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-300">
                  {todayAttendanceStats.rate}%
                </div>
                <div className="text-[11px] text-indigo-200 mt-1">
                  {todayAttendanceStats.onTime} đúng giờ • {todayAttendanceStats.late} muộn
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-100">
                <span>Đơn chờ duyệt</span>
                <FileText className="w-4 h-4 text-amber-300" />
              </div>
              <div className="mt-2">
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-amber-300">
                  {String(pendingLeaveCount).padStart(2, '0')}
                </div>
                <div className="text-[11px] text-indigo-200 mt-1">
                  Cần trưởng đơn vị duyệt
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-100">
                <span>Quỹ lương T{new Date().getMonth() + 1}</span>
                <DollarSign className="w-4 h-4 text-indigo-200" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight truncate">
                  {payrollNetSalary > 0 ? formatVND(payrollNetSalary) : '0 đ'}
                </div>
                <div className="text-[11px] text-indigo-200 mt-1 truncate">
                  Trạng thái: {payrollStatus}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-900/30 blur-2xl" />
      </section>

      {/* =====================================================================
          2. UNIFIED OVERVIEW TOP CARD: KPI STRIP + CHARTS
      ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">

      {/* =====================================================================
          3. ANALYTICS & CHARTS (60% / 40% - 12 COLUMNS GRID)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800">
        {/* Left (7 cols): Xu Hướng Chấm Công 7 Ngày Gần Nhất */}
        <div className="lg:col-span-7 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Xu Hướng Chấm Công 7 Ngày Gần Nhất
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Biểu đồ tổng hợp trạng thái điểm danh nhân sự giảng viên toàn viện
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {(() => {
                    const m = new Date().getMonth() + 1;
                    const y = new Date().getFullYear();
                    const academicStart = m >= 8 ? y : y - 1;
                    const hk = m >= 8 ? 'Học kỳ 1' : m <= 5 ? 'Học kỳ 2' : 'Học kỳ Hè';
                    return `${hk} (${academicStart}-${academicStart + 1})`;
                  })()}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center gap-1 border border-indigo-200 dark:border-indigo-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                  Live Data
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mb-4 text-xs font-medium">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded bg-brand-600"></span>
                <span>Đúng giờ</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded bg-slate-500"></span>
                <span>Đi muộn (cho phép)</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded bg-indigo-600"></span>
                <span>Nghỉ có phép</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="w-3 h-3 rounded bg-rose-600"></span>
                <span>Vắng không phép</span>
              </div>
            </div>

            {/* SVG Grouped / Stacked Bar Chart */}
            {(() => {
              const maxDayTotal = Math.max(
                4,
                ...weeklyTrendData.map((d) => d.present + d.late + d.excused + d.absent)
              );
              const yAxisTop = Math.ceil(maxDayTotal / 4) * 4;
              const chartHeight = 190;
              return (
                <div className="w-full h-64 relative mt-2">
                  <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 650 240">
                    {/* Horizontal Gridlines */}
                    <line className="text-slate-200 dark:text-slate-800" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="630" y1="20" y2="20" />
                    <text fill="#94A3B8" fontFamily="Inter" fontSize="10" textAnchor="end" x="30" y="24">{yAxisTop}</text>
                    <line className="text-slate-200 dark:text-slate-800" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="630" y1="67.5" y2="67.5" />
                    <text fill="#94A3B8" fontFamily="Inter" fontSize="10" textAnchor="end" x="30" y="71.5">{Math.round((yAxisTop * 3) / 4)}</text>
                    <line className="text-slate-200 dark:text-slate-800" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="630" y1="115" y2="115" />
                    <text fill="#94A3B8" fontFamily="Inter" fontSize="10" textAnchor="end" x="30" y="119">{Math.round(yAxisTop / 2)}</text>
                    <line className="text-slate-200 dark:text-slate-800" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="630" y1="162.5" y2="162.5" />
                    <text fill="#94A3B8" fontFamily="Inter" fontSize="10" textAnchor="end" x="30" y="166.5">{Math.round(yAxisTop / 4)}</text>
                    <line className="text-slate-300 dark:text-slate-700" stroke="currentColor" strokeWidth="1" x1="40" x2="630" y1="210" y2="210" />

                    {/* Bars for 6 days + Today (100% REAL) */}
                    {weeklyTrendData.map((dItem, idx) => {
                      const xOffset = 65 + idx * 80;
                      const isToday = idx === 6;

                      const hPresent = (dItem.present / yAxisTop) * chartHeight;
                      const yPresent = 210 - hPresent;

                      const hLate = (dItem.late / yAxisTop) * chartHeight;
                      const yLate = yPresent - hLate;

                      const hExcused = (dItem.excused / yAxisTop) * chartHeight;
                      const yExcused = yLate - hExcused;

                      const hAbsent = (dItem.absent / yAxisTop) * chartHeight;
                      const yAbsent = yExcused - hAbsent;

                      return (
                        <g key={idx} transform={`translate(${xOffset}, 0)`}>
                          {isToday && (
                            <rect className="fill-brand-50 dark:fill-brand-950/50" height="204" opacity="0.8" rx="8" width="40" x="-6" y="10" />
                          )}
                          {hPresent > 0 && <rect fill="rgb(var(--brand-600))" height={hPresent} rx="4" width="28" x="0" y={yPresent} />}
                          {hLate > 0 && <rect fill="#64748B" height={hLate} rx="2" width="28" x="0" y={yLate} />}
                          {hExcused > 0 && <rect fill="rgb(var(--brand-400))" height={hExcused} rx="2" width="28" x="0" y={yExcused} />}
                          {hAbsent > 0 && <rect fill="#F43F5E" height={hAbsent} rx="2" width="28" x="0" y={yAbsent} />}
                          <text
                            fill={isToday ? 'rgb(var(--brand-600))' : '#64748B'}
                            fontFamily="Inter"
                            fontSize="11"
                            fontWeight={isToday ? '700' : '500'}
                            textAnchor="middle"
                            x="14"
                            y="226"
                          >
                            {dItem.day}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}
          </div>

          <div className="mt-5 pt-3 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 rounded-xl flex items-center justify-between border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                Tỷ lệ điểm danh hôm nay đạt{' '}
                <strong className="font-bold text-indigo-600 dark:text-indigo-400">
                  {todayAttendanceStats.rate}%
                </strong>{' '}
                ({todayAttendanceStats.present} lượt có mặt • {todayAttendanceStats.late + todayAttendanceStats.earlyLeave} muộn/sớm).
              </span>
            </div>
            <button
              onClick={() => navigate('/bao-cao')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              type="button"
            >
              Xem &amp; Xuất báo cáo chi tiết
            </button>
          </div>
        </div>

        {/* Right (5 cols): Cơ Cấu Điểm Danh Hôm Nay */}
        <div className="lg:col-span-5 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Cơ Cấu Điểm Danh Hôm Nay
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Tổng: {totalStaff} CB-GV
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-3">
              {/* Donut SVG Chart */}
              <div className="relative w-44 h-44 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background track */}
                  <circle className="text-slate-200 dark:text-slate-800" cx="50" cy="50" fill="none" r="38" stroke="currentColor" strokeWidth="12" />
                  {/* On-time (Brand) */}
                  {strokeOnTime > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="rgb(var(--brand-600))"
                      strokeDasharray={`${strokeOnTime} ${circumference}`}
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                  )}
                  {/* Late (Slate) */}
                  {strokeLate > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#64748B"
                      strokeDasharray={`${strokeLate} ${circumference}`}
                      strokeDashoffset={`-${strokeOnTime}`}
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                  )}
                  {/* Leave (Brand Light) */}
                  {strokeExcused > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="rgb(var(--brand-400))"
                      strokeDasharray={`${strokeExcused} ${circumference}`}
                      strokeDashoffset={`-${strokeOnTime + strokeLate}`}
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                  )}
                  {/* Absent (Rose) */}
                  {strokeAbsent > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#F43F5E"
                      strokeDasharray={`${strokeAbsent} ${circumference}`}
                      strokeDashoffset={`-${strokeOnTime + strokeLate + strokeExcused}`}
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                  )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                    {todayAttendanceStats.rate}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {totalRecordsToday > 0 ? 'Hiện diện' : 'Chưa có lượt quét'}
                  </span>
                </div>
              </div>

              {/* Breakdown List (100% REAL) */}
              <div className="flex flex-col gap-2 w-full sm:w-auto flex-1">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-600"></span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Đúng giờ</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {todayAttendanceStats.onTime}{' '}
                    <span className="text-[10px] font-normal text-slate-500">({onTimePct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Đi muộn / Về sớm
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {lateAndEarlyToday}{' '}
                    <span className="text-[10px] font-normal text-slate-500">({latePct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Nghỉ phép đã duyệt
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {todayAttendanceStats.excused}{' '}
                    <span className="text-[10px] font-normal text-slate-500">({excusedPct}%)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Vắng không phép</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {todayAttendanceStats.absent}{' '}
                    <span className="text-[10px] font-normal text-slate-500">({absentPct}%)</span>
                  </span>
                </div>

                {todayAttendanceStats.thieuCheckOut > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Thiếu check-out</span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                      {todayAttendanceStats.thieuCheckOut}{' '}
                      <span className="text-[10px] font-normal text-slate-500">({missingCoPct}%)</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Geofence Notice Alert */}
          <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex flex-col text-xs">
              <span className="font-bold text-slate-900 dark:text-white">Thông báo Geofence GPS di động</span>
              <span className="text-slate-500 dark:text-slate-400 mt-0.5">
                Hệ thống tự động kích hoạt kiểm tra bán kính {campusInfo?.radiusMeters ?? 150}m quanh{' '}
                {campusInfo?.name || 'Trường Đại học Nguyễn Trãi'}. Các điểm danh GPS chuẩn xác được gán nhãn ngay lập tức.
              </span>
            </div>
          </div>
        </div>
      </div>
      </section>

      {/* =====================================================================
          4. REALTIME BIOMETRIC ATTENDANCE LIVE FEED (THE STITCH TABLE)
      ===================================================================== */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Lịch Sử Điểm Danh Sinh Trắc Học Thời Gian Thực
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Hôm nay
            </span>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
              <button
                onClick={() => setTableFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                type="button"
              >
                Tất cả ({recentPunches.length})
              </button>
              <button
                onClick={() => setTableFilter('face_ai')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableFilter === 'face_ai'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                type="button"
              >
                Camera Face AI
              </button>
              <button
                onClick={() => setTableFilter('GPS')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableFilter === 'GPS'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                type="button"
              >
                Mobile GPS
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchPunchKeyword}
                onChange={(e) => setSearchPunchKeyword(e.target.value)}
                className="w-48 sm:w-56 h-8 pl-8 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Lọc mã CB, họ tên..."
                type="text"
              />
            </div>
          </div>
        </div>

        {/* Biometric Attendance List (Optimized 100% Fit - No Horizontal Scrollbar) */}
        <div className="w-full">
          {/* Mobile Card List (< sm screens) */}
          <div className="sm:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPunches.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Chưa có lượt điểm danh nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredPunches.map((item: any, idx) => {
                const statusInfo = STATUS_CONFIGS[item.trang_thai] || STATUS_CONFIGS.on_time;
                const userObj = item.nguoi_dung;
                const deptName = userObj?.don_vi_chinh?.ten_phong_ban || 'Ban Giám Hiệu';
                const shiftName = item.ca?.ten_ca || 'Ca Hành Chính';
                const conf = item.luot_quet?.[0]?.do_tin_cay_ai;
                const hasCheckedIn = Boolean(item.thoi_gian_vao);
                const hasCheckedOut = Boolean(item.thoi_gian_ra);
                const isAbsent = item.trang_thai === 'absent' || (!hasCheckedIn && !hasCheckedOut);
                const roleLabel = getRoleLabel(userObj?.vai_tro_chinh);

                return (
                  <div key={item.id || idx} className="py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {userObj?.anh_dai_dien ? (
                            <img
                              src={userObj.anh_dai_dien}
                              alt="Avatar"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            getInitials(userObj?.ho_ten)
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white truncate text-xs">
                            {userObj?.ho_ten || 'Cán bộ'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {userObj?.ma_can_bo || 'NTU-CB'} • {roleLabel}
                          </span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusInfo.badgeCls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotCls}`}></span>
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg">
                      <span className="truncate max-w-[160px] font-medium text-slate-600 dark:text-slate-300">
                        {deptName}
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded">
                        {shiftName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono pt-1">
                      <div className="flex items-center gap-3">
                        <span className={hasCheckedIn ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}>
                          Vào: {hasCheckedIn ? formatTimeVN(item.thoi_gian_vao) : '--:--:--'}
                        </span>
                        <span className={hasCheckedOut ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                          Ra: {hasCheckedOut ? formatTimeVN(item.thoi_gian_ra) : '--:--:--'}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate('/quan-ly-cham-cong')}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 text-[11px] font-bold"
                        type="button"
                      >
                        Chi tiết <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop & Tablet Table (>= sm screens, 100% Width Fit - Table Fixed - No Scrollbar) */}
          <div className="hidden sm:block w-full overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[18%]" /> {/* Cán Bộ / GV - khoảng bé gọn gàng */}
                <col className="w-[19%]" /> {/* Khoa / Đơn Vị */}
                <col className="w-[15%]" /> {/* Ca Làm Việc */}
                <col className="w-[17%]" /> {/* Thời Gian (Vào - Ra) */}
                <col className="w-[14%]" /> {/* Trạng Thái */}
                <col className="w-[13%]" /> {/* Xác Thực */}
                <col className="w-[4%]" />  {/* Chi Tiết */}
              </colgroup>
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-2.5 sm:px-3 rounded-l-xl truncate" title="Cán Bộ / Giảng Viên">Cán Bộ / GV</th>
                  <th className="py-2.5 px-2 truncate">Khoa / Đơn Vị</th>
                  <th className="py-2.5 px-2 truncate">Ca Làm Việc</th>
                  <th className="py-2.5 px-2 truncate">Thời Gian (Vào - Ra)</th>
                  <th className="py-2.5 px-2 truncate">Trạng Thái</th>
                  <th className="py-2.5 px-2 truncate">Xác Thực</th>
                  <th className="py-2.5 px-2 rounded-r-xl text-right">Chi Tiết</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-800 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPunches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Chưa có lượt điểm danh nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredPunches.map((item: any, idx) => {
                    const statusInfo = STATUS_CONFIGS[item.trang_thai] || STATUS_CONFIGS.on_time;
                    const userObj = item.nguoi_dung;
                    const deptName = userObj?.don_vi_chinh?.ten_phong_ban || 'Ban Giám Hiệu';
                    const shiftName = item.ca?.ten_ca || 'Ca Hành Chính';
                    const firstPunch = item.luot_quet?.[0];
                    const conf = firstPunch?.do_tin_cay_ai;
                    const distMeters = firstPunch?.khoang_cach_met;
                    const rawMethod = String(firstPunch?.phuong_thuc || '').toLowerCase();
                    const hasCheckedIn = Boolean(item.thoi_gian_vao);
                    const hasCheckedOut = Boolean(item.thoi_gian_ra);
                    const isAbsent = item.trang_thai === 'absent' || (!hasCheckedIn && !hasCheckedOut);
                    const roleLabel = getRoleLabel(userObj?.vai_tro_chinh);

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Cán bộ (Thu nhỏ khoảng không gian gọn gàng) */}
                        <td className="py-2.5 px-2.5 sm:px-3 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                              {userObj?.anh_dai_dien ? (
                                <img
                                  src={userObj.anh_dai_dien}
                                  alt="Avatar"
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                getInitials(userObj?.ho_ten)
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 overflow-hidden">
                              <span className="font-bold text-slate-900 dark:text-white truncate text-xs block" title={userObj?.ho_ten || 'Cán bộ'}>
                                {userObj?.ho_ten || 'Cán bộ'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 truncate block">
                                {userObj?.ma_can_bo || 'NTU'} • {roleLabel}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Khoa / Đơn vị */}
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 font-medium overflow-hidden">
                          <span className="truncate block text-xs" title={deptName}>
                            {deptName}
                          </span>
                        </td>

                        {/* Ca làm việc */}
                        <td className="py-2.5 px-2 overflow-hidden">
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md inline-block truncate max-w-full" title={shiftName}>
                            {shiftName}
                          </span>
                        </td>

                        {/* Thời Gian (Vào - Ra) */}
                        <td className="py-2.5 px-2 font-mono overflow-hidden">
                          <div className="flex flex-col text-[11px] leading-tight">
                            <div className="flex items-center gap-1 truncate">
                              <span className="text-[10px] font-bold text-slate-400 uppercase w-5 shrink-0">Vào</span>
                              <span className={hasCheckedIn ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}>
                                {hasCheckedIn ? formatTimeVN(item.thoi_gian_vao) : '--:--:--'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 truncate mt-0.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase w-5 shrink-0">Ra</span>
                              <span className={hasCheckedOut ? 'font-medium text-slate-700 dark:text-slate-300' : 'text-slate-400'}>
                                {hasCheckedOut ? formatTimeVN(item.thoi_gian_ra) : '--:--:--'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-2 overflow-hidden">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold truncate max-w-full ${statusInfo.badgeCls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dotCls}`}></span>
                            <span className="truncate">{statusInfo.label}</span>
                          </span>
                        </td>

                        {/* Thiết bị / Phương thức */}
                        <td className="py-2.5 px-2 overflow-hidden">
                          {isAbsent ? (
                            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">—</span>
                          ) : rawMethod.includes('gps') ? (
                            <div
                              className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate"
                              title={distMeters != null ? `Mobile GPS (${Math.round(Number(distMeters))}m)` : 'Mobile GPS'}
                            >
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                {distMeters != null ? `GPS (${Math.round(Number(distMeters))}m)` : 'Mobile GPS'}
                              </span>
                            </div>
                          ) : rawMethod.includes('qr') ? (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 truncate" title="Mã QR động">
                              <ScanFace className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span className="truncate">QR Động</span>
                            </div>
                          ) : rawMethod.includes('thu_cong') || rawMethod.includes('manual') ? (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate" title="Thủ công (Admin)">
                              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">Thủ công</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate" title={`Face AI Kiosk${conf ? ` (${conf.toFixed(2)} cos)` : ''}`}>
                              <Camera className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span className="truncate">Face AI{conf ? ` (${conf.toFixed(2)})` : ''}</span>
                            </div>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-2.5 px-2 text-right">
                          <button
                            onClick={() => navigate('/quan-ly-cham-cong')}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                            type="button"
                            title="Xem chi tiết"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Hiển thị <b>{filteredPunches.length}</b> lượt điểm danh gần nhất trong ngày
          </span>
          <button
            onClick={() => navigate('/quan-ly-cham-cong')}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Xem toàn bộ dữ liệu chấm công chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* =====================================================================
          5. BOTTOM SCHEDULE & EXECUTIVE APPROVAL SHORTCUTS (2-COLUMN GRID)
      ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left (7 cols): Lịch Họp Giao Ban & Sự Kiện Trọng Tâm Hôm Nay */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Lịch Giảng Dạy & Sự Kiện Trọng Tâm Hôm Nay
                </h3>
              </div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full">
                {todaySchedules.length} Lịch trình
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {todaySchedules.length > 0 ? (
                todaySchedules.slice(0, 3).map((sched: any, sIdx) => {
                  const subjectName = sched.mon_hoc?.ten_mon || 'Lập Trình Web & AI';
                  const shiftName = sched.ca?.ten_ca || 'Ca Sáng';

                  return (
                    <div
                      key={sched.id || sIdx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex flex-col items-center justify-center shrink-0 shadow-sm">
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            Th{new Date().getMonth() + 1}
                          </span>
                          <span className="text-base font-extrabold leading-tight">
                            {new Date().getDate()}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {subjectName}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              {sched.gio_bat_dau} - {sched.gio_ket_thuc}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-blue-500" />
                              Phòng: {sched.phong_hoc || 'A302'}
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                              {shiftName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold shrink-0">
                        Chính khóa
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400">
                  <Calendar className="w-8 h-8 mb-2 stroke-[1.5] text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Hôm nay chưa có lịch giảng dạy hoặc hội họp nào.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Lịch công tác được cập nhật tự động khi có phân công thời khóa biểu.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-end border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => navigate('/lich-trinh')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem lịch biểu công tác toàn trường</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right (5 cols): Duyệt Nhanh Đơn Công Tác & Nghỉ Phép */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Duyệt Nhanh Đơn Công Tác & Nghỉ Phép
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800">
                {pendingLeaveCount} Đang chờ
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {pendingLeaveList.length > 0 ? (
                pendingLeaveList.map((reqItem: any) => {
                  const staffName = reqItem.nguoi_dung?.ho_ten || 'Cán bộ';
                  const staffCode = reqItem.nguoi_dung?.ma_can_bo || 'NTU';
                  const isApproving = isApprovingId === (reqItem.id);

                  return (
                    <div
                      key={reqItem.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {staffName} • {staffCode}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate mt-0.5">
                          {reqItem.ly_do || 'Nghỉ phép công tác theo lịch cá nhân'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          disabled={isApproving}
                          onClick={() => handleQuickApproveLeave(reqItem.id)}
                          className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                          type="button"
                        >
                          {isApproving ? 'Đang duyệt...' : 'Duyệt'}
                        </button>
                        <button
                          onClick={() => navigate('/don-nghi-phep')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                          type="button"
                        >
                          Xem
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mb-2 stroke-[1.5] text-emerald-500/80" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Không có đơn xin nghỉ phép nào đang chờ duyệt.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Tất cả đề xuất đã được giải quyết hoặc chưa phát sinh đơn mới.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500">Tất cả đề xuất đều tuân thủ quy chế BGH</span>
            <button
              onClick={() => navigate('/don-nghi-phep')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              type="button"
            >
              Phê duyệt toàn bộ ({pendingLeaveCount})
            </button>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. FACE ATTENDANCE SCANNER MODAL
      ===================================================================== */}
      {scannerMode && (
        <FaceAttendanceScannerModal
          isOpen={!!scannerMode}
          mode={scannerMode}
          onClose={() => setScannerMode(null)}
          onSuccess={() => {
            setScannerMode(null);
            fetchDashboardData();
            toast.success('Điểm danh thành công!');
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
