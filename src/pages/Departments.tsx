import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Users as UsersIcon,
  BookOpen,
  MapPin,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  ShieldCheck,
  Layers,
  Network,
  LayoutGrid,
  ListFilter,
  UserCheck,
  AlertCircle,
  Eye,
  X,
  Compass,
  GraduationCap,
  Briefcase,
  FolderTree,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { departmentApi } from '../api/department.api';
import { userApi, UserListResponse } from '../api/user.api';
import {
  DepartmentItem,
  DepartmentType,
  UserProfile,
} from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// =============================================================================
// HELPERS & CONSTANTS
// =============================================================================

const UNIT_TYPE_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    badgeVariant: 'info' | 'purple' | 'success' | 'neutral';
    borderClass: string;
    iconBgClass: string;
    description: string;
  }
> = {
  khoa: {
    label: 'Khoa Đào Tạo',
    shortLabel: 'Khoa',
    badgeVariant: 'info',
    borderClass: 'border-l-brand-500',
    iconBgClass: 'bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border-brand-200/60 dark:border-brand-800/50',
    description: 'Đơn vị chuyên môn cấp trường trực thuộc Ban Giám Hiệu, quản lý các Bộ môn và Giảng viên.',
  },
  bomon: {
    label: 'Bộ Môn Chuyên Môn',
    shortLabel: 'Bộ môn',
    badgeVariant: 'purple',
    borderClass: 'border-l-indigo-500',
    iconBgClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/50',
    description: 'Đơn vị chuyên môn sâu trực thuộc một Khoa đào tạo.',
  },
  phongban: {
    label: 'Phòng Ban Chức Năng',
    shortLabel: 'Phòng ban',
    badgeVariant: 'success',
    borderClass: 'border-l-emerald-500',
    iconBgClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50',
    description: 'Đơn vị hành chính, quản trị, trung tâm phục vụ trực thuộc Ban Giám Hiệu.',
  },
};

function resolveAvatarUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function getInitials(name?: string): string {
  if (!name) return 'ĐV';
  const cleaned = name.replace(/\(.*?\)/g, '').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ĐV';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function splitNameAndTitle(rawName?: string): { cleanName: string; title: string | null } {
  if (!rawName) return { cleanName: 'Chưa bổ nhiệm', title: null };
  const match = rawName.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (match) {
    return { cleanName: match[1].trim(), title: match[2].trim() };
  }
  return { cleanName: rawName.trim(), title: null };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Departments: React.FC = () => {
  const { user } = useAuthStore();
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';

  // View Mode: 'tree' (Sơ đồ phân cấp Khoa -> Bộ môn) | 'grid' (Thẻ lưới) | 'table' (Bảng phân trang)
  const [viewMode, setViewMode] = useState<'tree' | 'grid' | 'table'>('tree');

  // Data States
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'ALL' | DepartmentType>('ALL');
  const [selectedParentFacultyId, setSelectedParentFacultyId] = useState<string>('');

  // Tree Accordion Expanded State (Set of Faculty IDs)
  const [expandedFacultyIds, setExpandedFacultyIds] = useState<Record<string, boolean>>({});

  // Table Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentItem | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentItem | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form Data
  const [formData, setFormData] = useState<{
    name: string;
    type: DepartmentType;
    parentId: string;
    managerId: string;
    latitude: string;
    longitude: string;
    radiusMeters: number;
  }>({
    name: '',
    type: 'khoa',
    parentId: '',
    managerId: '',
    latitude: '21.028511',
    longitude: '105.804817',
    radiusMeters: 200,
  });

  // =============================================================================
  // FETCH DATA
  // =============================================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, usersRes] = await Promise.all([
        departmentApi.getDepartmentsFlat(),
        userApi.getUsers({ limit: 300 }).catch(() => ({ data: [] })),
      ]);

      let deptList: DepartmentItem[] = [];
      if (deptRes?.data && Array.isArray(deptRes.data)) {
        deptList = deptRes.data;
      }
      setDepartments(deptList);

      // Expand all faculties by default on first load
      const initialExpanded: Record<string, boolean> = {};
      deptList.forEach((d) => {
        if (d.type === 'khoa') {
          initialExpanded[d._id] = true;
        }
      });
      setExpandedFacultyIds((prev) => (Object.keys(prev).length > 0 ? prev : initialExpanded));

      let userList: UserProfile[] = [];
      if (usersRes?.data) {
        if (Array.isArray(usersRes.data)) {
          userList = usersRes.data;
        } else if ('users' in usersRes.data && Array.isArray((usersRes.data as UserListResponse).users)) {
          userList = (usersRes.data as UserListResponse).users;
        }
      }
      setAllUsers(userList);
    } catch (err: any) {
      console.error('Error loading departments:', err);
      toast.error('Không thể tải dữ liệu Khoa & Phòng ban');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, selectedType, selectedParentFacultyId]);

  // =============================================================================
  // COMPUTED DATA & HIERARCHY
  // =============================================================================

  // List of all Faculties ('khoa') for parent selection and filtering
  const faculties = useMemo(
    () => departments.filter((d) => d.type === 'khoa').sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [departments]
  );

  // Map of child 'bomon' by parent 'khoa' ID
  const childrenByFacultyId = useMemo(() => {
    const map: Record<string, DepartmentItem[]> = {};
    departments.forEach((d) => {
      if (d.type === 'bomon' && d.parentId) {
        const pId = typeof d.parentId === 'object' ? d.parentId._id : d.parentId;
        if (pId) {
          if (!map[pId]) map[pId] = [];
          map[pId].push(d);
        }
      }
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    return map;
  }, [departments]);

  // Calculate total staff of a department (including child bomon if it's a khoa)
  const getAggregateStats = useCallback(
    (dept: DepartmentItem) => {
      const directMembers = dept.memberCount || 0;
      const directSubjects = dept.subjectCount || 0;
      if (dept.type !== 'khoa') {
        return {
          directMembers,
          totalMembers: directMembers,
          totalSubjects: directSubjects,
          childCount: 0,
        };
      }
      const children = childrenByFacultyId[dept._id] || [];
      const childMembers = children.reduce((sum, c) => sum + (c.memberCount || 0), 0);
      const childSubjects = children.reduce((sum, c) => sum + (c.subjectCount || 0), 0);
      return {
        directMembers,
        totalMembers: directMembers + childMembers,
        totalSubjects: directSubjects + childSubjects,
        childCount: children.length,
      };
    },
    [childrenByFacultyId]
  );

  // Filtered flat list for Grid & Table views
  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (selectedType !== 'ALL' && d.type !== selectedType) return false;

      if (selectedParentFacultyId) {
        const pId = typeof d.parentId === 'object' ? d.parentId?._id : d.parentId;
        if (d._id !== selectedParentFacultyId && pId !== selectedParentFacultyId) {
          return false;
        }
      }

      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const nameMatch = d.name?.toLowerCase().includes(kw);
        const managerName =
          typeof d.managerId === 'object' ? d.managerId?.fullName?.toLowerCase() || '' : '';
        const managerCode =
          typeof d.managerId === 'object' ? d.managerId?.staffCode?.toLowerCase() || '' : '';
        const parentName =
          typeof d.parentId === 'object' ? d.parentId?.name?.toLowerCase() || '' : '';
        return (
          nameMatch ||
          managerName.includes(kw) ||
          managerCode.includes(kw) ||
          parentName.includes(kw)
        );
      }

      return true;
    });
  }, [departments, selectedType, selectedParentFacultyId, searchKeyword]);

  // Paginated list for Table view
  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / pageSize));
  const paginatedDepartments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDepartments.slice(start, start + pageSize);
  }, [filteredDepartments, currentPage, pageSize]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = departments.length;
    const khoaCount = departments.filter((d) => d.type === 'khoa').length;
    const bomonCount = departments.filter((d) => d.type === 'bomon').length;
    const phongbanCount = departments.filter((d) => d.type === 'phongban').length;
    const assignedManagers = departments.filter((d) => Boolean(d.managerId)).length;
    return { total, khoaCount, bomonCount, phongbanCount, assignedManagers };
  }, [departments]);

  // Eligible managers for dropdown (exclude admin per backend rule)
  const eligibleManagers = useMemo(() => {
    return allUsers.filter((u) => u.isActive !== false && (u.role || '').toLowerCase() !== 'admin');
  }, [allUsers]);

  // Members belonging to selectedDept (including child bomon if selectedDept is a khoa)
  const selectedDeptMembers = useMemo(() => {
    if (!selectedDept) return [];
    const childIds = new Set(
      (childrenByFacultyId[selectedDept._id] || []).map((c) => c._id)
    );
    return allUsers.filter((u) => {
      const uDeptId = typeof u.departmentId === 'object' ? u.departmentId?._id : u.departmentId;
      if (!uDeptId) return false;
      return uDeptId === selectedDept._id || childIds.has(uDeptId);
    });
  }, [selectedDept, allUsers, childrenByFacultyId]);

  // =============================================================================
  // MODAL & CRUD HANDLERS
  // =============================================================================

  const openCreateModal = (presetType: DepartmentType = 'khoa', presetParentId = '') => {
    setIsEditing(false);
    setSelectedDept(null);
    setFormData({
      name: '',
      type: presetType,
      parentId: presetType === 'bomon' ? presetParentId || faculties[0]?._id || '' : '',
      managerId: '',
      latitude: '21.007051',
      longitude: '105.824812',
      radiusMeters: 200,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (dept: DepartmentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setSelectedDept(dept);

    const pId = typeof dept.parentId === 'object' ? dept.parentId?._id || '' : dept.parentId || '';
    const mId = typeof dept.managerId === 'object' ? dept.managerId?._id || '' : dept.managerId || '';
    const lat = dept.latitude ?? dept.location?.latitude ?? dept.location?.lat ?? '';
    const lng = dept.longitude ?? dept.location?.longitude ?? dept.location?.lng ?? '';

    setFormData({
      name: dept.name || '',
      type: (dept.type as DepartmentType) || 'khoa',
      parentId: pId,
      managerId: mId,
      latitude: lat !== null && lat !== undefined ? String(lat) : '',
      longitude: lng !== null && lng !== undefined ? String(lng) : '',
      radiusMeters: dept.radiusMeters || 200,
    });
    setIsFormModalOpen(true);
  };

  const openDetailModal = (dept: DepartmentItem) => {
    setSelectedDept(dept);
    setIsDetailModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên đơn vị');
      return;
    }
    if (formData.type === 'bomon' && !formData.parentId) {
      toast.error('Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo');
      return;
    }

    setSubmitting(true);
    try {
      const latNum = formData.latitude.trim() !== '' ? Number(formData.latitude) : null;
      const lngNum = formData.longitude.trim() !== '' ? Number(formData.longitude) : null;

      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        parentId: formData.type === 'bomon' ? formData.parentId : null,
        managerId: formData.managerId || null,
        latitude: latNum,
        longitude: lngNum,
        radiusMeters: Number(formData.radiusMeters) || 200,
        location: {
          lat: latNum,
          lng: lngNum,
        },
      };

      if (isEditing && selectedDept) {
        await departmentApi.updateDepartment(selectedDept._id, payload);
        toast.success('Cập nhật đơn vị thành công');
      } else {
        await departmentApi.createDepartment(payload);
        toast.success('Thêm mới đơn vị thành công');
      }

      setIsFormModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Thao tác thất bại';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await departmentApi.deleteDepartment(deleteTarget._id);
      toast.success(`Đã xóa đơn vị "${deleteTarget.name}"`);
      setDeleteTarget(null);
      if (selectedDept?._id === deleteTarget._id) {
        setIsDetailModalOpen(false);
      }
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể xóa đơn vị này';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderManagerBadge = (dept: DepartmentItem) => {
    const mgr = typeof dept.managerId === 'object' ? dept.managerId : null;
    if (!mgr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
          <UserCheck className="w-3.5 h-3.5 opacity-50" />
          Chưa bổ nhiệm trưởng đơn vị
        </span>
      );
    }
    const avatarUrl = resolveAvatarUrl(mgr.avatarUrl);
    const { cleanName } = splitNameAndTitle(mgr.fullName);

    return (
      <div className="flex items-center gap-2 min-w-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={cleanName}
            className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {getInitials(cleanName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
            {cleanName}
          </p>
          {mgr.staffCode && (
            <p className="text-[10px] font-mono text-slate-400 truncate">{mgr.staffCode}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Cơ Cấu Tổ Chức: Khoa & Phòng Ban
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quản lý cây phân cấp Khoa đào tạo, Bộ môn trực thuộc, Phòng ban chức năng và tọa độ Geofence chấm công (CSDL v2.5).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadData}
          >
            Làm mới
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FolderTree className="w-4 h-4 text-indigo-500" />}
                onClick={() => openCreateModal('bomon')}
              >
                Thêm Bộ Môn
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => openCreateModal('khoa')}
              >
                Thêm Khoa / Phòng Ban
              </Button>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          EXECUTIVE KPI METRIC CARDS
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng Đơn Vị Tổ Chức</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stats.assignedManagers}/{stats.total} đã bổ nhiệm Trưởng ĐV
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
              <Network className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Khoa Đào Tạo (Cấp 1)</p>
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.khoaCount}</p>
              <p className="text-xs text-brand-600/80 dark:text-brand-400/80 font-medium">
                Trực thuộc Ban Giám Hiệu
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Bộ Môn Chuyên Môn (Cấp 2)</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.bomonCount}</p>
              <p className="text-xs text-indigo-500 font-medium">Trực thuộc các Khoa đào tạo</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80 hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Phòng Ban Chức Năng</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.phongbanCount}</p>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-medium">
                Khối Hành chính & Trung tâm
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          UNIFIED FILTER & VIEW SWITCHER TOOLBAR
         ========================================================================= */}
      <Card className="border-slate-200/80 dark:border-slate-800/80">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tên Khoa, Bộ môn, Phòng ban, tên Trưởng đơn vị..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                Sơ Đồ Phân Cấp
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Thẻ Lưới
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Dạng Bảng
              </button>
            </div>
          </div>

          {/* Filter Pills & Faculty Filter */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: `Tất cả (${stats.total})` },
                  { id: 'khoa', label: `Khoa đào tạo (${stats.khoaCount})` },
                  { id: 'bomon', label: `Bộ môn (${stats.bomonCount})` },
                  { id: 'phongban', label: `Phòng ban (${stats.phongbanCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedType(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedType === tab.id
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Khoa chủ quản:</span>
                <select
                  value={selectedParentFacultyId}
                  onChange={(e) => setSelectedParentFacultyId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Tất cả các Khoa</option>
                  {faculties.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {(searchKeyword || selectedType !== 'ALL' || selectedParentFacultyId) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-rose-500 hover:text-rose-600"
                  onClick={() => {
                    setSearchKeyword('');
                    setSelectedType('ALL');
                    setSelectedParentFacultyId('');
                  }}
                >
                  Đặt lại bộ lọc
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================================================================
          VIEW 1: SƠ ĐỒ CÂY PHÂN CẤP TỔ CHỨC (ORGANIZATION TREE HIERARCHY VIEW)
         ========================================================================= */}
      {viewMode === 'tree' && (
        <div className="space-y-6">
          {/* SECTION A: KHỐI KHOA ĐÀO TẠO & CÁC BỘ MÔN TRỰC THUỘC */}
          {(selectedType === 'ALL' || selectedType === 'khoa' || selectedType === 'bomon') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Khối Khoa Đào Tạo & Các Bộ Môn Chuyên Môn
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      faculties.forEach((f) => (all[f._id] = true));
                      setExpandedFacultyIds(all);
                    }}
                    className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    Mở rộng tất cả
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setExpandedFacultyIds({})}
                    className="text-slate-500 hover:underline font-medium"
                  >
                    Thu gọn tất cả
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {faculties
                  .filter((faculty) => {
                    if (selectedParentFacultyId && faculty._id !== selectedParentFacultyId) return false;
                    if (!searchKeyword.trim()) return true;
                    const kw = searchKeyword.toLowerCase().trim();
                    const children = childrenByFacultyId[faculty._id] || [];
                    const selfMatch =
                      faculty.name.toLowerCase().includes(kw) ||
                      (typeof faculty.managerId === 'object' &&
                        faculty.managerId?.fullName?.toLowerCase().includes(kw));
                    const childMatch = children.some(
                      (c) =>
                        c.name.toLowerCase().includes(kw) ||
                        (typeof c.managerId === 'object' &&
                          c.managerId?.fullName?.toLowerCase().includes(kw))
                    );
                    return selfMatch || childMatch;
                  })
                  .map((faculty) => {
                    const isExpanded = Boolean(expandedFacultyIds[faculty._id]);
                    const children = childrenByFacultyId[faculty._id] || [];
                    const agg = getAggregateStats(faculty);

                    return (
                      <Card
                        key={faculty._id}
                        className="border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-2xs hover:shadow-md transition-shadow"
                      >
                        {/* Faculty Header Row */}
                        <div
                          onClick={() =>
                            setExpandedFacultyIds((prev) => ({
                              ...prev,
                              [faculty._id]: !prev[faculty._id],
                            }))
                          }
                          className="p-4 bg-white dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer border-l-4 border-l-brand-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <button
                              type="button"
                              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5 sm:mt-0"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>

                            <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800/50 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-5 h-5" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                  {faculty.name}
                                </h3>
                                <Badge variant="info" size="sm">
                                  Khoa đào tạo
                                </Badge>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  {children.length} Bộ môn
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <UsersIcon className="w-3.5 h-3.5 text-brand-500" />
                                  <strong className="text-slate-700 dark:text-slate-200">
                                    {agg.totalMembers}
                                  </strong>{' '}
                                  cán bộ, giảng viên
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                                  <strong className="text-slate-700 dark:text-slate-200">
                                    {agg.totalSubjects}
                                  </strong>{' '}
                                  học phần
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                  Bán kính GPS: <strong>{faculty.radiusMeters || 200}m</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Dean info & Actions */}
                          <div
                            className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="min-w-[190px]">{renderManagerBadge(faculty)}</div>

                            <div className="flex items-center gap-1.5">
                              {isAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs py-1 px-2.5"
                                  leftIcon={<Plus className="w-3.5 h-3.5 text-indigo-500" />}
                                  onClick={() => openCreateModal('bomon', faculty._id)}
                                >
                                  Thêm Bộ môn
                                </Button>
                              )}
                              <button
                                type="button"
                                title="Xem chi tiết & danh sách nhân sự"
                                onClick={() => openDetailModal(faculty)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    title="Chỉnh sửa Khoa"
                                    onClick={(e) => openEditModal(faculty, e)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50 transition-colors"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Xóa Khoa"
                                    onClick={() => setDeleteTarget(faculty)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Nested Child 'bomon' List */}
                        {isExpanded && (
                          <div className="bg-slate-50/70 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 px-4 py-3 pl-8 sm:pl-14">
                            {children.length === 0 ? (
                              <div className="py-3 flex items-center justify-between text-xs text-slate-400">
                                <span>Khoa này hiện chưa có Bộ môn trực thuộc nào.</span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => openCreateModal('bomon', faculty._id)}
                                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    Tạo Bộ môn đầu tiên
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {children.map((bm) => (
                                  <div
                                    key={bm._id}
                                    onClick={() => openDetailModal(bm)}
                                    className="group relative p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-indigo-500 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-2.5"
                                  >
                                    <div>
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                          Bộ môn chuyên môn
                                        </span>
                                        {isAdmin && (
                                          <div
                                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              onClick={(e) => openEditModal(bm, e)}
                                              className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                                            >
                                              <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setDeleteTarget(bm)}
                                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1.5">
                                        {bm.name}
                                      </h4>
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1">{renderManagerBadge(bm)}</div>
                                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 flex-shrink-0">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                          {bm.memberCount || 0} GV
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
              </div>
            </div>
          )}

          {/* SECTION B: KHỐI PHÒNG BAN & TRUNG TÂM CHỨC NĂNG */}
          {(selectedType === 'ALL' || selectedType === 'phongban') && !selectedParentFacultyId && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Khối Phòng Ban Chức Năng & Trung Tâm Trực Thuộc Trường
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {departments
                  .filter((d) => {
                    if (d.type !== 'phongban') return false;
                    if (!searchKeyword.trim()) return true;
                    const kw = searchKeyword.toLowerCase().trim();
                    return (
                      d.name.toLowerCase().includes(kw) ||
                      (typeof d.managerId === 'object' &&
                        d.managerId?.fullName?.toLowerCase().includes(kw))
                    );
                  })
                  .map((pb) => (
                    <Card
                      key={pb._id}
                      onClick={() => openDetailModal(pb)}
                      className="border-slate-200/80 dark:border-slate-800 border-l-4 border-l-emerald-500 hover:shadow-md transition-all cursor-pointer"
                    >
                      <CardContent className="p-4 flex flex-col justify-between h-full gap-4">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                                <Briefcase className="w-4 h-4" />
                              </div>
                              <div>
                                <Badge variant="success" size="sm">
                                  Phòng ban chức năng
                                </Badge>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                                  {pb.name}
                                </h3>
                              </div>
                            </div>

                            {isAdmin && (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => openEditModal(pb, e)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(pb)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">{renderManagerBadge(pb)}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                              <UsersIcon className="w-3 h-3 text-emerald-500" />
                              {pb.memberCount || 0} nhân sự
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: CHẾ ĐỘ THẺ LƯỚI (CARD GRID VIEW)
         ========================================================================= */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDepartments.length === 0 ? (
            <Card className="col-span-full p-12 text-center text-slate-400">
              Không tìm thấy đơn vị Khoa / Bộ môn / Phòng ban phù hợp.
            </Card>
          ) : (
            filteredDepartments.map((dept) => {
              const meta = UNIT_TYPE_META[dept.type] || UNIT_TYPE_META.khoa;
              const agg = getAggregateStats(dept);
              const parentName =
                typeof dept.parentId === 'object' && dept.parentId?.name
                  ? dept.parentId.name
                  : 'Trực thuộc Ban Giám Hiệu';

              return (
                <Card
                  key={dept._id}
                  onClick={() => openDetailModal(dept)}
                  className={`border-slate-200/80 dark:border-slate-800 border-l-4 ${meta.borderClass} hover:shadow-md transition-all cursor-pointer`}
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-10 h-10 rounded-2xl border flex items-center justify-center flex-shrink-0 ${meta.iconBgClass}`}
                          >
                            {dept.type === 'khoa' ? (
                              <GraduationCap className="w-5 h-5" />
                            ) : dept.type === 'bomon' ? (
                              <Layers className="w-5 h-5" />
                            ) : (
                              <Briefcase className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <Badge variant={meta.badgeVariant} size="sm">
                              {meta.label}
                            </Badge>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                              {parentName}
                            </p>
                          </div>
                        </div>

                        {isAdmin && (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => openEditModal(dept, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(dept)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {dept.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200">
                          <UsersIcon className="w-3.5 h-3.5 text-brand-500" />
                          {agg.totalMembers} nhân sự
                        </span>
                        {dept.type === 'khoa' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 font-semibold text-indigo-700 dark:text-indigo-300">
                            <FolderTree className="w-3.5 h-3.5" />
                            {agg.childCount} Bộ môn
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 font-semibold text-emerald-700 dark:text-emerald-300">
                          <MapPin className="w-3.5 h-3.5" />
                          {dept.radiusMeters || 200}m
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {renderManagerBadge(dept)}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 3: DẠNG BẢNG DANH SÁCH (ENTERPRISE TABLE VIEW + PAGINATION)
         ========================================================================= */}
      {viewMode === 'table' && (
        <Card className="border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Tên đơn vị tổ chức</th>
                  <th className="py-3.5 px-4">Loại đơn vị</th>
                  <th className="py-3.5 px-4">Đơn vị chủ quản (Cấp trên)</th>
                  <th className="py-3.5 px-4">Trưởng đơn vị / Phụ trách</th>
                  <th className="py-3.5 px-4">Quy mô đơn vị</th>
                  <th className="py-3.5 px-4">Bán kính chấm công GPS</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                {paginatedDepartments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Không tìm thấy đơn vị nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  paginatedDepartments.map((dept) => {
                    const meta = UNIT_TYPE_META[dept.type] || UNIT_TYPE_META.khoa;
                    const agg = getAggregateStats(dept);
                    const parentName =
                      typeof dept.parentId === 'object' && dept.parentId?.name
                        ? dept.parentId.name
                        : 'Ban Giám Hiệu (Cấp Trường)';
                    const lat = dept.latitude ?? dept.location?.lat;
                    const lng = dept.longitude ?? dept.location?.lng;

                    return (
                      <tr
                        key={dept._id}
                        onClick={() => openDetailModal(dept)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {dept.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                            ID: {dept._id.slice(-8).toUpperCase()}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge variant={meta.badgeVariant} size="sm">
                            {meta.label}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {parentName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">{renderManagerBadge(dept)}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-[11px]">
                              {agg.totalMembers} nhân sự
                            </span>
                            {dept.type === 'khoa' && (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                                {agg.childCount} Bộ môn
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{dept.radiusMeters || 200}m</span>
                          </div>
                          {lat && lng && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
                            </div>
                          )}
                        </td>

                        <td
                          className="py-3.5 px-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Xem chi tiết"
                              onClick={() => openDetailModal(dept)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  title="Chỉnh sửa"
                                  onClick={(e) => openEditModal(dept, e)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Xóa đơn vị"
                                  onClick={() => setDeleteTarget(dept)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Full Pagination Bar */}
          {filteredDepartments.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                <span>
                  Hiển thị{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {(currentPage - 1) * pageSize + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.min(currentPage * pageSize, filteredDepartments.length)}
                  </strong>{' '}
                  trên tổng số{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {filteredDepartments.length}
                  </strong>{' '}
                  đơn vị
                </span>

                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      currentPage === p
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* =========================================================================
          MODAL 1: THÊM MỚI / CẬP NHẬT ĐƠN VỊ (KHOA / BỘ MÔN / PHÒNG BAN)
         ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? 'Chỉnh Sửa Đơn Vị Tổ Chức' : 'Thêm Mới Khoa / Bộ Môn / Phòng Ban'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tự động kiểm tra phân cấp cây tổ chức và đồng bộ quyền Trưởng khoa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Loại đơn vị */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phân loại đơn vị tổ chức <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'khoa', title: 'Khoa Đào Tạo', sub: 'Cấp 1 (Thuộc Trường)' },
                      { id: 'bomon', title: 'Bộ Môn', sub: 'Cấp 2 (Thuộc Khoa)' },
                      { id: 'phongban', title: 'Phòng Ban', sub: 'Cấp 1 (Chức năng)' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          type: item.id,
                          parentId: item.id === 'bomon' ? prev.parentId || faculties[0]?._id || '' : '',
                        }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        formData.type === item.id
                          ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tên đơn vị */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tên đơn vị ({UNIT_TYPE_META[formData.type]?.label}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={
                    formData.type === 'khoa'
                      ? 'VD: Khoa Công nghệ Thông tin & Chuyển đổi số'
                      : formData.type === 'bomon'
                      ? 'VD: Bộ môn Trí tuệ Nhân tạo & Khoa học Dữ liệu'
                      : 'VD: Phòng Tổ chức - Cán bộ'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Đơn vị chủ quản (Nếu là Bộ môn thì bắt buộc chọn Khoa) */}
              {formData.type === 'bomon' ? (
                <div className="space-y-1.5 p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
                  <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    Khoa đào tạo chủ quản <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">-- Chọn Khoa đào tạo chủ quản --</option>
                    {faculties.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>
                    Đơn vị cấp 1 trực thuộc trực tiếp <strong>Ban Giám Hiệu Nhà Trường</strong> (parentId = null).
                  </span>
                </div>
              )}

              {/* Người phụ trách / Trưởng đơn vị */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formData.type === 'khoa'
                    ? 'Trưởng Khoa phụ trách'
                    : formData.type === 'bomon'
                    ? 'Trưởng Bộ môn phụ trách'
                    : 'Trưởng Phòng ban phụ trách'}
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Chưa bổ nhiệm / Bổ nhiệm sau --</option>
                  {eligibleManagers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName} ({u.staffCode || u.email})
                    </option>
                  ))}
                </select>
                {formData.type === 'khoa' && (
                  <p className="text-[11px] text-slate-500">
                    Lưu ý: Khi bổ nhiệm Giảng viên làm Trưởng khoa, hệ thống sẽ tự động đồng bộ vai trò{' '}
                    <code className="font-mono text-brand-600">truongkhoa</code> cho cán bộ đó.
                  </p>
                )}
              </div>

              {/* Tọa độ GPS Geofence & Bán kính điểm danh */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Compass className="w-4 h-4 text-emerald-500" />
                    <span>Tọa độ Tâm Geofence & Bán kính Chấm công</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setFormData((prev) => ({
                              ...prev,
                              latitude: pos.coords.latitude.toFixed(6),
                              longitude: pos.coords.longitude.toFixed(6),
                            }));
                            toast.success('Đã lấy tọa độ GPS hiện tại');
                          },
                          () => {
                            toast.error('Không thể truy cập vị trí trình duyệt');
                          }
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Lấy GPS hiện tại
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Vĩ độ (Latitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="21.007051"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Kinh độ (Longitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="105.824812"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">
                      Bán kính hợp lệ (mét)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      value={formData.radiusMeters}
                      onChange={(e) =>
                        setFormData({ ...formData, radiusMeters: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={submitting}
                >
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  {isEditing ? 'Lưu Cập Nhật' : 'Tạo Đơn Vị'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: CHI TIẾT ĐƠN VỊ & DANH SÁCH CÁN BỘ TRỰC THUỘC
         ========================================================================= */}
      {isDetailModalOpen && selectedDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedDept.name}
                    </h3>
                    <Badge
                      variant={UNIT_TYPE_META[selectedDept.type]?.badgeVariant || 'info'}
                      size="sm"
                    >
                      {UNIT_TYPE_META[selectedDept.type]?.label || selectedDept.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Thông tin cơ cấu tổ chức, bộ môn trực thuộc và danh sách cán bộ, giảng viên
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block mb-1.5">
                    Người phụ trách / Trưởng đơn vị:
                  </span>
                  {renderManagerBadge(selectedDept)}
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400 block mb-1">
                    Đơn vị chủ quản & Tọa độ Geofence:
                  </span>
                  <p className="font-bold text-slate-800 dark:text-slate-100">
                    {typeof selectedDept.parentId === 'object' && selectedDept.parentId?.name
                      ? selectedDept.parentId.name
                      : 'Ban Giám Hiệu (Cấp Trường)'}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Bán kính điểm danh: {selectedDept.radiusMeters || 200}m
                  </p>
                </div>
              </div>

              {/* Child Bộ Môn if selectedDept is a Khoa */}
              {selectedDept.type === 'khoa' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Các Bộ Môn Trực Thuộc ({(childrenByFacultyId[selectedDept._id] || []).length})
                    </h4>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          openCreateModal('bomon', selectedDept._id);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Thêm Bộ môn
                      </button>
                    )}
                  </div>

                  {(childrenByFacultyId[selectedDept._id] || []).length === 0 ? (
                    <p className="text-slate-400 italic py-2">Chưa có Bộ môn trực thuộc.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(childrenByFacultyId[selectedDept._id] || []).map((bm) => (
                        <div
                          key={bm._id}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {bm.name}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold">
                            {bm.memberCount || 0} GV
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Staff / Lecturers List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UsersIcon className="w-4 h-4 text-brand-500" />
                  Danh Sách Cán Bộ, Giảng Viên Trực Thuộc ({selectedDeptMembers.length})
                </h4>

                {selectedDeptMembers.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-slate-400">
                    Chưa có cán bộ, giảng viên nào thuộc đơn vị này.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-2xl max-h-64 overflow-y-auto">
                    {selectedDeptMembers.map((member) => {
                      const avatar = resolveAvatarUrl(member.avatar || member.facePhoto);
                      const { cleanName, title } = splitNameAndTitle(member.fullName);
                      return (
                        <div
                          key={member._id}
                          className="p-3 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={cleanName}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                                {getInitials(cleanName)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cleanName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {member.staffCode || member.email}
                                {title ? ` • ${title}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {member.isFaceRegistered ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Đã có Face ID
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Chưa ĐK Face
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Edit className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        openEditModal(selectedDept);
                      }}
                    >
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        setDeleteTarget(selectedDept);
                      }}
                    >
                      Xóa đơn vị
                    </Button>
                  </div>
                ) : (
                  <div />
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsDetailModalOpen(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: XÁC NHẬN XÓA ĐƠN VỊ
         ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xác nhận xóa đơn vị tổ chức?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Bạn đang yêu cầu xóa <strong>{deleteTarget.name}</strong>. Hệ thống chỉ cho phép xóa khi đơn vị không còn cán bộ/giảng viên hoặc bộ môn trực thuộc.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={submitting}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                isLoading={submitting}
              >
                Xác nhận xóa
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
