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
  RefreshCw,
  ShieldCheck,
  Layers,
  Network,
  UserCheck,
  AlertCircle,
  X,
  Compass,
  GraduationCap,
  Briefcase,
  FolderTree,
  CheckCircle2,
  Folder,
  FolderOpen,
  CornerDownRight,
  ExternalLink,
  Mail,
  Phone,
  Filter,
  User,
  ArrowRight,
  ScanFace,
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
import { hasRole } from '../utils/rbac';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Portal } from '../components/ui/Portal';

// =============================================================================
// HELPERS & CONSTANTS
// =============================================================================

const UNIT_TYPE_META: Record<
  string,
  {
    label: string;
    shortLabel: string;
    badgeVariant: 'info' | 'purple' | 'success' | 'neutral';
    colorText: string;
    colorBg: string;
    colorBorder: string;
    description: string;
  }
> = {
  khoa: {
    label: 'Khoa Đào Tạo',
    shortLabel: 'Khoa',
    badgeVariant: 'info',
    colorText: 'text-brand-600 dark:text-brand-400',
    colorBg: 'bg-brand-50 dark:bg-brand-950/60',
    colorBorder: 'border-brand-500',
    description: 'Đơn vị chuyên môn cấp trường trực thuộc Ban Giám Hiệu, quản lý các Bộ môn và Giảng viên.',
  },
  bo_mon: {
    label: 'Bộ Môn Chuyên Môn',
    shortLabel: 'Bộ môn',
    badgeVariant: 'purple',
    colorText: 'text-indigo-600 dark:text-indigo-400',
    colorBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    colorBorder: 'border-indigo-500',
    description: 'Đơn vị chuyên môn sâu trực thuộc một Khoa đào tạo.',
  },
  bomon: {
    label: 'Bộ Môn Chuyên Môn',
    shortLabel: 'Bộ môn',
    badgeVariant: 'purple',
    colorText: 'text-indigo-600 dark:text-indigo-400',
    colorBg: 'bg-indigo-50 dark:bg-indigo-950/60',
    colorBorder: 'border-indigo-500',
    description: 'Đơn vị chuyên môn sâu trực thuộc một Khoa đào tạo.',
  },
  phong_ban: {
    label: 'Phòng Ban Chức Năng',
    shortLabel: 'Phòng ban',
    badgeVariant: 'success',
    colorText: 'text-emerald-600 dark:text-emerald-400',
    colorBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    colorBorder: 'border-emerald-500',
    description: 'Đơn vị hành chính, quản trị, trung tâm phục vụ trực thuộc Ban Giám Hiệu.',
  },
  phongban: {
    label: 'Phòng Ban Chức Năng',
    shortLabel: 'Phòng ban',
    badgeVariant: 'success',
    colorText: 'text-emerald-600 dark:text-emerald-400',
    colorBg: 'bg-emerald-50 dark:bg-emerald-950/60',
    colorBorder: 'border-emerald-500',
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
// MAIN COMPONENT (SPLIT-VIEW HRM DIRECTORY TREE)
// =============================================================================

export const Departments: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = hasRole(user, ['admin', 'bgh']);

  // Data States
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Tree Filter & Navigation States
  const [treeSearch, setTreeSearch] = useState<string>('');
  // selectedNodeId: 'ROOT_BGH' | 'KHU_KHOA' | 'KHU_PHONGBAN' | departmentId
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ROOT_BGH');

  // Staff search & filter within selected unit
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [staffFaceFilter, setStaffFaceFilter] = useState<'all' | 'registered' | 'unregistered'>('all');

  // Expanded Folder States in Directory Tree
  const [isFacultiesFolderOpen, setIsFacultiesFolderOpen] = useState<boolean>(true);
  const [isFunctionalFolderOpen, setIsFunctionalFolderOpen] = useState<boolean>(true);
  const [expandedFacultyIds, setExpandedFacultyIds] = useState<Record<string, boolean>>({});

  // Modals State
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentItem | null>(null);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
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

      // Auto-expand all faculties in tree
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

  // =============================================================================
  // COMPUTED HIERARCHY & METRICS
  // =============================================================================

  // List of all Faculties ('khoa')
  const faculties = useMemo(
    () => departments.filter((d) => d.type === 'khoa').sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [departments]
  );

  // List of all Functional Departments ('phong_ban')
  const functionalDepts = useMemo(
    () => departments.filter((d) => d.type === 'phong_ban' || d.type === 'phongban').sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [departments]
  );

  // Map of child 'bo_mon' by parent 'khoa' ID
  const childrenByFacultyId = useMemo(() => {
    const map: Record<string, DepartmentItem[]> = {};
    departments.forEach((d) => {
      if ((d.type === 'bo_mon' || d.type === 'bomon') && d.parentId) {
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

  // Map of direct members count by department ID from both backend memberCount and allUsers
  const membersCountByDeptId = useMemo(() => {
    const map: Record<string, number> = {};
    departments.forEach((d) => {
      map[d._id] = d.memberCount || 0;
    });
    if (allUsers.length > 0) {
      const userCountMap: Record<string, number> = {};
      allUsers.forEach((u) => {
        const uDeptId = typeof u.departmentId === 'object' ? u.departmentId?._id : u.departmentId;
        if (uDeptId) {
          userCountMap[uDeptId] = (userCountMap[uDeptId] || 0) + 1;
        }
      });
      departments.forEach((d) => {
        map[d._id] = Math.max(d.memberCount || 0, userCountMap[d._id] || 0);
      });
    }
    return map;
  }, [departments, allUsers]);

  const getDirectMemberCount = useCallback(
    (dept: DepartmentItem) => {
      return membersCountByDeptId[dept._id] ?? dept.memberCount ?? 0;
    },
    [membersCountByDeptId]
  );

  // Aggregate stats calculation for a department
  const getAggregateStats = useCallback(
    (dept: DepartmentItem) => {
      const directMembers = getDirectMemberCount(dept);
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
      const childMembers = children.reduce((sum, c) => sum + getDirectMemberCount(c), 0);
      const childSubjects = children.reduce((sum, c) => sum + (c.subjectCount || 0), 0);
      return {
        directMembers,
        totalMembers: directMembers + childMembers,
        totalSubjects: directSubjects + childSubjects,
        childCount: children.length,
      };
    },
    [childrenByFacultyId, getDirectMemberCount]
  );

  // Global KPIs
  const stats = useMemo(() => {
    const total = departments.length;
    const khoaCount = faculties.length;
    const bomonCount = departments.filter((d) => d.type === 'bo_mon' || d.type === 'bomon').length;
    const phongbanCount = functionalDepts.length;
    const assignedManagers = departments.filter((d) => Boolean(d.managerId)).length;
    const totalCampusStaff = allUsers.length;
    return { total, khoaCount, bomonCount, phongbanCount, assignedManagers, totalCampusStaff };
  }, [departments, faculties, functionalDepts, allUsers]);

  // Selected Department Item (if selectedNodeId is an actual department)
  const activeDepartment = useMemo(() => {
    return departments.find((d) => d._id === selectedNodeId) || null;
  }, [departments, selectedNodeId]);

  // Staff members belonging to the activeDepartment
  const activeDeptMembers = useMemo(() => {
    if (!activeDepartment) return [];
    const childIds = new Set(
      (childrenByFacultyId[activeDepartment._id] || []).map((c) => c._id)
    );
    return allUsers.filter((u) => {
      const uDeptId = typeof u.departmentId === 'object' ? u.departmentId?._id : u.departmentId;
      if (!uDeptId) return false;
      return uDeptId === activeDepartment._id || childIds.has(uDeptId);
    });
  }, [activeDepartment, allUsers, childrenByFacultyId]);

  // Filtered staff members based on search and Face ID filter
  const filteredDeptMembers = useMemo(() => {
    return activeDeptMembers.filter((member) => {
      if (staffFaceFilter === 'registered' && !member.isFaceRegistered) return false;
      if (staffFaceFilter === 'unregistered' && member.isFaceRegistered) return false;
      if (staffSearchQuery.trim()) {
        const q = staffSearchQuery.toLowerCase().trim();
        const name = (member.fullName || '').toLowerCase();
        const code = (member.staffCode || '').toLowerCase();
        const email = (member.email || '').toLowerCase();
        return name.includes(q) || code.includes(q) || email.includes(q);
      }
      return true;
    });
  }, [activeDeptMembers, staffSearchQuery, staffFaceFilter]);

  // Reset staff filters when selecting another node
  useEffect(() => {
    setStaffSearchQuery('');
    setStaffFaceFilter('all');
  }, [selectedNodeId]);

  // Eligible managers for dropdown
  const eligibleManagers = useMemo(() => {
    return allUsers.filter((u) => u.isActive !== false && (u.role || '').toLowerCase() !== 'admin');
  }, [allUsers]);

  // Filtered tree faculties & departments by search
  const filteredFaculties = useMemo(() => {
    if (!treeSearch.trim()) return faculties;
    const kw = treeSearch.toLowerCase().trim();
    return faculties.filter((f) => {
      const nameMatch = f.name.toLowerCase().includes(kw);
      const childMatch = (childrenByFacultyId[f._id] || []).some((c) =>
        c.name.toLowerCase().includes(kw)
      );
      return nameMatch || childMatch;
    });
  }, [faculties, treeSearch, childrenByFacultyId]);

  const filteredFunctionalDepts = useMemo(() => {
    if (!treeSearch.trim()) return functionalDepts;
    const kw = treeSearch.toLowerCase().trim();
    return functionalDepts.filter((pb) => pb.name.toLowerCase().includes(kw));
  }, [functionalDepts, treeSearch]);

  // Expand / Collapse all in tree
  const handleExpandAll = () => {
    setIsFacultiesFolderOpen(true);
    setIsFunctionalFolderOpen(true);
    const all: Record<string, boolean> = {};
    faculties.forEach((f) => (all[f._id] = true));
    setExpandedFacultyIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedFacultyIds({});
    setIsFacultiesFolderOpen(false);
    setIsFunctionalFolderOpen(false);
  };

  // =============================================================================
  // MODAL & CRUD ACTIONS
  // =============================================================================

  const openCreateModal = (presetType: DepartmentType = 'khoa', presetParentId = '') => {
    setIsEditing(false);
    setEditingDept(null);
    setFormData({
      name: '',
      type: presetType,
      parentId: (presetType === 'bo_mon' || presetType === 'bomon') ? presetParentId || faculties[0]?._id || '' : '',
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
    setEditingDept(dept);

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên đơn vị');
      return;
    }
    if ((formData.type === 'bo_mon' || formData.type === 'bomon') && !formData.parentId) {
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
        parentId: (formData.type === 'bo_mon' || formData.type === 'bomon') ? formData.parentId : null,
        managerId: formData.managerId || null,
        latitude: latNum,
        longitude: lngNum,
        radiusMeters: Number(formData.radiusMeters) || 200,
        location: {
          lat: latNum,
          lng: lngNum,
        },
      };

      if (isEditing && editingDept) {
        await departmentApi.updateDepartment(editingDept._id, payload);
        toast.success('Cập nhật đơn vị thành công');
      } else {
        const created = await departmentApi.createDepartment(payload);
        toast.success('Thêm mới đơn vị thành công');
        if (created?.data?._id) {
          setSelectedNodeId(created.data._id);
        }
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
      if (selectedNodeId === deleteTarget._id) {
        setSelectedNodeId('ROOT_BGH');
      }
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể xóa đơn vị này';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // =============================================================================
  // UI RENDER HELPERS
  // =============================================================================

  const renderManagerSnippet = (dept: DepartmentItem) => {
    const mgr = typeof dept.managerId === 'object' ? dept.managerId : null;
    if (!mgr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
          <UserCheck className="w-3.5 h-3.5 opacity-40" />
          Chưa bổ nhiệm lãnh đạo
        </span>
      );
    }
    const avatarUrl = resolveAvatarUrl(mgr.avatarUrl);
    const { cleanName, title } = splitNameAndTitle(mgr.fullName);

    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <UserAvatar
          user={mgr}
          name={mgr.fullName}
          avatarUrl={mgr.avatarUrl}
          staffCode={mgr.staffCode || mgr._id}
          size="sm"
          shape="rounded"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
            {cleanName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {mgr.staffCode ? `Mã: ${mgr.staffCode}` : ''} {title ? `• ${title}` : ''}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center flex-shrink-0">
            <FolderTree className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Quản Lý Cơ Cấu Tổ Chức Phòng Ban (Sơ Đồ Cây)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cây phân cấp cơ cấu đại học: Ban Giám Hiệu ➔ Khối Khoa (Bộ Môn) & Khối Phòng Ban Chức Năng.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadData}
          >
            Làm mới
          </Button>

          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5 text-indigo-500" />}
                onClick={() => openCreateModal('bo_mon')}
              >
                Thêm Bộ Môn
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => openCreateModal('khoa')}
              >
                Thêm Khoa / Phòng Ban
              </Button>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          EXECUTIVE KPI STRIP
         ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-slate-200/80 dark:border-slate-800/80">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tổng Đơn Vị Tổ Chức</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              <p className="text-[10px] text-slate-400">{stats.assignedManagers}/{stats.total} đã có Trưởng ĐV</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center">
              <Network className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Khoa Đào Tạo (Cấp 1)</p>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{stats.khoaCount}</p>
              <p className="text-[10px] text-brand-500 font-medium">Khối học thuật chuyên môn</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Bộ Môn (Cấp 2)</p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{stats.bomonCount}</p>
              <p className="text-[10px] text-indigo-500 font-medium">Trực thuộc các Khoa</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800/80">
          <CardContent className="p-3.5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Phòng Ban Chức Năng</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.phongbanCount}</p>
              <p className="text-[10px] text-emerald-500 font-medium">Khối Quản trị & Trung tâm</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* =========================================================================
          MAIN 2-COLUMN SPLIT VIEW (ORGANIZATION DIRECTORY TREE)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =======================================================================
            LEFT COLUMN (33% - 4 cols): INTERACTIVE DIRECTORY TREE (STICKY)
           ======================================================================= */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-3 lg:sticky lg:top-4 self-start">
          <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden rounded-2xl">
            {/* Tree Navigation Header */}
            <div className="px-3.5 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <FolderTree className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Cơ Cấu Tổ Chức
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 font-semibold transition-colors"
                >
                  Mở hết
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-1.5 py-0.5 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Thu gọn
                </button>
              </div>
            </div>

            {/* Tree Search Box */}
            <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  placeholder="Lọc tên đơn vị trong sơ đồ..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1.5 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            {/* THE VISUAL TREE NODES */}
            <div className="p-2.5 max-h-[calc(100vh-280px)] min-h-[460px] overflow-y-auto space-y-1 font-sans select-none text-xs">
              {/* 1. ROOT NODE: BAN GIÁM HIỆU */}
              <div
                onClick={() => setSelectedNodeId('ROOT_BGH')}
                className={`p-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                  selectedNodeId === 'ROOT_BGH'
                    ? 'bg-brand-600 text-white font-bold shadow-xs ring-2 ring-brand-500/20'
                    : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedNodeId === 'ROOT_BGH'
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">Ban Giám Hiệu • ĐHNT</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    selectedNodeId === 'ROOT_BGH'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Root
                </span>
              </div>

              {/* TREE TRUNK: 2 MAIN BRANCHES */}
              <div className="relative pl-3 border-l-2 border-slate-200/80 dark:border-slate-700/60 ml-3 pt-1 space-y-2">
                {/* BRANCH 1: KHỐI KHOA ĐÀO TẠO & CÁC BỘ MÔN */}
                <div>
                  <div
                    onClick={() => {
                      setIsFacultiesFolderOpen(!isFacultiesFolderOpen);
                      setSelectedNodeId('KHU_KHOA');
                    }}
                    className={`p-1.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      selectedNodeId === 'KHU_KHOA'
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 font-bold border border-brand-200 dark:border-brand-800 shadow-2xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFacultiesFolderOpen(!isFacultiesFolderOpen);
                        }}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        {isFacultiesFolderOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isFacultiesFolderOpen ? (
                        <FolderOpen className="w-4 h-4 text-brand-500 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-brand-500 shrink-0" />
                      )}
                      <span className="truncate">Khối Khoa Đào Tạo</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300 text-[10px] font-bold shrink-0">
                      {filteredFaculties.length}
                    </span>
                  </div>

                  {isFacultiesFolderOpen && (
                    <div className="relative pl-2.5 border-l-2 border-brand-200/80 dark:border-brand-800/60 ml-2 mt-1 space-y-1">
                      {filteredFaculties.map((faculty) => {
                        const isExpanded = Boolean(expandedFacultyIds[faculty._id]);
                        const children = childrenByFacultyId[faculty._id] || [];
                        const isSelected = selectedNodeId === faculty._id;
                        const agg = getAggregateStats(faculty);

                        return (
                          <div key={faculty._id} className="relative">
                            <div
                              onClick={() => setSelectedNodeId(faculty._id)}
                              className={`p-1.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                isSelected
                                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 font-bold border-l-[3px] border-l-brand-600 border border-brand-200 dark:border-brand-700 shadow-2xs'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {children.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedFacultyIds((prev) => ({
                                        ...prev,
                                        [faculty._id]: !prev[faculty._id],
                                      }));
                                    }}
                                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-3.5 h-3.5 inline-block" />
                                )}
                                <GraduationCap className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                                <span className="truncate">{faculty.name}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {children.length > 0 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                                    {children.length} BM
                                  </span>
                                )}
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                                  {agg.totalMembers} CB
                                </span>
                              </div>
                            </div>

                            {/* Bo Mon Children */}
                            {isExpanded && children.length > 0 && (
                              <div className="relative pl-2.5 border-l-2 border-indigo-200/80 dark:border-indigo-800/60 ml-2 mt-0.5 space-y-0.5">
                                {children.map((bm) => {
                                  const isBmSelected = selectedNodeId === bm._id;
                                  return (
                                    <div
                                      key={bm._id}
                                      onClick={() => setSelectedNodeId(bm._id)}
                                      className={`p-1.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                                        isBmSelected
                                          ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 font-bold border-l-[3px] border-l-indigo-600 border border-indigo-200 dark:border-indigo-700 shadow-2xs'
                                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <CornerDownRight className="w-3 h-3 text-indigo-400 shrink-0" />
                                        <span className="truncate">{bm.name}</span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                                        {getDirectMemberCount(bm)} GV
                                      </span>
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

                {/* BRANCH 2: KHỐI PHÒNG BAN CHỨC NĂNG */}
                <div>
                  <div
                    onClick={() => {
                      setIsFunctionalFolderOpen(!isFunctionalFolderOpen);
                      setSelectedNodeId('KHU_PHONGBAN');
                    }}
                    className={`p-1.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      selectedNodeId === 'KHU_PHONGBAN'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFunctionalFolderOpen(!isFunctionalFolderOpen);
                        }}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        {isFunctionalFolderOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isFunctionalFolderOpen ? (
                        <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Folder className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">Khối Phòng Ban Chức Năng</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                      {filteredFunctionalDepts.length}
                    </span>
                  </div>

                  {isFunctionalFolderOpen && (
                    <div className="relative pl-2.5 border-l-2 border-emerald-200/80 dark:border-emerald-800/60 ml-2 mt-1 space-y-1">
                      {filteredFunctionalDepts.map((pb) => {
                        const isSelected = selectedNodeId === pb._id;
                        return (
                          <div
                            key={pb._id}
                            onClick={() => setSelectedNodeId(pb._id)}
                            className={`p-1.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 font-bold border-l-[3px] border-l-emerald-600 border border-emerald-200 dark:border-emerald-700 shadow-2xs'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{pb.name}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold shrink-0">
                              {getDirectMemberCount(pb)} CB
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* =======================================================================
            RIGHT COLUMN (67% - 8 cols): SELECTED DEPARTMENT DETAIL PANEL & STAFF DIRECTORY
           ======================================================================= */}
        <div className="lg:col-span-8 xl:col-span-8 space-y-4">
          {/* CASE A: ROOT BGH IS SELECTED */}
          {selectedNodeId === 'ROOT_BGH' && (
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-13 h-13 rounded-2xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm ring-4 ring-brand-500/10">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200/80 dark:border-brand-800">
                          Trụ Sở Điều Hành Cao Nhất (Root)
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                        Ban Giám Hiệu • Trường Đại Học Nguyễn Trãi
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Trung tâm quản trị toàn diện: Khối Khoa Đào Tạo, Bộ Môn Chuyên Môn và các Phòng Ban Chức Năng.
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => openCreateModal('khoa')}
                    >
                      Thêm Đơn Vị Mới
                    </Button>
                  )}
                </div>

                {/* Overall Campus Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-medium text-slate-500 block">Tổng nhân sự toàn trường:</span>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {stats.totalCampusStaff} <span className="text-xs font-normal text-slate-500">cán bộ / GV</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-brand-50/40 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-800/40 space-y-1">
                    <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 block">Khối đào tạo học thuật:</span>
                    <p className="text-2xl font-bold text-brand-700 dark:text-brand-300">
                      {stats.khoaCount} <span className="text-xs font-normal text-slate-500">Khoa</span> • {stats.bomonCount} <span className="text-xs font-normal text-slate-500">Bộ môn</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-1">
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Khối hành chính & dịch vụ:</span>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {stats.phongbanCount} <span className="text-xs font-normal text-slate-500">Phòng ban</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                  <p className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                    Hướng dẫn quản trị cơ cấu tổ chức:
                  </p>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                    Bấm chọn bất kỳ <strong>Khoa đào tạo</strong>, <strong>Bộ môn</strong> hoặc <strong>Phòng ban chức năng</strong> ở Cây sơ đồ bên trái để xem chi tiết hồ sơ quản lý, danh sách cán bộ trực thuộc và cấu hình bán kính GPS Geofence điểm danh tương ứng.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CASE B: KHỐI KHOA FOLDER IS SELECTED */}
          {selectedNodeId === 'KHU_KHOA' && (
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 ring-4 ring-brand-500/10">
                      <GraduationCap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Khối Khoa Đào Tạo & Bộ Môn Chuyên Môn
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tổng cộng {faculties.length} Khoa đào tạo và {stats.bomonCount} Bộ môn trực thuộc
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => openCreateModal('khoa')}
                    >
                      Thêm Khoa Mới
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {faculties.map((f) => {
                    const children = childrenByFacultyId[f._id] || [];
                    const agg = getAggregateStats(f);
                    return (
                      <div
                        key={f._id}
                        onClick={() => setSelectedNodeId(f._id)}
                        className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-500/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                              Khoa Cấp 1
                            </span>
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                              {children.length} Bộ Môn
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                            {f.name}
                          </h4>
                        </div>
                        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                          <span>{agg.totalMembers} Cán bộ / GV</span>
                          <span className="text-brand-600 dark:text-brand-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CASE C: KHỐI PHÒNG BAN FOLDER IS SELECTED */}
          {selectedNodeId === 'KHU_PHONGBAN' && (
            <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 ring-4 ring-emerald-500/10">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Khối Phòng Ban Chức Năng
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tổng cộng {functionalDepts.length} phòng ban chức năng điều hành
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => openCreateModal('phong_ban')}
                    >
                      Thêm Phòng Ban
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {functionalDepts.map((pb) => (
                    <div
                      key={pb._id}
                      onClick={() => setSelectedNodeId(pb._id)}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Phòng Ban Cấp 1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {pb.name}
                        </h4>
                      </div>
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>{getDirectMemberCount(pb)} Cán bộ</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                          Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CASE D: AN ACTUAL DEPARTMENT NODE IS SELECTED (KHOA / BOMON / PHONGBAN) */}
          {activeDepartment && (
            <div className="space-y-4">
              {/* Unit Hero Header */}
              <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  {/* Breadcrumb path */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId('ROOT_BGH')}
                      className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
                    >
                      ĐHNT
                    </button>
                    <span>/</span>
                    {activeDepartment.type === 'bo_mon' || activeDepartment.type === 'bomon' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const pId = typeof activeDepartment.parentId === 'object' ? activeDepartment.parentId?._id : activeDepartment.parentId;
                            if (pId) setSelectedNodeId(pId);
                          }}
                          className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline truncate max-w-[160px]"
                        >
                          {typeof activeDepartment.parentId === 'object' ? activeDepartment.parentId?.name : 'Khoa Quản Lý'}
                        </button>
                        <span>/</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[200px]">
                          {activeDepartment.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                        {activeDepartment.name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                          activeDepartment.type === 'khoa'
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 ring-4 ring-brand-500/10'
                            : (activeDepartment.type === 'bo_mon' || activeDepartment.type === 'bomon')
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 ring-4 ring-indigo-500/10'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 ring-4 ring-emerald-500/10'
                        }`}
                      >
                        {activeDepartment.type === 'khoa' ? (
                          <GraduationCap className="w-6 h-6" />
                        ) : (activeDepartment.type === 'bo_mon' || activeDepartment.type === 'bomon') ? (
                          <Layers className="w-6 h-6" />
                        ) : (
                          <Briefcase className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                            {activeDepartment.name}
                          </h2>
                          <Badge
                            variant={UNIT_TYPE_META[activeDepartment.type]?.badgeVariant || 'info'}
                            size="sm"
                          >
                            {UNIT_TYPE_META[activeDepartment.type]?.label || activeDepartment.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {activeDepartment.type === 'bomon'
                            ? `Trực thuộc: ${
                                typeof activeDepartment.parentId === 'object'
                                  ? activeDepartment.parentId?.name
                                  : 'Khoa đào tạo'
                              }`
                            : 'Đơn vị cấp 1 trực thuộc Ban Giám Hiệu'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons for this unit */}
                    {isAdmin && (
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        {activeDepartment.type === 'khoa' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            leftIcon={<Plus className="w-3.5 h-3.5 text-indigo-500" />}
                            onClick={() => openCreateModal('bo_mon', activeDepartment._id)}
                          >
                            Thêm Bộ Môn
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          leftIcon={<Edit className="w-3.5 h-3.5 text-brand-600" />}
                          onClick={(e) => openEditModal(activeDepartment, e)}
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="text-xs"
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                          onClick={() => setDeleteTarget(activeDepartment)}
                        >
                          Xóa
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Two Column Info Cards: Leader & Geofence GPS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* 1. Leader / Manager Card */}
                <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                        {activeDepartment.type === 'khoa'
                          ? 'Trưởng Khoa Phụ Trách'
                          : activeDepartment.type === 'bomon'
                          ? 'Trưởng Bộ Môn Phụ Trách'
                          : 'Trưởng Phòng Ban'}
                      </span>
                    </div>

                    {typeof activeDepartment.managerId === 'object' && activeDepartment.managerId ? (
                      (() => {
                        const mgr = activeDepartment.managerId as any;
                        const { cleanName, title } = splitNameAndTitle(mgr.fullName);
                        return (
                          <div className="flex items-center gap-3.5 pt-1">
                            <UserAvatar
                              user={mgr}
                              name={mgr.fullName}
                              avatarUrl={mgr.avatarUrl}
                              staffCode={mgr.staffCode || mgr._id}
                              size="md"
                              shape="rounded"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cleanName}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {mgr.staffCode && (
                                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[11px] font-semibold">
                                    {mgr.staffCode}
                                  </span>
                                )}
                                {title && <span className="truncate">{title}</span>}
                              </div>
                              {mgr.email && (
                                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                                  <Mail className="w-3 h-3 shrink-0" /> {mgr.email}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="py-3 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 opacity-50" />
                          Chưa bổ nhiệm lãnh đạo
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => openEditModal(activeDepartment, e)}
                            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                          >
                            Bổ nhiệm ngay
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Geofence & Location Card */}
                <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Tọa Độ Geofence Điểm Danh
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                        Bán kính: {activeDepartment.radiusMeters || 200}m
                      </span>
                    </div>

                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {activeDepartment.latitude || '21.007051'}, {activeDepartment.longitude || '105.824812'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Cán bộ, giảng viên phải nằm trong phạm vi <strong>{activeDepartment.radiusMeters || 200} mét</strong> quanh tọa độ trên để chấm công Face ID hợp lệ.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sub-departments (If Active Dept is a Faculty) */}
              {activeDepartment.type === 'khoa' && (
                <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
                  <CardContent className="p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Bộ Môn Chuyên Môn Trực Thuộc ({(childrenByFacultyId[activeDepartment._id] || []).length})
                      </h4>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openCreateModal('bo_mon', activeDepartment._id)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm Bộ môn
                        </button>
                      )}
                    </div>

                    {(childrenByFacultyId[activeDepartment._id] || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                        Khoa này chưa có bộ môn trực thuộc nào.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {(childrenByFacultyId[activeDepartment._id] || []).map((bm) => (
                          <div
                            key={bm._id}
                            onClick={() => setSelectedNodeId(bm._id)}
                            className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/60 hover:shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-2 group"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {bm.name}
                              </span>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">
                                {getDirectMemberCount(bm)} Giảng viên
                              </span>
                            </div>
                            <div className="flex items-center justify-end text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                              Chi tiết <ChevronRight className="w-3 h-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Staff / Lecturers Directory Table */}
              <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  {/* Staff Table Header & Filters */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 flex items-center justify-center">
                        <UsersIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Danh Sách Cán Bộ & Giảng Viên
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          Hiển thị {filteredDeptMembers.length} trên tổng số {activeDeptMembers.length} nhân sự
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Search Staff Input */}
                      <div className="relative min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          placeholder="Tìm tên, mã, email..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1.5 focus:ring-brand-500 transition-all"
                        />
                      </div>

                      {/* Face Filter Segmented Control */}
                      <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setStaffFaceFilter('all')}
                          className={`px-2 py-1 rounded-lg font-medium transition-all ${
                            staffFaceFilter === 'all'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffFaceFilter('registered')}
                          className={`px-2 py-1 rounded-lg font-medium transition-all ${
                            staffFaceFilter === 'registered'
                              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Đã Face ID
                        </button>
                        <button
                          type="button"
                          onClick={() => setStaffFaceFilter('unregistered')}
                          className={`px-2 py-1 rounded-lg font-medium transition-all ${
                            staffFaceFilter === 'unregistered'
                              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-2xs font-semibold'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Chưa có
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Staff Table / List */}
                  {filteredDeptMembers.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 text-center space-y-2">
                      <UsersIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {activeDeptMembers.length === 0
                          ? 'Đơn vị này hiện chưa có cán bộ hoặc giảng viên nào được chỉ định.'
                          : 'Không tìm thấy cán bộ nào phù hợp với bộ lọc hiện tại.'}
                      </p>
                      {activeDeptMembers.length > 0 && staffSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setStaffSearchQuery('');
                            setStaffFaceFilter('all');
                          }}
                          className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline"
                        >
                          Xóa bộ lọc tìm kiếm
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                            <th className="py-2.5 px-3.5">Cán Bộ / Giảng Viên</th>
                            <th className="py-2.5 px-3.5 hidden sm:table-cell">Mã CB / Liên Hệ</th>
                            <th className="py-2.5 px-3.5 hidden md:table-cell">Chức Vụ / Vai Trò</th>
                            <th className="py-2.5 px-3.5 text-right">Face ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {filteredDeptMembers.map((member) => {
                            const { cleanName, title } = splitNameAndTitle(member.fullName);
                            return (
                              <tr
                                key={member._id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="py-2.5 px-3.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <UserAvatar
                                      user={member}
                                      name={member.fullName}
                                      avatarUrl={member.avatar}
                                      staffCode={member.staffCode || member._id}
                                      size="sm"
                                      shape="rounded"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                        {cleanName}
                                      </p>
                                      {title && (
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {title}
                                        </p>
                                      )}
                                      <div className="sm:hidden text-[10px] text-slate-400 mt-0.5 font-mono">
                                        {member.staffCode || member.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3.5 hidden sm:table-cell">
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {member.staffCode || '—'}
                                    </span>
                                    {member.email && (
                                      <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                        {member.email}
                                      </p>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3.5 hidden md:table-cell">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {member.role || 'Cán bộ'}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3.5 text-right">
                                  {member.isFaceRegistered ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Face ID
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400">
                                      Chưa có
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: THÊM MỚI / CHỈNH SỬA ĐƠN VỊ TỔ CHỨC
         ========================================================================= */}
      {isFormModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-200/60 dark:border-brand-800/40">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isEditing ? 'Chỉnh Sửa Đơn Vị Tổ Chức' : 'Thêm Mới Đơn Vị Vào Cây Cơ Cấu'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cập nhật vị trí trong cây phân cấp và cấu hình Geofence chấm công
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Phân loại đơn vị */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phân loại đơn vị tổ chức <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'khoa', title: 'Khoa Đào Tạo', sub: 'Cấp 1 (Học thuật)' },
                      { id: 'bo_mon', title: 'Bộ Môn', sub: 'Cấp 2 (Thuộc Khoa)' },
                      { id: 'phong_ban', title: 'Phòng Ban', sub: 'Cấp 1 (Chức năng)' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          type: item.id,
                          parentId: item.id === 'bo_mon' ? prev.parentId || faculties[0]?._id || '' : '',
                        }))
                      }
                      className={`p-2.5 rounded-2xl border text-left transition-all ${
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
                      ? 'VD: Khoa Công nghệ Thông tin & Thiết kế Đồ họa'
                      : (formData.type === 'bo_mon' || formData.type === 'bomon')
                      ? 'VD: Bộ môn Trí tuệ Nhân tạo & Khoa học Dữ liệu'
                      : 'VD: Phòng Quản lý Đào tạo'
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Đơn vị cha (nếu là Bộ môn) */}
              {(formData.type === 'bo_mon' || formData.type === 'bomon') ? (
                <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
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
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
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
                    : (formData.type === 'bo_mon' || formData.type === 'bomon')
                    ? 'Trưởng Bộ môn phụ trách'
                    : 'Trưởng Phòng ban phụ trách'}
                </label>
                <select
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <option value="">-- Chưa bổ nhiệm / Bổ nhiệm sau --</option>
                  {eligibleManagers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName} ({u.staffCode || u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Tọa độ Geofence & Bán kính điểm danh */}
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Compass className="w-4 h-4 text-emerald-500" />
                    <span>Tọa độ Geofence & Bán kính Điểm danh</span>
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
                            toast.error('Không thể truy cập GPS trình duyệt');
                          }
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Lấy GPS hiện tại
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">
                      Vĩ độ (Lat)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="21.007051"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">
                      Kinh độ (Lng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="105.824812"
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 block mb-1">
                      Bán kính (mét)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      value={formData.radiusMeters}
                      onChange={(e) =>
                        setFormData({ ...formData, radiusMeters: Number(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
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
        </Portal>
      )}

      {/* =========================================================================
          MODAL 2: XÁC NHẬN XÓA ĐƠN VỊ
         ========================================================================= */}
      {deleteTarget && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200/60 dark:border-rose-800/40 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Xác nhận xóa đơn vị tổ chức?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
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
        </Portal>
      )}
    </div>
  );
};

export default Departments;
