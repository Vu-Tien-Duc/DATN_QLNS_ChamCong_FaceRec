import React, { useState, useEffect, useMemo } from 'react';
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
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { Portal } from '../../components/chung/CongDichChuyen';
import { TruongThongTin } from '../../components/chung/HoSoBenTrai';
import { AnhBaoMat } from '../../components/chung/AnhBaoMat';

export const FaceRegistrationPage: React.FC = () => {
  const { user: authUser, fetchMe } = useAuthStore();

  const [status, setStatus] = useState<RegistrationStatusResponse['data'] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [serviceHealth, setServiceHealth] = useState<{ status: string; face_service?: any } | null>(null);

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
    () => hasRole(authUser, ['admin', 'bgh', 'tccb']),
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
      const res = await apiClient.get<any>(`/nguoi-dung?gioi_han=200&tim_kiem=${encodeURIComponent(keyword)}`);
      const users = res.data?.data?.users || res.data?.users || res.data || [];
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
    setSelectedEmployee(emp);
    setIsEnrollModalOpen(true);
  };

  const handleOpenEmployeeDetail = async (emp: any) => {
    setDetailEmployee(emp);
    setDetailFaceStatus(null);
    const targetId = emp?._id || emp?.id;
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

    if (!window.confirm(`Xác nhận xóa sạch dữ liệu mẫu Face ID của "${targetName}" theo Nghị định 13/2023/NĐ-CP?`)) {
      return;
    }

    try {
      const res = await faceApi.deleteFaceData(targetId);
      if (res.success) {
        toast.success(`Đã xóa dữ liệu Face ID của ${targetName}`);
        if (canManageOthers) searchEmployees(employeeSearch);
        const currentUserId = authUser?._id || (authUser as any)?.id;
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

  // Helper lấy Avatar hồ sơ cá nhân (Avatar là riêng, không lấy facePhoto sinh trắc học)
  const getCleanAvatarUrl = (emp: any): string | null => {
    const raw = emp.avatar || emp.avatarUrl || emp.anh_dai_dien;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.includes('/faces/face-') || raw.includes('category=face-registration')) return null;
    return raw;
  };

  // Helper lấy ID đơn vị của nhân sự
  const getEmpDepartmentId = (emp: any): string => {
    const raw = emp.departmentId || emp.don_vi_chinh_id || emp.don_vi_id;
    if (!raw) return '';
    if (typeof raw === 'object') {
      return String(raw._id || raw.id || '');
    }
    return String(raw);
  };

  // Helper lấy tên hiển thị đơn vị chính xác theo bảng Departments
  const getEmpDepartmentName = (emp: any): string => {
    if (emp.departmentName && String(emp.departmentName).trim()) {
      return String(emp.departmentName).trim();
    }
    const deptId = getEmpDepartmentId(emp);
    if (deptId && departments.length > 0) {
      const found = departments.find((d) => String(d._id) === deptId);
      if (found) return found.name || (found as any).ten_phong_ban || 'Văn phòng / Ban';
    }
    if (typeof emp.departmentId === 'object' && emp.departmentId?.name) {
      return String(emp.departmentId.name);
    }
    return 'Văn phòng / Ban';
  };

  // Lọc danh sách nhân viên theo Tab và Khoa/Bộ môn
  const filteredEmployees = useMemo(() => {
    return employeeList.filter((emp) => {
      // 1. Lọc theo trạng thái Face ID
      const isReg = Boolean(emp.isFaceRegistered);
      if (filterTab === 'registered' && !isReg) return false;
      if (filterTab === 'not_registered' && isReg) return false;

      // 2. Lọc theo Khoa / Bộ môn
      if (departmentFilter !== 'ALL') {
        const empDeptId = getEmpDepartmentId(emp);
        const selectedDept = departments.find((d) => String(d._id) === String(departmentFilter));
        const isBghFilter = selectedDept
          ? String(selectedDept.type || selectedDept.loai_don_vi || '').toLowerCase().includes('bgh') ||
            String(selectedDept.name || '').toLowerCase().includes('giám hiệu')
          : false;

        if (isBghFilter) {
          const isUserBgh = String(emp.role || '').toLowerCase().includes('bgh') || empDeptId === departmentFilter;
          if (!isUserBgh) return false;
        } else {
          // Khớp trực tiếp đơn vị
          const matchesDirect = empDeptId === departmentFilter;

          // Khớp đơn vị cha (khi lọc theo Khoa mà cán bộ thuộc Bộ môn trực thuộc)
          const empDept = departments.find((d) => String(d._id) === empDeptId);
          const empParentId = empDept?.parentId
            ? typeof empDept.parentId === 'object' && empDept.parentId !== null && '_id' in empDept.parentId
              ? String((empDept.parentId as any)._id)
              : String(empDept.parentId)
            : '';
          const matchesParent = Boolean(empParentId && empParentId === departmentFilter);

          // Khớp roles phân quyền
          const matchesRoles = Array.isArray(emp.roles) && emp.roles.some((r: any) => {
            const rDept = r.departmentId || r.don_vi_id;
            if (!rDept) return false;
            const rId = typeof rDept === 'object' && rDept !== null && '_id' in rDept ? String(rDept._id) : String(rDept);
            return rId === departmentFilter;
          });

          if (!matchesDirect && !matchesParent && !matchesRoles) {
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
      const deptName =
        emp.departmentName ||
        (typeof emp.departmentId === 'object' ? emp.departmentId?.name : null) ||
        'Văn phòng / Ban';
      if (!map.has(deptName)) {
        map.set(deptName, []);
      }
      map.get(deptName)!.push(emp);
    });

    return Array.from(map.entries()).map(([deptName, members]) => {
      const registeredCount = members.filter((m) => Boolean(m.isFaceRegistered)).length;
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
  }, [paginatedEmployees]);

  const totalRegisteredCount = useMemo(() => {
    return employeeList.filter((e) => Boolean(e.isFaceRegistered)).length;
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
      const dataRows = filteredEmployees.map((emp, i) => {
        const { name } = formatNameAndTitle(emp.fullName || '');
        const deptName = getEmpDepartmentName(emp);
        const isReg = Boolean(emp.isFaceRegistered);
        const posesCount = emp.faceSamplesCount || (emp.faceDescriptors ? emp.faceDescriptors.length : isReg ? 5 : 0);
        const registeredAt = emp.faceRegisteredAt ? new Date(emp.faceRegisteredAt).toLocaleDateString('vi-VN') : (isReg ? 'Đã lưu mẫu' : '--');

        return {
          'STT': i + 1,
          'Mã Cán Bộ': emp.staffCode || emp.ma_can_bo || '--',
          'Họ Và Tên': name,
          'Khoa / Phòng Ban': deptName,
          'Chức Vụ': emp.position || emp.chuc_vu || '--',
          'Email Công Vụ': emp.email || '--',
          'Số Điện Thoại': emp.phoneNumber || emp.phone || '--',
          'Trạng Thái Face ID': isReg ? 'Đã kích hoạt' : 'Chưa đăng ký',
          'Số Góc Mặt Đã Thu Thập': isReg ? `${posesCount}/5 góc` : '0/5 góc',
          'Chuẩn Trích Xuất': isReg ? 'InsightFace 512D' : '--',
          'Ngày Đăng Ký Mẫu': registeredAt,
          'Trạng Thái Tài Khoản': emp.isActive !== false ? 'Đang hoạt động' : 'Đã khóa',
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

      XLSX.writeFile(wb, `Danh_Sach_Face_ID_NTU_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Đã xuất Danh sách Face ID (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất Danh sách Face ID:', err);
      toast.error('Lỗi khi đóng gói tệp Excel.');
    }
  };

  const totalEmployeesCount = employeeList.length || 0;
  const coveragePercent = totalEmployeesCount > 0 ? Math.round((totalRegisteredCount / totalEmployeesCount) * 100) : 0;

  return (
    <div className="w-full space-y-5 animate-fadeIn pb-16">
      {/* ── 1. Header Trang: Chuẩn hóa PageHeader ───────────────────────── */}
      <PageHeader
        title="Đăng Ký & Quản Lý Face ID"
        subtitle="Hệ thống nhận diện sinh trắc học khuôn mặt đa góc ArcFace 512 chiều phục vụ điểm danh thời gian thực."
        icon={<Camera className="w-5 h-5" />}
        badge="INSIGHTFACE 512D"
        badgeVariant="brand"
        actions={
          <>
            <div className="h-9 flex items-center gap-1.5 px-3 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span
                className={`w-2 h-2 rounded-full ${serviceHealth?.status === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}
              />
              <span className="text-slate-600 dark:text-slate-300">
                {serviceHealth?.status === 'ok' ? 'AI Sẵn sàng' : 'Chưa kết nối AI'}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportFaceExcel}
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất danh sách đăng ký Face ID ra file Excel (.xlsx)"
            >
              <span className="hidden sm:inline">Xuất Excel (.xlsx)</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                loadStatus();
                loadHealth();
                if (canManageOthers) searchEmployees(employeeSearch);
              }}
              disabled={loading}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              title="Làm mới trạng thái dữ liệu"
            >
              Làm mới
            </Button>
          </>
        }
      />

      {/* ── 2. KHUNG QUẢN LÝ FACE ID THỐNG NHẤT: KPI + TOOLBAR + DANH SÁCH ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden w-full">
        <CompactStatsBar
          embedded
          items={[
            {
              label: 'Tổng Cán Bộ / GV',
              value: totalEmployeesCount,
              unit: 'nhân sự',
              tone: 'neutral',
              active: filterTab === 'all',
              onClick: () => {
                setFilterTab('all');
                setCurrentPage(1);
              },
            },
            {
              label: 'Đã Có Face ID',
              value: totalRegisteredCount,
              tone: 'success',
              active: filterTab === 'registered',
              onClick: () => {
                setFilterTab('registered');
                setCurrentPage(1);
              },
            },
            {
              label: 'Chưa Đăng Ký',
              value: Math.max(0, totalEmployeesCount - totalRegisteredCount),
              tone: 'warning',
              active: filterTab === 'not_registered',
              onClick: () => {
                setFilterTab('not_registered');
                setCurrentPage(1);
              },
            },
            {
              label: 'Tỷ Lệ Bao Phủ',
              value: `${coveragePercent}%`,
              badge: '512D',
              tone: 'brand',
            },
          ]}
        />
        <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={employeeSearch}
              onChange={(e) => {
                setEmployeeSearch(e.target.value);
                setCurrentPage(1);
                searchEmployees(e.target.value);
              }}
              placeholder="Tìm tên, mã CB, email..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-white focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Bộ lọc Khoa / Bộ môn */}
          <div className="w-full sm:w-56">
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

          {/* Bộ lọc Tab trạng thái */}
          <div className="flex items-center gap-1 text-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setFilterTab('all');
                setCurrentPage(1);
              }}
              className={`h-9 px-3 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-700'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Tất cả ({totalEmployeesCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('registered');
                setCurrentPage(1);
              }}
              className={`h-9 px-3 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'registered'
                  ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-700'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Đã có ({totalRegisteredCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterTab('not_registered');
                setCurrentPage(1);
              }}
              className={`h-9 px-3 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                filterTab === 'not_registered'
                  ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-700'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Chưa có ({Math.max(0, totalEmployeesCount - totalRegisteredCount)})
            </button>
          </div>

          {/* Bộ chọn Bố Cục Hiển Thị */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl shrink-0 border border-slate-200/70 dark:border-slate-700/70 ml-auto">
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Bảng chi tiết"
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Thẻ lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Thẻ lưới</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Tinh gọn"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tinh gọn</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('department')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'department'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Dạng Theo Khoa / Đơn vị"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Theo Khoa</span>
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
            /* ── CHẾ ĐỘ 1: BẢNG CHI TIẾT (TABLE VIEW) ── */
            <>
              {/* Header Bảng: 5 Cột Tách Biệt */}
              <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1.2fr_140px_145px] gap-3 sm:gap-4 px-4 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
                <div className="min-w-0">Cán bộ / Giảng viên</div>
                <div className="min-w-0">Mã CB / Email</div>
                <div className="min-w-0">Khoa / Đơn vị</div>
                <div className="text-center">Trạng thái Face ID</div>
                <div className="text-right">Thao tác</div>
              </div>

              {/* Body Danh Sách */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedEmployees.map((emp) => {
                  const isRegistered = Boolean(emp.isFaceRegistered);
                  const parsed = formatNameAndTitle(emp.fullName || '');
                  const staffCodeVal = emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                  const deptNameVal = emp.departmentName || (typeof emp.departmentId === 'object' ? emp.departmentId?.name : null) || 'Văn phòng / Ban';
                  const avatarUrl = getCleanAvatarUrl(emp);
                  const initials = getUserInitials(emp.fullName);

                  return (
                    <div
                      key={emp._id}
                      className="p-3.5 sm:px-4 sm:py-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:grid sm:grid-cols-[1.5fr_1fr_1.2fr_140px_145px] gap-2.5 sm:gap-4 items-start sm:items-center w-full min-w-0"
                    >
                      {/* Cột 1: Cán bộ / Giảng viên */}
                      <div className="w-full sm:w-auto min-w-0 flex items-center justify-between sm:justify-start gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <UserAvatar
                            name={emp.fullName}
                            avatarUrl={emp.avatar || emp.avatarUrl || emp.anh_dai_dien}
                            staffCode={emp.staffCode || emp._id}
                            size="sm"
                            shape="rounded"
                          />
                          <div className="flex flex-col min-w-0 flex-1 leading-snug">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm truncate block" title={parsed.name}>
                              {parsed.name}
                            </span>
                            {parsed.title && (
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate block" title={parsed.title}>
                                {parsed.title}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Trên Mobile hiển thị Mã CB bên phải Avatar */}
                        <span className="sm:hidden font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/70 shrink-0">
                          {staffCodeVal}
                        </span>
                      </div>

                      {/* Cột 2: Mã CB / Email */}
                      <div className="hidden sm:flex min-w-0 flex-col gap-0.5 leading-snug">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded-md inline-block w-fit tracking-wide border border-slate-200/70 dark:border-slate-700/70">
                          {staffCodeVal}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block" title={emp.email}>
                          {emp.email}
                        </span>
                      </div>

                      {/* Cột 3: Khoa / Đơn vị */}
                      <div className="w-full sm:w-auto min-w-0 flex items-center">
                        <span
                          className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium text-xs bg-slate-100/90 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 max-w-full min-w-0"
                          title={deptNameVal}
                        >
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{deptNameVal}</span>
                        </span>
                      </div>

                      {/* Cột 4: Trạng thái Face ID */}
                      <div className="w-full sm:w-auto min-w-0 flex items-center justify-between sm:justify-center shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 ${
                            isRegistered
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isRegistered ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Đã Có Face ID</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                              <span>Chưa Đăng Ký</span>
                            </>
                          )}
                        </span>

                        {/* Trên mobile hiển thị cụm nút tại đây */}
                        <div className="sm:hidden flex items-center gap-1.5">
                          {isRegistered ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEmployeeEnroll(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200"
                              >
                                <RefreshCw className="w-3 h-3 text-slate-500" />
                                <span>Chụp lại</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEmployeeFace(emp._id || emp.id, emp.fullName)}
                                className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600"
                                title="Xóa mẫu khuôn mặt"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeEnroll(emp)}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200"
                            >
                              <Camera className="w-3 h-3 text-brand-600" />
                              <span>Đăng ký Face ID</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cột 5: Thao tác */}
                      <div className="hidden sm:flex items-center justify-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEmployeeDetail(emp)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                          title="Xem chi tiết hồ sơ sinh trắc học"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isRegistered ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEmployeeEnroll(emp)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
                              title="Chụp lại mẫu khuôn mặt đa góc"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                              <span>Chụp lại</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteEmployeeFace(emp._id || emp.id, emp.fullName)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:border-rose-800/60 transition-all duration-150 shadow-2xs cursor-pointer shrink-0"
                              title="Xóa mẫu khuôn mặt theo NĐ 13/2023"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenEmployeeEnroll(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/60 border border-brand-200/80 dark:border-brand-800/70 transition-all duration-150 shadow-2xs hover:shadow-xs active:scale-[0.98] cursor-pointer whitespace-nowrap"
                          >
                            <Camera className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
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
                const isRegistered = Boolean(emp.isFaceRegistered);
                const parsed = formatNameAndTitle(emp.fullName || '');
                const staffCodeVal = emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = emp.departmentName || (typeof emp.departmentId === 'object' ? emp.departmentId?.name : null) || 'Văn phòng / Ban';
                const avatarUrl = getCleanAvatarUrl(emp);
                const initials = getUserInitials(emp.fullName);

                return (
                  <div
                    key={emp._id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            name={emp.fullName}
                            avatarUrl={emp.avatar || emp.avatarUrl || emp.anh_dai_dien}
                            staffCode={emp.staffCode || emp._id}
                            size="lg"
                            shape="rounded"
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
                      {isRegistered ? (
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
                            onClick={() => handleDeleteEmployeeFace(emp._id || emp.id, emp.fullName)}
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
                const isRegistered = Boolean(emp.isFaceRegistered);
                const parsed = formatNameAndTitle(emp.fullName || '');
                const staffCodeVal = emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                const deptNameVal = emp.departmentName || (typeof emp.departmentId === 'object' ? emp.departmentId?.name : null) || 'Văn phòng / Ban';
                const avatarUrl = getCleanAvatarUrl(emp);
                const initials = getUserInitials(emp.fullName);

                return (
                  <div
                    key={emp._id}
                    className="px-3.5 py-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    {/* Bên trái: Avatar nhỏ, Tên, Mã, Đơn vị */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <UserAvatar
                        name={emp.fullName}
                        avatarUrl={emp.avatar || emp.avatarUrl || emp.anh_dai_dien}
                        staffCode={emp.staffCode || emp._id}
                        size="xs"
                        shape="rounded"
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
                        {isRegistered ? (
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
                              onClick={() => handleDeleteEmployeeFace(emp._id || emp.id, emp.fullName)}
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
                          const isRegistered = Boolean(emp.isFaceRegistered);
                          const parsed = formatNameAndTitle(emp.fullName || '');
                          const staffCodeVal = emp.staffCode || (emp._id ? `CB-${emp._id.slice(-4).toUpperCase()}` : '—');
                          const avatarUrl = getCleanAvatarUrl(emp);
                          const initials = getUserInitials(emp.fullName);

                          return (
                            <div
                              key={emp._id}
                              className="p-3 sm:px-4 sm:py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <UserAvatar
                                  name={emp.fullName}
                                  avatarUrl={emp.avatar || emp.avatarUrl || emp.anh_dai_dien}
                                  staffCode={emp.staffCode || emp._id}
                                  size="sm"
                                  shape="rounded"
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

                                {isRegistered ? (
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
                                      onClick={() => handleDeleteEmployeeFace(emp._id || emp.id, emp.fullName)}
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {/* Hiển thị phạm vi bản ghi */}
            <div className="flex items-center gap-2">
              <span>
                Hiển thị <strong className="text-slate-900 dark:text-white">{(validCurrentPage - 1) * pageSize + 1}</strong> -{' '}
                <strong className="text-slate-900 dark:text-white">{Math.min(validCurrentPage * pageSize, totalFilteredCount)}</strong> trên tổng số{' '}
                <strong className="text-brand-600 dark:text-brand-400">{totalFilteredCount}</strong> nhân sự
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Chọn số dòng trên mỗi trang */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]">Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>

              {/* Các nút bấm phân trang */}
              <div className="flex items-center gap-1">
                {/* Nút Đầu */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Nút Trước */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
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
                        {hasGap && <span className="px-1 text-slate-400">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                            p === validCurrentPage
                              ? 'bg-brand-600 text-white shadow-xs'
                              : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
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
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang tiếp"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Nút Cuối */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={validCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
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
        const isReg = detailFaceStatus ? Boolean(detailFaceStatus.isFaceRegistered) : Boolean(detailEmployee.isFaceRegistered);
        const faceImgUrl = detailFaceStatus?.facePhoto || detailEmployee.facePhoto || detailEmployee.anh_khuon_mat || null;
        const sampleQty = detailFaceStatus?.sampleCount ?? detailEmployee.sampleCount ?? detailEmployee.so_luong_mau ?? (isReg ? 5 : 0);
        const aiModelName = detailFaceStatus?.embeddingModel || detailEmployee.mo_hinh_ai || 'buffalo_s';
        const vectorDim = detailFaceStatus?.vectorDimension ?? (detailEmployee as any).vectorDimension ?? (detailEmployee as any).so_chieu_vector ?? 512;
        const isDefaultFace = detailFaceStatus?.isDefaultFace ?? (detailEmployee as any).isDefaultFace ?? true;
        const faceStatusVal = detailFaceStatus?.faceStatus || (detailEmployee as any).faceStatus || (isReg ? 'hoat_dong' : null);
        const registeredAtRaw = detailFaceStatus?.faceRegisteredAt || detailEmployee.faceRegisteredAt || null;
        const registeredAtText = registeredAtRaw ? new Date(registeredAtRaw).toLocaleString('vi-VN') : 'Chưa cập nhật';
        const POSE_NAMES: Record<string, string> = {
          chinh_dien: 'Chính diện',
          nghieng_trai: 'Nghiêng trái',
          nghieng_phai: 'Nghiêng phải',
          ngua_len: 'Ngửa lên',
          cui_xuong: 'Cúi xuống',
        };
        const angles = detailFaceStatus?.sampleAngles?.length
          ? detailFaceStatus.sampleAngles
          : isReg
            ? ['chinh_dien', 'nghieng_trai', 'nghieng_phai', 'ngua_len', 'cui_xuong'].slice(0, sampleQty || 5)
            : [];

        return (
        <Portal>
          <div
            onClick={() => setDetailEmployee(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <UserAvatar
                    name={detailEmployee.fullName}
                    avatarUrl={detailEmployee.avatar}
                    staffCode={detailEmployee.staffCode || detailEmployee._id}
                    size="lg"
                    shape="rounded"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-mono font-bold text-slate-200">
                        {detailEmployee.staffCode || 'CHƯA CẤP MÃ'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          isReg
                            ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                            : 'bg-amber-500/20 border border-amber-400/30 text-amber-300'
                        }`}
                      >
                        {isReg ? 'ĐÃ ĐĂNG KÝ FACE ID' : 'CHƯA ĐĂNG KÝ'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1 truncate">
                      {formatNameAndTitle(detailEmployee.fullName || '').name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">
                      {formatNameAndTitle(detailEmployee.fullName || '').title || getEmpDepartmentName(detailEmployee)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailEmployee(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs">
                {/* Ảnh sinh trắc học + Thông số Face ID */}
                <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                  <div className="w-36 h-36 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {loadingDetailFace ? (
                      <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                    ) : isReg && faceImgUrl ? (
                      <AnhBaoMat
                        src={faceImgUrl}
                        alt={detailEmployee.fullName}
                        className="w-full h-full object-cover"
                        fallback={
                          <div className="flex flex-col items-center gap-1.5 text-slate-400 p-3 text-center">
                            <ScanFace className="w-9 h-9 opacity-40" />
                            <span className="text-[11px] font-medium">Không tải được ảnh xem trước</span>
                          </div>
                        }
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400 p-3 text-center">
                        <ScanFace className="w-9 h-9 opacity-40" />
                        <span className="text-[11px] font-medium">
                          {isReg ? 'Chưa có ảnh xem trước' : 'Chưa có dữ liệu'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 w-full space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
                      <TruongThongTin
                        label="Trạng thái kích hoạt"
                        value={
                          isReg
                            ? `${faceStatusVal === 'bi_khoa' ? 'Tạm khóa' : 'Đã kích hoạt'} (${sampleQty} mẫu)`
                            : 'Chưa đăng ký mẫu'
                        }
                      />
                      <TruongThongTin
                        label="Mô hình & Vector AI"
                        value={isReg ? `${aiModelName} • ${vectorDim} chiều${isDefaultFace ? ' (Mặc định)' : ''}` : 'Chưa kích hoạt'}
                        mono={isReg}
                      />
                      <TruongThongTin label="Thời gian đăng ký" value={isReg ? registeredAtText : 'Chưa đăng ký'} />
                      <TruongThongTin label="Chuẩn mã hóa lưu trữ" value={isReg ? 'AES-256-GCM' : '—'} mono={isReg} />
                    </div>

                    {isReg && angles.length > 0 && (
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1.5">
                          Các góc khuôn mặt đã thu thập
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {angles.map((angle, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70"
                            >
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>{POSE_NAMES[angle] || angle}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                  <TruongThongTin label="Mã cán bộ" value={detailEmployee.staffCode || '—'} mono />
                  <TruongThongTin label="Đơn vị công tác" value={getEmpDepartmentName(detailEmployee)} />
                  <TruongThongTin label="Email công vụ" value={detailEmployee.email || '—'} />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailEmployee;
                      setDetailEmployee(null);
                      handleOpenEmployeeEnroll(target);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold cursor-pointer shadow-sm"
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
                        handleDeleteEmployeeFace(target._id || target.id, target.fullName);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa mẫu Face ID</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailEmployee(null)}
                  className="px-5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-auto"
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
