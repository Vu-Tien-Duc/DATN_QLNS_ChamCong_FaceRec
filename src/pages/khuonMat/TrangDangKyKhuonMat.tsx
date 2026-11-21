import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Users,
  Search,
  ScanFace,
  User,
  ArrowRight,
  Check,
  Clock,
  Sparkles,
  Layers,
  Building2,
  Mail,
  UserCheck,
  LayoutGrid,
  List,
  AlignJustify,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Download,
  Eye,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../../components/chung/NutBam';
import toast from 'react-hot-toast';
import { faceApi, RegistrationStatusResponse } from '../../api/khuonMat.api';
import { apiClient } from '../../api/apiClient';
import { userApi } from '../../api/nguoiDung.api';
import { DepartmentSelect, DepartmentItem } from '../../components/chung/ChonDonVi';
import { FaceRegistrationModal } from '../../components/sinhTracHoc/ModalDangKyKhuonMat';
import { useAuthStore } from '../../stores/useXacThucStore';
import { hasRole } from '../../utils/phanQuyen';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { Portal } from '../../components/chung/CongDichChuyen';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';

export const FaceRegistrationPage: React.FC = () => {
  const { user: authUser, fetchMe } = useAuthStore();

  const [status, setStatus] = useState<RegistrationStatusResponse['data'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [serviceHealth, setServiceHealth] = useState<{ status: string; ready?: boolean; face_service?: any } | null>(null);

  // Quản lý nhân sự khác (Admin / BGH / TCCB)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [detailEmployee, setDetailEmployee] = useState<any>(null);
  const [detailFaceStatus, setDetailFaceStatus] = useState<RegistrationStatusResponse['data'] | null>(null);
  const [loadingDetailFace, setLoadingDetailFace] = useState<boolean>(false);
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'registered' | 'not_registered'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);

  // Phân trang danh sách nhân sự
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState<boolean>(false);
  const [pageSizeMenuPos, setPageSizeMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    width: 128,
    openUp: true,
  });
  const pageSizeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pageSizeMenuRef = useRef<HTMLDivElement | null>(null);

  const handleTogglePageSizeMenu = () => {
    if (isPageSizeOpen) {
      setIsPageSizeOpen(false);
      return;
    }
    const trigger = pageSizeTriggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const estimatedMenuHeight = 116;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedMenuHeight + 12 && rect.top > estimatedMenuHeight;
      const menuWidth = Math.round(rect.width);
      const left = Math.min(
        Math.max(8, rect.left + (rect.width - menuWidth) / 2),
        window.innerWidth - menuWidth - 8
      );
      setPageSizeMenuPos({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        left,
        width: menuWidth,
        openUp,
      });
    }
    setIsPageSizeOpen(true);
  };

  useEffect(() => {
    if (!isPageSizeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        pageSizeTriggerRef.current?.contains(target) ||
        pageSizeMenuRef.current?.contains(target)
      ) {
        return;
      }
      setIsPageSizeOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPageSizeOpen(false);
    };
    const handleViewportChange = () => setIsPageSizeOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isPageSizeOpen]);

  // Chế độ bố cục hiển thị danh sách nhân sự (Table / Grid / Compact / Department)
  type ViewMode = 'table' | 'grid' | 'compact' | 'department';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('face_reg_view_mode') as ViewMode) || 'table';
    } catch (_) {
      return 'table';
    }
  });
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  const toggleDeptCollapse = (deptName: string) => {
    setCollapsedDepts((prev) => ({
      ...prev,
      [deptName]: !prev[deptName],
    }));
  };

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('face_reg_view_mode', mode);
    } catch (_) {}
  };

  const canManageOthers = useMemo(
    () => hasRole(authUser, ['admin', 'bgh', 'tccb', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong']),
    [authUser]
  );

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await faceApi.getRegistrationStatus();
      if (res.success) {
        setStatus(res.data);
      }
    } catch (_) {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    try {
      const h = await faceApi.getHealth();
      setServiceHealth(h);
    } catch (_) {
      setServiceHealth({ status: 'offline' });
    }
  };

  const searchEmployees = async (keyword = '') => {
    if (!canManageOthers) return;
    try {
      setLoadingEmployees(true);
      const res = await apiClient.get<any>(`/nguoi-dung?trang=1&gioi_han=100&tim_kiem=${encodeURIComponent(keyword)}`);
      let users = res.data?.data?.users || res.data?.users || res.data || [];
      const totalPages = Number(res.data?.data?.pagination?.totalPages || 1);
      if (Array.isArray(users) && totalPages > 1) {
        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            apiClient
              .get<any>(`/nguoi-dung?trang=${i + 2}&gioi_han=100&tim_kiem=${encodeURIComponent(keyword)}`)
              .catch(() => null)
          )
        );
        rest.forEach((r) => {
          const extra = r?.data?.data?.users || r?.data?.users;
          if (Array.isArray(extra)) users = users.concat(extra);
        });
      }
      if (Array.isArray(users)) {
        setEmployeeList(users);
      }
    } catch (_) {
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadHealth();
    if (canManageOthers) {
      searchEmployees();
      userApi.getDepartments().then((res: any) => {
        if (res?.data && Array.isArray(res.data)) {
          setDepartments(res.data);
        }
      }).catch(() => {});
    }
  }, [canManageOthers]);

  const handleOpenEmployeeEnroll = (emp: any) => {
    if (authUser?.id && String(emp?.id) === String(authUser.id)) {
      toast.error('Bạn không thể tự đăng ký khuôn mặt của chính mình. Vui lòng nhờ cấp trên thực hiện.');
      return;
    }
    setSelectedEmployee(emp);
    setIsEnrollModalOpen(true);
  };

  const handleOpenEmployeeDetail = async (emp: any) => {
    setDetailEmployee(emp);
    setDetailFaceStatus(null);
    const targetId = emp?.id;
    if (!targetId) return;
    try {
      setLoadingDetailFace(true);
      const res = await faceApi.getRegistrationStatus(String(targetId));
      if (res?.success && res.data) {
        setDetailFaceStatus(res.data);
      }
    } catch (_) {
      // Fallback sang dữ liệu danh sách nếu không tải được chi tiết
    } finally {
      setLoadingDetailFace(false);
    }
  };

  const handleDeleteEmployeeFace = async (targetId: string, targetName: string) => {
    if (!targetId) {
      toast.error('Thiếu mã định danh của nhân sự cần xóa.');
      return;
    }
    if (authUser?.id && String(targetId) === String(authUser.id)) {
      toast.error('Bạn không thể tự xóa dữ liệu sinh trắc học của chính mình. Vui lòng nhờ cấp trên thực hiện.');
      return;
    }

    if (!window.confirm(`Xác nhận xóa sạch dữ liệu mẫu Face ID của "${targetName}" theo Nghị định 13/2023/NĐ-CP?`)) {
      return;
    }

    try {
      const res = await faceApi.deleteFaceData(targetId);
      if (res.success) {
        toast.success(`Đã xóa dữ liệu Face ID của ${targetName}`);
        if (canManageOthers) searchEmployees(employeeSearch);
        const currentUserId = authUser?.id;
        if (targetId === currentUserId) {
          loadStatus();
          fetchMe();
        }
      } else {
        toast.error(res.message || 'Không thể xóa dữ liệu khuôn mặt.');
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Không thể xóa dữ liệu khuôn mặt.';
      toast.error(errMsg);
    }
  };

  // Helper tách tên và chức danh/chức vụ
  const formatNameAndTitle = (rawName: string) => {
    if (!rawName) return { name: 'Cán bộ', title: '' };
    const match = rawName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      return { name: match[1].trim(), title: match[2].trim() };
    }
    return { name: rawName, title: '' };
  };

  // Helper lấy tên viết tắt chuẩn tiếng Việt (loại bỏ học hàm ThS, TS, PGS, GS...)
  const getUserInitials = (fullName?: string): string => {
    if (!fullName) return 'CB';
    const cleaned = fullName
      .replace(/\(.*?\)/g, '')
      .replace(/^(GS\.|PGS\.|TS\.|ThS\.|CN\.|KS\.|Đ\/c|Thầy|Cô|GS|PGS|TS|ThS)\s+/gi, '')
      .replace(/^(GS\.|PGS\.|TS\.|ThS\.|CN\.|KS\.|Đ\/c|Thầy|Cô|GS|PGS|TS|ThS)\s+/gi, '')
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (cleaned.substring(0, 2) || 'CB').toUpperCase();
  };

  // Helper lấy Avatar hồ sơ cá nhân (Avatar là riêng, không lấy anh_khuon_mat sinh trắc học)
  const getCleanAvatarUrl = (emp: any): string | null => {
    const raw = emp.anh_dai_dien;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.includes('/faces/face-') || raw.includes('category=face-registration')) return null;
    return raw;
  };

  // Helper lấy ID đơn vị của nhân sự
  const getEmpDepartmentId = (emp: any): string => {
    if (emp.don_vi_chinh_id) return String(emp.don_vi_chinh_id);
    if (emp.don_vi_chinh && typeof emp.don_vi_chinh === 'object') {
      return String(emp.don_vi_chinh.id || '');
    }
    return '';
  };

  // Helper lấy tên hiển thị đơn vị chính xác theo bảng Departments
  const getEmpDepartmentName = (emp: any): string => {
    if (emp.ten_phong_ban && String(emp.ten_phong_ban).trim()) {
      return String(emp.ten_phong_ban).trim();
    }
    if (emp.don_vi_chinh && typeof emp.don_vi_chinh === 'object' && emp.don_vi_chinh.ten_phong_ban) {
      return String(emp.don_vi_chinh.ten_phong_ban);
    }
    const deptId = getEmpDepartmentId(emp);
    if (deptId && departments.length > 0) {
      const found = departments.find((d) => String(d.id) === deptId);
      if (found) return found.ten_phong_ban || 'Văn phòng / Ban';
    }
    return 'Văn phòng / Ban';
  };

  // Lọc danh sách nhân viên theo Tab và Khoa/Bộ môn
  const filteredEmployees = useMemo(() => {
    return employeeList.filter((emp) => {
      // 1. Lọc theo trạng thái Face ID
      const isReg = Boolean(emp.da_dang_ky_face);
      if (filterTab === 'registered' && !isReg) return false;
      if (filterTab === 'not_registered' && isReg) return false;

      // 2. Lọc theo Khoa / Bộ môn
      if (departmentFilter !== 'ALL') {
        const empDeptId = getEmpDepartmentId(emp);
        const selectedDept = departments.find((d) => String(d.id) === String(departmentFilter));
        const isBghFilter = selectedDept
          ? String(selectedDept.loai_don_vi || '').toLowerCase().includes('bgh') ||
            String(selectedDept.ten_phong_ban || '').toLowerCase().includes('giám hiệu')
          : false;

        if (isBghFilter) {
          const isUserBgh = String(emp.vai_tro_chinh || '').toLowerCase().includes('bgh') || empDeptId === departmentFilter;
          if (!isUserBgh) return false;
        } else {
          // Khớp trực tiếp hoặc theo cây đơn vị đa cấp (Khoa -> Bộ môn -> Tổ)
          let matchesTree = false;
          let curId: string | null = empDeptId || null;
          const visited = new Set<string>();
          while (curId && !visited.has(curId)) {
            if (curId === String(departmentFilter)) {
              matchesTree = true;
              break;
            }
            visited.add(curId);
            const curDept = departments.find((d) => String(d.id) === curId);
            const rawParent = curDept?.don_vi_cha_id;
            curId = rawParent
              ? typeof rawParent === 'object' && rawParent !== null
                ? String((rawParent as any).id || '')
                : String(rawParent)
              : null;
          }

          // Khớp roles phân quyền
          const roleList = Array.isArray(emp.danh_sach_vai_tro) ? emp.danh_sach_vai_tro : [];
          const matchesRoles = roleList.some((r: any) => {
            const rDept = r.don_vi_id;
            if (!rDept) return false;
            const rId = typeof rDept === 'object' && rDept !== null ? String(rDept.id || '') : String(rDept);
            return rId === departmentFilter;
          });

          if (!matchesTree && !matchesRoles) {
            return false;
          }
        }
      }

      return true;
    });
  }, [employeeList, filterTab, departmentFilter, departments]);

  // Tính toán phân trang
  const totalFilteredCount = filteredEmployees.length;
  const totalPages = Math.ceil(totalFilteredCount / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedEmployees = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, validCurrentPage, pageSize]);

  // Phân nhóm nhân sự theo Khoa / Phòng ban phục vụ View Mode 'department' (dựa trên danh sách trang hiện tại)
  const paginatedDepartmentGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    paginatedEmployees.forEach((emp) => {
      const deptName = getEmpDepartmentName(emp);
      if (!map.has(deptName)) {
        map.set(deptName, []);
      }
      map.get(deptName)!.push(emp);
    });

    return Array.from(map.entries()).map(([deptName, members]) => {
      const registeredCount = members.filter((m) => Boolean(m.da_dang_ky_face)).length;
      const total = members.length;
      const percent = total > 0 ? Math.round((registeredCount / total) * 100) : 0;
      return {
        deptName,
        members,
        registeredCount,
        total,
        percent,
      };
    });
  }, [paginatedEmployees, departments]);

  const totalRegisteredCount = useMemo(() => {
    return employeeList.filter((e) => Boolean(e.da_dang_ky_face)).length;
  }, [employeeList]);

  // ---------------------------------------------------------------------------
  // XUẤT DANH SÁCH SINH TRẮC HỌC FACE ID RA FILE EXCEL (.XLSX)
  // ---------------------------------------------------------------------------
  const handleExportFaceExcel = () => {
    if (!filteredEmployees.length) {
      toast.error('Không có dữ liệu nhân sự để xuất file Excel');
      return;
    }
    try {
      const sanitizeExcelCell = (val: unknown): string | number => {
        if (typeof val === 'number') return val;
        if (val === null || val === undefined) return '';
        const str = String(val);
        return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
      };

      const dataRows = filteredEmployees.map((emp, i) => {
        const { name } = formatNameAndTitle(emp.ho_ten || '');
        const deptName = getEmpDepartmentName(emp);
        const isReg = Boolean(emp.da_dang_ky_face);
        const posesCount = emp.so_luong_mau ?? (isReg ? 5 : 0);
        const registeredAt = emp.ngay_dang_ky_face ? new Date(emp.ngay_dang_ky_face).toLocaleDateString('vi-VN') : (isReg ? 'Đã lưu mẫu' : '--');

        return {
          'STT': i + 1,
          'Mã Cán Bộ': sanitizeExcelCell(emp.ma_can_bo || '--'),
          'Họ Và Tên': sanitizeExcelCell(name),
          'Khoa / Phòng Ban': sanitizeExcelCell(deptName),
          'Chức Vụ': sanitizeExcelCell(emp.chuc_vu || '--'),
          'Email Công Vụ': sanitizeExcelCell(emp.email || '--'),
          'Số Điện Thoại': sanitizeExcelCell(emp.so_dien_thoai || '--'),
          'Trạng Thái Face ID': isReg ? 'Đã kích hoạt' : 'Chưa đăng ký',
          'Số Góc Mặt Đã Thu Thập': isReg ? `${posesCount}/5 góc` : '0/5 góc',
          'Chuẩn Trích Xuất': isReg ? 'InsightFace 512D' : '--',
          'Ngày Đăng Ký Mẫu': sanitizeExcelCell(registeredAt),
          'Trạng Thái Tài Khoản': emp.kich_hoat !== false ? 'Đang hoạt động' : 'Đã khóa',
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 26 },
        { wch: 28 },
        { wch: 20 },
        { wch: 28 },
        { wch: 15 },
        { wch: 20 },
        { wch: 24 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Sách Face ID');

      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      XLSX.writeFile(wb, `Danh_Sach_Face_ID_NTU_${todayIso}.xlsx`);
      toast.success('Đã xuất Danh sách Face ID (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Danh sách Face ID:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  const totalEmployeesCount = employeeList.length || 0;
  const unregisteredCount = Math.max(0, totalEmployeesCount - totalRegisteredCount);
  const coveragePercent = totalEmployeesCount > 0 ? Math.round((totalRegisteredCount / totalEmployeesCount) * 100) : 0;
  const isAiReady = serviceHealth?.status === 'ok' && serviceHealth?.ready !== false;
  const isAiStarting = serviceHealth?.status === 'ok' && serviceHealth?.ready === false;

  return (
    <div className="w-full space-y-4 animate-fadeIn pb-16">
      {/* ── 1. Header Trang ──────────────────────────────────────────────── */}
      <PageHeader
        title="Đăng ký & Quản lý Face ID"
        subtitle="Nhận diện khuôn mặt ArcFace 512 chiều cho điểm danh thời gian thực."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`h-9 inline-flex items-center gap-1.5 px-3.5 rounded-full text-xs font-semibold border ${
                isAiReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
                  : isAiStarting
                    ? 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                    : 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isAiReady
                    ? 'bg-emerald-500 animate-pulse'
                    : isAiStarting
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                }`}
              />
              <span>
                {isAiReady ? 'AI sẵn sàng' : isAiStarting ? 'AI đang khởi tạo' : 'Chưa kết nối AI'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportFaceExcel}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Xuất danh sách đăng ký Face ID ra file Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadStatus();
                loadHealth();
                if (canManageOthers) searchEmployees(employeeSearch);
              }}
              disabled={loading}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer shadow-2xs"
              title="Làm mới trạng thái dữ liệu"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        }
      />

      {/* ── 2. Hàng 4 Thẻ Thống Kê KPI (Dữ Liệu Thật) ───────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
        <button
          type="button"
          onClick={() => {
            setFilterTab('all');
            setCurrentPage(1);
          }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs cursor-pointer"
        >
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Tổng cán bộ / GV
          </span>
          <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1 leading-none">
            {totalEmployeesCount}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1.5">
            nhân sự trong hệ thống
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterTab('registered');
            setCurrentPage(1);
          }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left transition-all hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-xs cursor-pointer"
        >
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Đã có Face ID
          </span>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1 leading-none">
            {totalRegisteredCount}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1.5">
            sẵn sàng điểm danh
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterTab('not_registered');
            setCurrentPage(1);
          }}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left transition-all hover:border-amber-300 dark:hover:border-amber-800 hover:shadow-xs cursor-pointer"
        >
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Chưa đăng ký
          </span>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 tabular-nums mt-1 leading-none">
            {unregisteredCount}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1.5">
            {unregisteredCount > 0 ? 'cần xử lý' : 'đã hoàn tất'}
          </span>
        </button>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              Tỷ lệ bao phủ
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold shrink-0">
              Vector 512D
            </span>
          </div>
          <div className="text-xl font-bold text-brand-600 dark:text-brand-400 tabular-nums mt-1 leading-none">
            {coveragePercent}%
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-brand-600 dark:bg-brand-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, coveragePercent))}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 4. Khung Danh Sách Nhân Sự ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden w-full">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                setCurrentPage(1);
                searchEmployees(e.target.value);
              }}
              placeholder="Tìm theo tên, mã CB, email..."
              className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200/90 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-all"
            />
            {employeeSearch && (
              <button
                type="button"
                onClick={() => {
                  setEmployeeSearch('');
                  setCurrentPage(1);
                  searchEmployees('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                title="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bộ lọc Khoa / Bộ môn */}
          <div className="w-full sm:w-52">
            <DepartmentSelect
              departments={departments}
              value={departmentFilter}
              onChange={(val) => {
                setDepartmentFilter(val);
                setCurrentPage(1);
              }}
              allowAll={true}
              allLabel="Tất cả Khoa / Đơn vị"
              placeholder="Lọc theo đơn vị..."
              size="sm"
            />
          </div>

          {/* Bộ lọc Tab trạng thái (Segmented Control) */}
          <div className="flex items-center gap-0.5 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setFilterTab('all');
                setCurrentPage(1);
              }}
              className={`h-7 px-3 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                filterTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <span>Tất cả</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{totalEmployeesCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('registered');
                setCurrentPage(1);
              }}
              className={`h-7 px-3 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                filterTab === 'registered'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <span>Đã có</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{totalRegisteredCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('not_registered');
                setCurrentPage(1);
              }}
              className={`h-7 px-3 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                filterTab === 'not_registered'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              <span>Chưa có</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">{unregisteredCount}</span>
            </button>
          </div>

          {/* Bộ chọn Bố Cục Hiển Thị (Icon Buttons) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-950/60 dark:border-brand-800 dark:text-brand-400'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title="Dạng Bảng chi tiết"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-950/60 dark:border-brand-800 dark:text-brand-400'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title="Dạng Thẻ lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('department')}
              className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                viewMode === 'department'
                  ? 'bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-950/60 dark:border-brand-800 dark:text-brand-400'
                  : 'bg-white border-slate-200/90 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
              title="Dạng Theo Khoa / Đơn vị"
            >
              <Building2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Khung Hiển Thị Danh Sách Nhân Sự */}
        <div className="w-full">
          {loadingEmployees ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
              Đang tải danh sách nhân sự...
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              Không tìm thấy nhân sự nào phù hợp với bộ lọc.
            </div>
          ) : viewMode === 'table' ? (
            /* ── CHẾ ĐỘ 1: BẢNG CHI TIẾT 4 CỘT CHUẨN ── */
            <>
              {/* Header Bảng: 4 Cột Tinh Gọn */}
              <div className="hidden sm:grid grid-cols-[1.65fr_1.15fr_1.1fr_195px] gap-4 px-5 py-2.5 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center select-none">
                <div className="min-w-0">Cán bộ / Giảng viên</div>
                <div className="min-w-0">Khoa / Đơn vị</div>
                <div className="min-w-0">Trạng thái</div>
                <div className="text-right">Thao tác</div>
              </div>

              {/* Body Danh Sách */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedEmployees.map((emp) => {
                  const empId = emp.id;
                  const isRegistered = Boolean(emp.da_dang_ky_face);
                  const parsed = formatNameAndTitle(emp.ho_ten || '');
                  const staffCodeVal = emp.ma_can_bo || (empId ? `CB-${empId.slice(-4).toUpperCase()}` : '—');
                  const deptNameVal = getEmpDepartmentName(emp);
                  const registeredDateLabel = emp.ngay_dang_ky_face
                    ? `Đăng ký ${new Date(emp.ngay_dang_ky_face).toLocaleDateString('vi-VN')}`
                    : emp.so_luong_mau
                      ? `Đã lưu ${emp.so_luong_mau} góc mẫu`
                      : 'Sẵn sàng điểm danh · 512D';

                  return (
                    <div
                      key={empId}
                      className={`px-4 py-2.5 sm:px-5 sm:py-2.5 transition-colors flex flex-col sm:grid sm:grid-cols-[1.65fr_1.15fr_1.1fr_195px] gap-2.5 sm:gap-4 items-start sm:items-center w-full min-w-0 ${
                        !isRegistered
                          ? 'bg-amber-50/45 dark:bg-amber-950/15 hover:bg-amber-50/70 dark:hover:bg-amber-950/25'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Cột 1: Cán bộ / Giảng viên (Gộp Mã CB · Email gọn gàng) */}
                      <div className="w-full sm:w-auto min-w-0 flex items-center gap-2.5">
                        <UserAvatar
                          name={emp.ho_ten}
                          avatarUrl={emp.anh_dai_dien}
                          staffCode={emp.ma_can_bo || empId}
                          size="sm"
                          shape="circle"
                        />
                        <div className="flex flex-col min-w-0 flex-1 leading-tight">
                          <span
                            className="font-semibold text-slate-800 dark:text-slate-100 text-xs truncate block"
                            title={parsed.name}
                          >
                            {parsed.name}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            <span className="font-mono font-semibold text-brand-600 dark:text-brand-400 shrink-0 tabular-nums">
                              {staffCodeVal}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="truncate" title={emp.email}>
                              {emp.email || '--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cột 2: Khoa / Đơn vị */}
                      <div className="w-full sm:w-auto min-w-0">
                        <span
                          className="text-xs text-slate-600 dark:text-slate-300 font-normal truncate block"
                          title={deptNameVal}
                        >
                          {deptNameVal}
                        </span>
                      </div>

                      {/* Cột 3: Trạng thái + Chi tiết thật */}
                      <div className="w-full sm:w-auto min-w-0 flex items-center justify-between sm:block">
                        <div className="flex flex-col items-start">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold inline-flex items-center gap-1 shrink-0 ${
                              isRegistered
                                ? 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100/85 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {isRegistered ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Đã có Face ID</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 shrink-0" />
                                <span>Chưa đăng ký</span>
                              </>
                            )}
                          </span>
                          <span className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-full">
                            {isRegistered ? registeredDateLabel : 'Chưa có dữ liệu khuôn mặt'}
                          </span>
                        </div>

                        {/* Mobile Actions */}
                        <div className="sm:hidden flex items-center gap-1.5 shrink-0">
                          {authUser?.id && String(emp.id) === String(authUser.id) ? (
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeDetail(emp)}
                              className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 text-[11px] font-medium inline-flex items-center gap-1"
                              title="Hồ sơ cá nhân (chỉ cấp trên thao tác)"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Chi tiết</span>
                            </button>
                          ) : isRegistered ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEmployeeEnroll(emp)}
                                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Chụp lại</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEmployeeDetail(emp)}
                                className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 inline-flex items-center justify-center"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEmployeeFace(emp.id, emp.ho_ten)}
                                className="w-7 h-7 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-500 inline-flex items-center justify-center"
                                title="Xóa mẫu khuôn mặt"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeEnroll(emp)}
                              className="h-7 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-xs"
                            >
                              <ScanFace className="w-3.5 h-3.5" />
                              <span>Đăng ký</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cột 4: Thao tác (Desktop) */}
                      <div className="hidden sm:flex items-center justify-end gap-1.5 shrink-0">
                        {authUser?.id && String(emp.id) === String(authUser.id) ? (
                          <>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 px-2">Hồ sơ cá nhân</span>
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeDetail(emp)}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0 shadow-2xs"
                              title="Xem chi tiết hồ sơ sinh trắc học"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : isRegistered ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeEnroll(emp)}
                              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                              title="Chụp lại mẫu khuôn mặt đa góc"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span>Chụp lại</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeDetail(emp)}
                              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0 shadow-2xs"
                              title="Xem chi tiết hồ sơ sinh trắc học"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteEmployeeFace(emp.id, emp.ho_ten)}
                              className="w-8 h-8 rounded-lg border border-rose-200/90 dark:border-rose-800/60 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 hover:text-rose-600 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0 shadow-2xs"
                              title="Xóa mẫu khuôn mặt theo NĐ 13/2023"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEmployeeEnroll(emp)}
                            className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                          >
                            <ScanFace className="w-3.5 h-3.5 shrink-0" />
                            <span>Đăng ký Face ID</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : viewMode === 'grid' ? (
            /* ── CHẾ ĐỘ 2: THẺ LƯỚI TRỰC QUAN (CARD GRID VIEW) ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-950/20">
              {paginatedEmployees.map((emp) => {
                const empId = emp.id;
                const isRegistered = Boolean(emp.da_dang_ky_face);
                const parsed = formatNameAndTitle(emp.ho_ten || '');
                const staffCodeVal = emp.ma_can_bo || (empId ? `CB-${empId.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = getEmpDepartmentName(emp);
                const avatarUrl = getCleanAvatarUrl(emp);
                const initials = getUserInitials(emp.ho_ten);

                return (
                  <div
                    key={empId}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            name={emp.ho_ten}
                            avatarUrl={emp.anh_dai_dien}
                            staffCode={emp.ma_can_bo || empId}
                            size="lg"
                            shape="circle"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate" title={parsed.name}>
                              {parsed.name}
                            </h4>
                            {parsed.title ? (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate" title={parsed.title}>
                                {parsed.title}
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Cán bộ cơ hữu</p>
                            )}
                          </div>
                        </div>

                        {/* Trạng thái Face ID Badge */}
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                            isRegistered
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Đã có</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Chưa có</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Chi tiết thông tin */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Mã CB:</span>
                          <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60">
                            {staffCodeVal}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0" title={deptNameVal}>
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] truncate">{deptNameVal}</span>
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0" title={emp.email}>
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{emp.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEmployeeDetail(emp)}
                        className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs shrink-0"
                        title="Xem chi tiết hồ sơ sinh trắc học"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {authUser?.id && String(emp.id) === String(authUser.id) ? (
                        <span className="flex-1 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500 py-1.5">
                          Hồ sơ cá nhân (cấp trên quản lý)
                        </span>
                      ) : isRegistered ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEmployeeEnroll(emp)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Chụp lại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEmployeeFace(emp.id, emp.ho_ten)}
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:border-rose-800 transition-all cursor-pointer shadow-2xs"
                            title="Xóa mẫu khuôn mặt theo NĐ 13/2023"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEmployeeEnroll(emp)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 border border-brand-200/80 dark:border-brand-800/70 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                          <span>Đăng ký Face ID</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'compact' ? (
            /* ── CHẾ ĐỘ 3: TINH GỌN SIÊU TỐC (COMPACT VIEW) ── */
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginatedEmployees.map((emp) => {
                const empId = emp.id;
                const isRegistered = Boolean(emp.da_dang_ky_face);
                const parsed = formatNameAndTitle(emp.ho_ten || '');
                const staffCodeVal = emp.ma_can_bo || (empId ? `CB-${empId.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = getEmpDepartmentName(emp);
                const avatarUrl = getCleanAvatarUrl(emp);
                const initials = getUserInitials(emp.ho_ten);

                return (
                  <div
                    key={empId}
                    className="px-3.5 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    {/* Bên trái: Avatar nhỏ, Tên, Mã, Đơn vị */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={emp.ho_ten}
                        avatarUrl={emp.anh_dai_dien}
                        staffCode={emp.ma_can_bo || empId}
                        size="xs"
                        shape="circle"
                      />

                      <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-[220px]" title={parsed.name}>
                          {parsed.name}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0">
                          {staffCodeVal}
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-800/60 px-2 py-0.5 rounded-md truncate max-w-[180px]" title={deptNameVal}>
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                      </div>
                    </div>

                    {/* Bên phải: Trạng thái Face ID & Cụm nút compact */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
                          isRegistered
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <span className="hidden sm:inline">{isRegistered ? 'Đã có Face ID' : 'Chưa đăng ký'}</span>
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEmployeeDetail(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Xem chi tiết hồ sơ sinh trắc học"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {authUser?.id && String(emp.id) === String(authUser.id) ? (
                          <span className="text-[11px] text-slate-400 px-1.5">Cá nhân</span>
                        ) : isRegistered ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeEnroll(emp)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Chụp lại Face ID"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEmployeeFace(emp.id, emp.ho_ten)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Xóa mẫu khuôn mặt"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEmployeeEnroll(emp)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors cursor-pointer"
                          >
                            <Camera className="w-3 h-3 text-brand-600" />
                            <span>Đăng ký</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── CHẾ ĐỘ 4: PHÂN NHÓM THEO KHOA / ĐƠN VỊ (DEPARTMENT GROUPS) ── */
            <div className="p-3 sm:p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20">
              {paginatedDepartmentGroups.map((group) => {
                const isCollapsed = Boolean(collapsedDepts[group.deptName]);

                return (
                  <div
                    key={group.deptName}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden"
                  >
                    {/* Header Nhóm Đơn Vị (Accordion) */}
                    <div
                      onClick={() => toggleDeptCollapse(group.deptName)}
                      className="p-3.5 sm:px-4 sm:py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/90 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                            {group.deptName}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {group.total} nhân sự • {group.registeredCount} đã đăng ký ({group.percent}%)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Mini Progress Bar */}
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${group.percent}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-9 text-right">
                            {group.percent}%
                          </span>
                        </div>

                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center">
                          {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Nội dung danh sách nhân sự của đơn vị */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {group.members.map((emp) => {
                          const empId = emp.id;
                          const isRegistered = Boolean(emp.da_dang_ky_face);
                          const parsed = formatNameAndTitle(emp.ho_ten || '');
                          const staffCodeVal = emp.ma_can_bo || (empId ? `CB-${empId.slice(-4).toUpperCase()}` : '—');
                          const avatarUrl = getCleanAvatarUrl(emp);
                          const initials = getUserInitials(emp.ho_ten);

                          return (
                            <div
                              key={empId}
                              className="p-3 sm:px-4 sm:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <UserAvatar
                                  name={emp.ho_ten}
                                  avatarUrl={emp.anh_dai_dien}
                                  staffCode={emp.ma_can_bo || empId}
                                  size="sm"
                                  shape="circle"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white truncate" title={parsed.name}>
                                      {parsed.name}
                                    </span>
                                    <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/70 shrink-0">
                                      {staffCodeVal}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={emp.email}>
                                    {parsed.title ? `${parsed.title} • ` : ''}{emp.email}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                    isRegistered
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  <span className="hidden sm:inline">{isRegistered ? 'Đã có Face ID' : 'Chưa có'}</span>
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEmployeeDetail(emp)}
                                  className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
                                  title="Xem chi tiết hồ sơ sinh trắc học"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>

                                {authUser?.id && String(emp.id) === String(authUser.id) ? (
                                  <span className="text-[11px] text-slate-400 px-1.5">Cá nhân</span>
                                ) : isRegistered ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEmployeeEnroll(emp)}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <RefreshCw className="w-3 h-3 text-slate-500" />
                                      <span className="hidden sm:inline">Chụp lại</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteEmployeeFace(emp.id, emp.ho_ten)}
                                      className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                      title="Xóa mẫu khuôn mặt"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEmployeeEnroll(emp)}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 cursor-pointer"
                                  >
                                    <Camera className="w-3 h-3 text-brand-600" />
                                    <span>Đăng ký Face ID</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── BỘ ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION BAR) ─────────── */}
        {totalFilteredCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {/* Hiển thị phạm vi bản ghi */}
            <div className="tabular-nums">
              Hiển thị <strong className="font-semibold text-slate-800 dark:text-white">{(validCurrentPage - 1) * pageSize + 1}</strong>–
              <strong className="font-semibold text-slate-800 dark:text-white">{Math.min(validCurrentPage * pageSize, totalFilteredCount)}</strong> /{' '}
              <strong className="font-semibold text-brand-600 dark:text-brand-400">{totalFilteredCount}</strong> nhân sự
            </div>

            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {/* Chọn số dòng trên mỗi trang (Custom Flux Dropdown) */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Hiển thị:</span>
                <button
                  ref={pageSizeTriggerRef}
                  type="button"
                  onClick={handleTogglePageSizeMenu}
                  aria-haspopup="listbox"
                  aria-expanded={isPageSizeOpen}
                  className={`h-7 w-[98px] inline-flex items-center justify-center gap-1 px-2 rounded-lg border text-xs font-semibold tabular-nums transition-all cursor-pointer select-none ${
                    isPageSizeOpen
                      ? 'bg-white dark:bg-slate-900 border-brand-500/80 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/10'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/80 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span>{pageSize} / trang</span>
                  <ChevronDown
                    className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                      isPageSizeOpen
                        ? 'rotate-180 text-brand-600 dark:text-brand-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                </button>

                {isPageSizeOpen && (
                  <Portal>
                    <div
                      ref={pageSizeMenuRef}
                      role="listbox"
                      aria-label="Số nhân sự mỗi trang"
                      style={{
                        position: 'fixed',
                        top: pageSizeMenuPos.top,
                        left: pageSizeMenuPos.left,
                        width: pageSizeMenuPos.width,
                        transform: pageSizeMenuPos.openUp ? 'translateY(-100%)' : undefined,
                      }}
                      className="z-[120] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-lg shadow-slate-900/10 dark:shadow-black/40 p-1 space-y-0.5"
                    >
                      {[10, 20, 50].map((size) => {
                        const isSelected = pageSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setPageSize(size);
                              setCurrentPage(1);
                              setIsPageSizeOpen(false);
                            }}
                            className={`relative w-full h-7 flex items-center justify-center px-2 rounded-lg text-xs tabular-nums transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 font-semibold'
                                : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <span>{size} / trang</span>
                            {isSelected && (
                              <Check className="w-3 h-3 text-brand-600 dark:text-brand-400 absolute right-1.5 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Portal>
                )}
              </div>

              <span className="hidden sm:block h-4 w-px bg-slate-200/90 dark:bg-slate-700/80" />

              {/* Các nút bấm phân trang (Basic Minimal) */}
              <div className="flex items-center gap-0.5">
                {/* Nút Đầu */}
                {totalPages > 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage <= 1}
                    className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Nút Trước */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Các số trang */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - validCurrentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span className="px-0.5 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[26px] h-7 px-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer flex items-center justify-center ${
                            p === validCurrentPage
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}

                {/* Nút Tiếp */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage >= totalPages}
                  className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title="Trang tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Nút Cuối */}
                {totalPages > 3 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage >= totalPages}
                    className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Modal Đăng Ký Khuôn Mặt 5 Góc ─────────────────────────── */}
      <FaceRegistrationModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        employee={selectedEmployee}
        user={selectedEmployee}
        onSuccess={() => {
          loadStatus();
          try {
            fetchMe();
          } catch (_) {}
          if (canManageOthers) searchEmployees(employeeSearch);
        }}
      />

      {/* ── 5. Popup Xem Chi Tiết Hồ Sơ Sinh Trắc Học Face ID ─────────── */}
      {detailEmployee && (() => {
        const isReg = detailFaceStatus ? Boolean(detailFaceStatus.da_dang_ky_face) : Boolean(detailEmployee.da_dang_ky_face);
        const faceImgUrl = detailFaceStatus?.anh_dai_dien || detailEmployee.anh_khuon_mat || null;
        const sampleQty = detailFaceStatus?.so_luong_mau ?? detailEmployee.so_luong_mau ?? (isReg ? 5 : 0);
        const aiModelName = detailFaceStatus?.mo_hinh_ai || detailEmployee.mo_hinh_ai || 'buffalo_s';
        const vectorDim = detailFaceStatus?.so_chieu_vector ?? (detailEmployee as any).so_chieu_vector ?? 512;
        const isDefaultFace = detailFaceStatus?.mac_dinh ?? (detailEmployee as any).mac_dinh ?? true;
        const faceStatusVal = detailFaceStatus?.trang_thai_khuon_mat || (detailEmployee as any).trang_thai_khuon_mat || (isReg ? 'hoat_dong' : null);
        const registeredAtRaw = detailFaceStatus?.ngay_dang_ky || detailEmployee.ngay_dang_ky_face || null;
        const registeredAtText = registeredAtRaw ? new Date(registeredAtRaw).toLocaleString('vi-VN') : 'Chưa cập nhật';
        const POSE_NAMES: Record<string, string> = {
          chinh_dien: 'Chính diện',
          nghieng_trai: 'Nghiêng trái',
          nghieng_phai: 'Nghiêng phải',
          ngua_len: 'Ngửa lên',
          cui_xuong: 'Cúi xuống',
        };
        const angles = detailFaceStatus?.cac_goc_chup?.length
          ? detailFaceStatus.cac_goc_chup
          : isReg
            ? ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'].slice(0, sampleQty || 5)
            : [];

        return (
        <Portal>
          <div
            onClick={() => setDetailEmployee(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
              {/* Header sáng gọn đồng bộ với trang */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar
                    name={detailEmployee.ho_ten}
                    avatarUrl={detailEmployee.anh_dai_dien}
                    staffCode={detailEmployee.ma_can_bo || detailEmployee.id}
                    size="md"
                    shape="circle"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {formatNameAndTitle(detailEmployee.ho_ten || '').name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      <span className="font-mono font-semibold text-brand-600 dark:text-brand-400 shrink-0">
                        {detailEmployee.ma_can_bo || 'CHƯA CẤP MÃ'}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="truncate">
                        {formatNameAndTitle(detailEmployee.ho_ten || '').title || getEmpDepartmentName(detailEmployee)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                      isReg
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {isReg ? (
                      <>
                        <Check className="w-3 h-3 shrink-0" />
                        <span>Đã có Face ID</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>Chưa đăng ký</span>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDetailEmployee(null)}
                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center transition-colors cursor-pointer"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nội dung chi tiết */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Hàng trên: Ảnh mẫu + Lưới 4 thông số AI */}
                <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-stretch">
                  <div className="w-32 h-32 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {loadingDetailFace ? (
                      <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                    ) : isReg && faceImgUrl ? (
                      <AnhBaoMat
                        src={faceImgUrl}
                        alt={detailEmployee.ho_ten}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="flex flex-col items-center gap-1 text-slate-400 p-3 text-center">
                            <ScanFace className="w-8 h-8 opacity-40" />
                            <span className="text-[10.5px] font-medium">Không tải được ảnh</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-400 p-3 text-center">
                        <ScanFace className="w-8 h-8 opacity-40" />
                        <span className="text-[10.5px] font-medium">
                          {isReg ? 'Chưa có ảnh xem trước' : 'Chưa có dữ liệu'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 w-full grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2.5 flex flex-col justify-center">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Trạng thái kích hoạt</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                        {isReg
                          ? `${faceStatusVal === 'bi_khoa' ? 'Tạm khóa' : 'Đã kích hoạt'} (${sampleQty} mẫu)`
                          : 'Chưa đăng ký mẫu'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2.5 flex flex-col justify-center">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Mô hình &amp; Vector AI</span>
                      <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                        {isReg ? `${aiModelName} · ${vectorDim}D` : 'Chưa kích hoạt'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2.5 flex flex-col justify-center">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Thời gian đăng ký</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5 tabular-nums truncate">
                        {isReg ? registeredAtText : 'Chưa đăng ký'}
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 px-3 py-2.5 flex flex-col justify-center">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Chuẩn mã hóa</span>
                      <span className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5 truncate">
                        {isReg ? 'AES-256-GCM' : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hàng 5 góc mặt: 1 hàng đều nhau */}
                {isReg && angles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Các góc khuôn mặt đã thu thập
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {angles.length}/5 góc
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {angles.map((angle, i) => (
                        <span
                          key={i}
                          className="h-7 px-2 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap"
                        >
                          <Check className="w-3 h-3 shrink-0" />
                          <span>{POSE_NAMES[angle] || angle}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Thông tin liên hệ nhân sự */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Đơn vị công tác</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5 block truncate" title={getEmpDepartmentName(detailEmployee)}>
                      {getEmpDepartmentName(detailEmployee)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Email công vụ</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5 block truncate" title={detailEmployee.email || ''}>
                      {detailEmployee.email || '—'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Mẫu mặc định</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-0.5 block">
                      {isReg ? (isDefaultFace ? 'Đang sử dụng' : 'Mẫu phụ') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer nút thao tác */}
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {(!authUser?.id || String(detailEmployee.id) !== String(authUser.id)) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailEmployee;
                          setDetailEmployee(null);
                          handleOpenEmployeeEnroll(target);
                        }}
                        className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{isReg ? 'Chụp lại 5 góc' : 'Đăng ký Face ID'}</span>
                      </button>
                      {isReg && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = detailEmployee;
                            setDetailEmployee(null);
                            handleDeleteEmployeeFace(target.id, target.ho_ten);
                          }}
                          className="h-8 px-3 rounded-lg border border-rose-200/90 dark:border-rose-800/60 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa mẫu Face ID</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailEmployee(null)}
                  className="h-8 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ml-auto"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
        );
      })()}

    </div>
  );
};

export default FaceRegistrationPage;
