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
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { departmentApi } from '../../api/phongBan.api';
import { userApi, UserListResponse } from '../../api/nguoiDung.api';
import {
  DepartmentItem,
  DepartmentType,
  UserProfile,
} from '../../types/index';
import { Card, CardContent } from '../../components/chung/TheThongTin';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { Button } from '../../components/chung/NutBam';
import { Badge } from '../../components/chung/NhanTrangThai';
import { hasRole } from '../../utils/phanQuyen';
import { UserAvatar } from '../../components/chung/AnhDaiDienNguoiDung';
import { Portal } from '../../components/chung/CongDichChuyen';
import { TruongThongTin } from '../../components/chung/HoSoBenTrai';

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
  const [detailDept, setDetailDept] = useState<DepartmentItem | null>(null);
  const [detailMember, setDetailMember] = useState<UserProfile | null>(null);
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
    latitude: '20.9752',
    longitude: '105.7628',
    radiusMeters: 150,
  });

  // =============================================================================
  // FETCH DATA
  // =============================================================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const canFetchUsers = hasRole(user, [
        'admin', 'bgh', 'tccb', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong',
      ]);
      const [deptRes, usersRes] = await Promise.all([
        departmentApi.getDepartmentsFlat(),
        canFetchUsers ? userApi.getUsers({ trang: 1, gioi_han: 100 }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      let deptList: DepartmentItem[] = [];
      if (deptRes?.data && Array.isArray(deptRes.data)) {
        deptList = deptRes.data;
      }
      setDepartments(deptList);

      // Auto-expand all faculties in tree
      const initialExpanded: Record<string, boolean> = {};
      deptList.forEach((d) => {
        if (d.loai_don_vi === 'khoa') {
          initialExpanded[d.id] = true;
        }
      });
      setExpandedFacultyIds((prev) => (Object.keys(prev).length > 0 ? prev : initialExpanded));

      let userList: UserProfile[] = [];
      if (usersRes?.data) {
        if (Array.isArray(usersRes.data)) {
          userList = usersRes.data;
        } else if ('users' in usersRes.data && Array.isArray((usersRes.data as UserListResponse).users)) {
          userList = (usersRes.data as UserListResponse).users;
          const totalPages = Number((usersRes.data as any)?.pagination?.totalPages || 1);
          if (totalPages > 1 && canFetchUsers) {
            const rest = await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, i) =>
                userApi.getUsers({ trang: i + 2, gioi_han: 100 }).catch(() => null)
              )
            );
            rest.forEach((r) => {
              const extra = (r?.data as any)?.users;
              if (Array.isArray(extra)) userList = userList.concat(extra);
            });
          }
        }
      }
      setAllUsers(userList);
    } catch (err: any) {
      console.error('Error loading departments:', err);
      toast.error('Không thể tải dữ liệu Khoa & Phòng ban');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =============================================================================
  // COMPUTED HIERARCHY & METRICS
  // =============================================================================

  // List of all Faculties ('khoa')
  const faculties = useMemo(
    () => departments.filter((d) => d.loai_don_vi === 'khoa').sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi')),
    [departments]
  );

  // List of all Functional Departments ('phong_ban')
  const functionalDepts = useMemo(
    () => departments.filter((d) => d.loai_don_vi === 'phong_ban').sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi')),
    [departments]
  );

  // Map of child 'bo_mon' by parent 'khoa' ID
  const childrenByFacultyId = useMemo(() => {
    const map: Record<string, DepartmentItem[]> = {};
    departments.forEach((d) => {
      if (d.loai_don_vi === 'bo_mon' && d.don_vi_cha_id) {
        const pId = typeof d.don_vi_cha_id === 'object' ? d.don_vi_cha_id.id : d.don_vi_cha_id;
        if (pId) {
          if (!map[pId]) map[pId] = [];
          map[pId].push(d);
        }
      }
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi')));
    return map;
  }, [departments]);

  // Map of direct members count by department ID from both backend so_luong_thanh_vien and allUsers
  const membersCountByDeptId = useMemo(() => {
    const map: Record<string, number> = {};
    departments.forEach((d) => {
      const dId = d.id;
      map[dId] = d.so_luong_thanh_vien || 0;
    });
    if (allUsers.length > 0) {
      const userCountMap: Record<string, number> = {};
      allUsers.forEach((u) => {
        const uDeptId =
          typeof u.don_vi_chinh_id === 'object' && u.don_vi_chinh_id
            ? String(u.don_vi_chinh_id.id)
            : u.don_vi_chinh_id
              ? String(u.don_vi_chinh_id)
              : u.don_vi_chinh?.id || '';
        if (uDeptId) {
          userCountMap[uDeptId] = (userCountMap[uDeptId] || 0) + 1;
        }
      });
      departments.forEach((d) => {
        const dId = d.id;
        map[dId] = Math.max(d.so_luong_thanh_vien || 0, userCountMap[dId] || 0);
      });
    }
    return map;
  }, [departments, allUsers]);

  const getDirectMemberCount = useCallback(
    (dept: DepartmentItem) => {
      const dId = dept.id;
      return membersCountByDeptId[dId] ?? dept.so_luong_thanh_vien ?? 0;
    },
    [membersCountByDeptId]
  );

  // Aggregate stats calculation for a department
  const getAggregateStats = useCallback(
    (dept: DepartmentItem) => {
      const directMembers = getDirectMemberCount(dept);
      const directSubjects = dept.so_luong_mon_hoc || 0;
      if (dept.loai_don_vi !== 'khoa') {
        return {
          directMembers,
          totalMembers: directMembers,
          totalSubjects: directSubjects,
          childCount: 0,
        };
      }
      const children = childrenByFacultyId[dept.id] || [];
      const childMembers = children.reduce((sum, c) => sum + getDirectMemberCount(c), 0);
      const childSubjects = children.reduce((sum, c) => sum + (c.so_luong_mon_hoc || 0), 0);
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
    const bomonCount = departments.filter((d) => d.loai_don_vi === 'bo_mon').length;
    const phongbanCount = functionalDepts.length;
    const assignedManagers = departments.filter((d) => Boolean(d.truong_don_vi_id || d.truong_don_vi)).length;
    const totalCampusStaff = allUsers.filter(
      (u) => u.kich_hoat !== false && u.trang_thai_lam_viec !== 'da_nghi_viec'
    ).length;
    return { total, khoaCount, bomonCount, phongbanCount, assignedManagers, totalCampusStaff };
  }, [departments, faculties, functionalDepts, allUsers]);

  // Selected Department Item (if selectedNodeId is an actual department)
  const activeDepartment = useMemo(() => {
    return departments.find((d) => d.id === selectedNodeId) || null;
  }, [departments, selectedNodeId]);

  // Staff members belonging to the activeDepartment
  const activeDeptMembers = useMemo(() => {
    if (!activeDepartment) return [];
    const activeId = activeDepartment.id;
    const childIds = new Set(
      (childrenByFacultyId[activeId] || []).map((c) => c.id)
    );
    return allUsers.filter((u) => {
      const uDeptId =
        typeof u.don_vi_chinh_id === 'object' && u.don_vi_chinh_id
          ? String(u.don_vi_chinh_id.id)
          : u.don_vi_chinh_id
            ? String(u.don_vi_chinh_id)
            : u.don_vi_chinh?.id || '';
      if (!uDeptId) return false;
      return uDeptId === activeId || childIds.has(uDeptId);
    });
  }, [activeDepartment, allUsers, childrenByFacultyId]);

  // Filtered staff members based on search and Face ID filter
  const filteredDeptMembers = useMemo(() => {
    return activeDeptMembers.filter((member) => {
      if (staffFaceFilter === 'registered' && !member.da_dang_ky_face) return false;
      if (staffFaceFilter === 'unregistered' && member.da_dang_ky_face) return false;
      if (staffSearchQuery.trim()) {
        const q = staffSearchQuery.toLowerCase().trim();
        const name = (member.ho_ten || '').toLowerCase();
        const code = (member.ma_can_bo || '').toLowerCase();
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
    return allUsers.filter((u) => u.kich_hoat !== false && (u.vai_tro_chinh || '').toLowerCase() !== 'admin');
  }, [allUsers]);

  // Filtered tree faculties & departments by search
  const filteredFaculties = useMemo(() => {
    if (!treeSearch.trim()) return faculties;
    const kw = treeSearch.toLowerCase().trim();
    return faculties.filter((f) => {
      const nameMatch = f.ten_phong_ban.toLowerCase().includes(kw);
      const childMatch = (childrenByFacultyId[f.id] || []).some((c) =>
        c.ten_phong_ban.toLowerCase().includes(kw)
      );
      return nameMatch || childMatch;
    });
  }, [faculties, treeSearch, childrenByFacultyId]);

  const filteredFunctionalDepts = useMemo(() => {
    if (!treeSearch.trim()) return functionalDepts;
    const kw = treeSearch.toLowerCase().trim();
    return functionalDepts.filter((pb) => pb.ten_phong_ban.toLowerCase().includes(kw));
  }, [functionalDepts, treeSearch]);

  // Expand / Collapse all in tree
  const handleExpandAll = () => {
    setIsFacultiesFolderOpen(true);
    setIsFunctionalFolderOpen(true);
    const all: Record<string, boolean> = {};
    faculties.forEach((f) => (all[f.id] = true));
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
      parentId: presetType === 'bo_mon' ? presetParentId || faculties[0]?.id || '' : '',
      managerId: '',
      latitude: '20.9752',
      longitude: '105.7628',
      radiusMeters: 150,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (dept: DepartmentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setEditingDept(dept);

    const pId = dept.don_vi_cha_id
      ? String(typeof dept.don_vi_cha_id === 'object' ? dept.don_vi_cha_id.id : dept.don_vi_cha_id)
      : '';
    const mId = dept.truong_don_vi_id
      ? String(typeof dept.truong_don_vi_id === 'object' ? dept.truong_don_vi_id.id : dept.truong_don_vi_id)
      : '';
    const lat = dept.vi_do ?? dept.toa_do?.vi_do ?? '';
    const lng = dept.kinh_do ?? dept.toa_do?.kinh_do ?? '';

    setFormData({
      name: dept.ten_phong_ban || '',
      type: (dept.loai_don_vi as DepartmentType) || 'khoa',
      parentId: pId,
      managerId: mId,
      latitude: lat !== null && lat !== undefined ? String(lat) : '',
      longitude: lng !== null && lng !== undefined ? String(lng) : '',
      radiusMeters: dept.ban_kinh_met || 200,
    });
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên đơn vị');
      return;
    }
    if (formData.type === 'bo_mon' && !formData.parentId) {
      toast.error('Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo');
      return;
    }

    const latRaw = formData.latitude.trim();
    const lngRaw = formData.longitude.trim();
    const latNum = latRaw !== '' ? Number(latRaw) : null;
    const lngNum = lngRaw !== '' ? Number(lngRaw) : null;
    if (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) {
      toast.error('Vĩ độ phải nằm trong khoảng [-90, 90]');
      return;
    }
    if (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)) {
      toast.error('Kinh độ phải nằm trong khoảng [-180, 180]');
      return;
    }
    const radiusNum = Number(formData.radiusMeters);
    if (!Number.isFinite(radiusNum) || radiusNum <= 0) {
      toast.error('Bán kính chấm công phải là số dương lớn hơn 0');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ten_phong_ban: formData.name.trim(),
        loai_don_vi: formData.type,
        don_vi_cha_id: formData.type === 'bo_mon' ? formData.parentId : null,
        truong_don_vi_id: formData.managerId || null,
        vi_do: latNum,
        kinh_do: lngNum,
        ban_kinh_met: Math.round(radiusNum),
        toa_do: {
          vi_do: latNum,
          kinh_do: lngNum,
        },
      };

      if (isEditing && editingDept) {
        await departmentApi.updateDepartment(editingDept.id, payload);
        toast.success('Cập nhật đơn vị thành công');
      } else {
        const created = await departmentApi.createDepartment(payload);
        toast.success('Thêm mới đơn vị thành công');
        if (created?.data?.id) {
          setSelectedNodeId(created.data.id);
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
    const targetId = deleteTarget.id;
    setSubmitting(true);
    try {
      await departmentApi.deleteDepartment(targetId);
      toast.success(`Đã xóa đơn vị "${deleteTarget.ten_phong_ban}"`);
      if (selectedNodeId === targetId) {
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
    const mgr = dept.truong_don_vi || (typeof dept.truong_don_vi_id === 'object' ? dept.truong_don_vi_id : null);
    if (!mgr) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 italic">
          <UserCheck className="w-3.5 h-3.5 opacity-40" />
          Chưa bổ nhiệm lãnh đạo
        </span>
      );
    }
    const { cleanName, title } = splitNameAndTitle(mgr.ho_ten);

    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <UserAvatar
          user={mgr}
          name={mgr.ho_ten}
          avatarUrl={mgr.anh_dai_dien}
          staffCode={mgr.ma_can_bo || mgr.id}
          size="sm"
          shape="circle"
        />
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
            {cleanName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {mgr.ma_can_bo ? `Mã: ${mgr.ma_can_bo}` : ''} {title ? `• ${title}` : ''}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
      {/* =========================================================================
          PAGE HEADER (Chuẩn hóa Typography & Bố cục CSDL v2.5)
         ========================================================================= */}
      <PageHeader
        title="Quản Lý Cơ Cấu Tổ Chức & Phòng Ban"
        subtitle="Cây phân cấp cơ cấu đại học: Ban Giám Hiệu ➔ Khối Khoa (Bộ Môn) & Khối Phòng Ban Chức Năng."
        icon={<FolderTree className="w-5 h-5 text-brand-600" />}
        badge="CSDL v2.5"
        badgeVariant="brand"
        actions={
          <>
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
                  leftIcon={<Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
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
          </>
        }
      />

      {/* =========================================================================
          2. FLUX SEPARATE STATS ROW
         ========================================================================= */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng đơn vị',
            value: stats.total,
            badge: `${stats.assignedManagers} có TĐV`,
            progress: stats.total > 0 ? Math.round((stats.assignedManagers / stats.total) * 100) : 0,
            tone: 'neutral',
          },
          { label: 'Khoa đào tạo', value: stats.khoaCount, unit: 'khoa', subtext: 'Khối giảng dạy', tone: 'brand' },
          { label: 'Bộ môn', value: stats.bomonCount, unit: 'bộ môn', subtext: 'Đơn vị chuyên môn', tone: 'neutral' },
          { label: 'Phòng ban', value: stats.phongbanCount, unit: 'phòng', subtext: 'Khối hành chính', tone: 'success' },
        ]}
      />

      {/* =========================================================================
          3. MAIN 2-COLUMN SPLIT VIEW (ORGANIZATION DIRECTORY TREE - FLUX STYLE)
         ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-y lg:divide-y-0 divide-slate-100 dark:divide-slate-800 items-start">
        {/* =======================================================================
            LEFT COLUMN (42% - 5 cols): INTERACTIVE DIRECTORY TREE (STICKY)
           ======================================================================= */}
        <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-4 self-start">
          <div className="overflow-hidden">
            {/* Tree Navigation Header */}
            <div className="px-4 py-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                  <FolderTree className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Cơ Cấu Tổ Chức
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="px-2 py-1 rounded-md text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/60 font-semibold transition-colors"
                >
                  Mở hết
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="px-2 py-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Thu gọn
                </button>
              </div>
            </div>

            {/* Tree Search Box */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  placeholder="Lọc tên đơn vị trong sơ đồ..."
                  className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            {/* THE VISUAL TREE NODES */}
            <div className="p-3 max-h-[calc(100vh-260px)] min-h-[480px] overflow-y-auto space-y-1.5 font-sans select-none text-sm">
              {/* 1. ROOT NODE: BAN GIÁM HIỆU */}
              <div
                onClick={() => setSelectedNodeId('ROOT_BGH')}
                className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                  selectedNodeId === 'ROOT_BGH'
                    ? 'bg-brand-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 font-medium'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedNodeId === 'ROOT_BGH'
                        ? 'bg-white/20 text-white'
                        : 'bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="truncate">Ban Giám Hiệu • ĐHNT</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                    selectedNodeId === 'ROOT_BGH'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Root
                </span>
              </div>

              {/* TREE TRUNK: 2 MAIN BRANCHES */}
              <div className="relative pl-3.5 border-l-2 border-slate-200/80 dark:border-slate-700/60 ml-3.5 pt-1 space-y-2">
                {/* BRANCH 1: KHỐI KHOA ĐÀO TẠO & CÁC BỘ MÔN */}
                <div>
                  <div
                    onClick={() => {
                      setIsFacultiesFolderOpen(!isFacultiesFolderOpen);
                      setSelectedNodeId('KHU_KHOA');
                    }}
                    className={`px-2.5 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      selectedNodeId === 'KHU_KHOA'
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 font-semibold border border-brand-200 dark:border-brand-800'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFacultiesFolderOpen(!isFacultiesFolderOpen);
                        }}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        {isFacultiesFolderOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {isFacultiesFolderOpen ? (
                        <FolderOpen className="w-[18px] h-[18px] text-brand-500 shrink-0" />
                      ) : (
                        <Folder className="w-[18px] h-[18px] text-brand-500 shrink-0" />
                      )}
                      <span className="truncate">Khối Khoa Đào Tạo</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300 text-xs font-semibold shrink-0 tabular-nums">
                      {filteredFaculties.length}
                    </span>
                  </div>

                  {isFacultiesFolderOpen && (
                    <div className="relative pl-3 border-l-2 border-brand-200/80 dark:border-brand-800/60 ml-2.5 mt-1 space-y-1">
                      {filteredFaculties.map((faculty) => {
                        const fId = faculty.id;
                        const isExpanded = Boolean(expandedFacultyIds[fId]);
                        const children = childrenByFacultyId[fId] || [];
                        const isSelected = selectedNodeId === fId;
                        const agg = getAggregateStats(faculty);

                        return (
                          <div key={fId} className="relative">
                            <div
                              onClick={() => setSelectedNodeId(fId)}
                              className={`px-2.5 py-2 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-all ${
                                isSelected
                                  ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200 font-semibold border-l-[3px] border-l-brand-600 border border-brand-200 dark:border-brand-700'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {children.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedFacultyIds((prev) => ({
                                        ...prev,
                                        [fId]: !prev[fId],
                                      }));
                                    }}
                                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  <span className="w-4 h-4 inline-block shrink-0" />
                                )}
                                <GraduationCap className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                                <span className="truncate">{faculty.ten_phong_ban}</span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {children.length > 0 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-medium tabular-nums">
                                    {children.length} BM
                                  </span>
                                )}
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-medium tabular-nums">
                                  {agg.totalMembers} CB
                                </span>
                              </div>
                            </div>

                            {/* Bo Mon Children */}
                            {isExpanded && children.length > 0 && (
                              <div className="relative pl-3 border-l-2 border-indigo-200/80 dark:border-indigo-800/60 ml-2.5 mt-1 space-y-1">
                                {children.map((bm) => {
                                  const bmId = bm.id;
                                  const isBmSelected = selectedNodeId === bmId;
                                  return (
                                    <div
                                      key={bmId}
                                      onClick={() => setSelectedNodeId(bmId)}
                                      className={`px-2.5 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                                        isBmSelected
                                          ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 font-semibold border-l-[3px] border-l-indigo-600 border border-indigo-200 dark:border-indigo-700'
                                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400 font-medium'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="truncate">{bm.ten_phong_ban}</span>
                                      </div>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 tabular-nums">
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
                    className={`px-2.5 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                      selectedNodeId === 'KHU_PHONGBAN'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsFunctionalFolderOpen(!isFunctionalFolderOpen);
                        }}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        {isFunctionalFolderOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {isFunctionalFolderOpen ? (
                        <FolderOpen className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                      ) : (
                        <Folder className="w-[18px] h-[18px] text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">Khối Phòng Ban Chức Năng</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-xs font-semibold shrink-0 tabular-nums">
                      {filteredFunctionalDepts.length}
                    </span>
                  </div>

                  {isFunctionalFolderOpen && (
                    <div className="relative pl-3 border-l-2 border-emerald-200/80 dark:border-emerald-800/60 ml-2.5 mt-1 space-y-1">
                      {filteredFunctionalDepts.map((pb) => {
                        const pbId = pb.id;
                        const isSelected = selectedNodeId === pbId;
                        return (
                          <div
                            key={pbId}
                            onClick={() => setSelectedNodeId(pbId)}
                            className={`px-2.5 py-2 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-all ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 font-semibold border-l-[3px] border-l-emerald-600 border border-emerald-200 dark:border-emerald-700'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{pb.ten_phong_ban}</span>
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0 tabular-nums">
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
          </div>
        </div>

        {/* =======================================================================
            RIGHT COLUMN (58% - 7 cols): SELECTED DEPARTMENT DETAIL PANEL & STAFF DIRECTORY
           ======================================================================= */}
        <div className="lg:col-span-7 xl:col-span-7 p-4 sm:p-5 space-y-4">
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
                    const fId = f.id;
                    const children = childrenByFacultyId[fId] || [];
                    const agg = getAggregateStats(f);
                    return (
                      <div
                        key={fId}
                        onClick={() => setSelectedNodeId(fId)}
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
                            {f.ten_phong_ban}
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
                  {functionalDepts.map((pb) => {
                    const pbId = pb.id;
                    return (
                    <div
                      key={pbId}
                      onClick={() => setSelectedNodeId(pbId)}
                      className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Phòng Ban Cấp 1
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {pb.ten_phong_ban}
                        </h4>
                      </div>
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>{getDirectMemberCount(pb)} Cán bộ</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
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
                    {activeDepartment.loai_don_vi === 'bo_mon' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const pId = activeDepartment.don_vi_cha_id
                              ? typeof activeDepartment.don_vi_cha_id === 'object'
                                ? activeDepartment.don_vi_cha_id.id
                                : activeDepartment.don_vi_cha_id
                              : undefined;
                            if (pId) setSelectedNodeId(pId);
                          }}
                          className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline truncate max-w-[160px]"
                        >
                          {activeDepartment.don_vi_cha?.ten_phong_ban || (typeof activeDepartment.don_vi_cha_id === 'object' ? activeDepartment.don_vi_cha_id?.ten_phong_ban : undefined) || 'Khoa Quản Lý'}
                        </button>
                        <span>/</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[200px]">
                          {activeDepartment.ten_phong_ban}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                        {activeDepartment.ten_phong_ban}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                          activeDepartment.loai_don_vi === 'khoa'
                            ? 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 ring-4 ring-brand-500/10'
                            : activeDepartment.loai_don_vi === 'bo_mon'
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 ring-4 ring-indigo-500/10'
                            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 ring-4 ring-emerald-500/10'
                        }`}
                      >
                        {activeDepartment.loai_don_vi === 'khoa' ? (
                          <GraduationCap className="w-6 h-6" />
                        ) : activeDepartment.loai_don_vi === 'bo_mon' ? (
                          <Layers className="w-6 h-6" />
                        ) : (
                          <Briefcase className="w-6 h-6" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                            {activeDepartment.ten_phong_ban}
                          </h2>
                          <Badge
                            variant={UNIT_TYPE_META[activeDepartment.loai_don_vi]?.badgeVariant || 'info'}
                            size="sm"
                          >
                            {UNIT_TYPE_META[activeDepartment.loai_don_vi]?.label || activeDepartment.loai_don_vi}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {activeDepartment.loai_don_vi === 'bo_mon'
                            ? `Trực thuộc: ${
                                activeDepartment.don_vi_cha?.ten_phong_ban ||
                                (typeof activeDepartment.don_vi_cha_id === 'object' ? activeDepartment.don_vi_cha_id?.ten_phong_ban : undefined) ||
                                'Khoa đào tạo'
                              }`
                            : 'Đơn vị cấp 1 trực thuộc Ban Giám Hiệu'}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons for this unit */}
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        leftIcon={<Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />}
                        onClick={() => setDetailDept(activeDepartment)}
                      >
                        Chi tiết
                      </Button>
                      {isAdmin && (
                        <>
                          {activeDepartment.loai_don_vi === 'khoa' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              leftIcon={<Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                              onClick={() => openCreateModal('bo_mon', activeDepartment.id)}
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
                        </>
                      )}
                    </div>
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
                        {activeDepartment.loai_don_vi === 'khoa'
                          ? 'Trưởng Khoa Phụ Trách'
                          : activeDepartment.loai_don_vi === 'bo_mon'
                          ? 'Trưởng Bộ Môn Phụ Trách'
                          : 'Trưởng Phòng Ban'}
                      </span>
                    </div>

                    {(activeDepartment.truong_don_vi || (typeof activeDepartment.truong_don_vi_id === 'object' && activeDepartment.truong_don_vi_id)) ? (
                      (() => {
                        const mgr = (activeDepartment.truong_don_vi || activeDepartment.truong_don_vi_id) as any;
                        const { cleanName, title } = splitNameAndTitle(mgr.ho_ten);
                        return (
                          <div className="flex items-center gap-3.5 pt-1">
                            <UserAvatar
                              user={mgr}
                              name={mgr.ho_ten}
                              avatarUrl={mgr.anh_dai_dien}
                              staffCode={mgr.ma_can_bo || mgr.id}
                              size="md"
                              shape="circle"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cleanName}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                {mgr.ma_can_bo && (
                                  <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[11px] font-semibold">
                                    {mgr.ma_can_bo}
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
                        Bán kính: {activeDepartment.ban_kinh_met || 200}m
                      </span>
                    </div>

                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
                          {(activeDepartment.vi_do ?? activeDepartment.toa_do?.vi_do) != null && (activeDepartment.kinh_do ?? activeDepartment.toa_do?.kinh_do) != null
                            ? `${Number(activeDepartment.vi_do ?? activeDepartment.toa_do?.vi_do).toFixed(6)}, ${Number(activeDepartment.kinh_do ?? activeDepartment.toa_do?.kinh_do).toFixed(6)}`
                            : 'Chưa thiết lập tọa độ'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Cán bộ, giảng viên phải nằm trong phạm vi <strong>{activeDepartment.ban_kinh_met || 200} mét</strong> quanh tọa độ trên để chấm công Face ID hợp lệ.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sub-departments (If Active Dept is a Faculty) */}
              {activeDepartment.loai_don_vi === 'khoa' && (
                <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
                  <CardContent className="p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        Bộ Môn Chuyên Môn Trực Thuộc ({(childrenByFacultyId[activeDepartment.id] || []).length})
                      </h4>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openCreateModal('bo_mon', activeDepartment.id)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm Bộ môn
                        </button>
                      )}
                    </div>

                    {(childrenByFacultyId[activeDepartment.id] || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                        Khoa này chưa có bộ môn trực thuộc nào.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {(childrenByFacultyId[activeDepartment.id] || []).map((bm) => (
                          <div
                            key={bm.id}
                            onClick={() => setSelectedNodeId(bm.id)}
                            className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/60 hover:shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-2 group"
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {bm.ten_phong_ban}
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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          placeholder="Tìm tên, mã, email..."
                          className="w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        />
                        {staffSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setStaffSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5"
                          >
                            ✕
                          </button>
                        )}
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
                            <th className="py-2.5 px-3.5 text-right">Face ID / Thao Tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {filteredDeptMembers.map((member) => {
                            const mId = member.id;
                            const { cleanName, title } = splitNameAndTitle(member.ho_ten);
                            return (
                              <tr
                                key={mId}
                                onClick={() => setDetailMember(member)}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                              >
                                <td className="py-2.5 px-3.5">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <UserAvatar
                                      user={member}
                                      name={member.ho_ten}
                                      avatarUrl={member.anh_dai_dien}
                                      staffCode={member.ma_can_bo || mId}
                                      size="sm"
                                      shape="circle"
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
                                        {member.ma_can_bo || member.email}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3.5 hidden sm:table-cell">
                                  <div className="space-y-0.5">
                                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                      {member.ma_can_bo || '—'}
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
                                    {member.vai_tro_chinh || 'Cán bộ'}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3.5 text-right">
                                  <div className="inline-flex items-center justify-end gap-2">
                                    {member.da_dang_ky_face ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Face ID
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400">
                                        Chưa có
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetailMember(member);
                                      }}
                                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                      title="Xem chi tiết cán bộ"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
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
                          parentId: item.id === 'bo_mon' ? prev.parentId || faculties[0]?.id || '' : '',
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
                      : formData.type === 'bo_mon'
                      ? 'VD: Bộ môn Trí tuệ Nhân tạo & Khoa học Dữ liệu'
                      : 'VD: Phòng Quản lý Đào tạo'
                  }
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              {/* Đơn vị cha (nếu là Bộ môn) */}
              {formData.type === 'bo_mon' ? (
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
                    {faculties.map((f) => {
                      const fId = f.id;
                      return (
                      <option key={fId} value={fId}>
                        {f.ten_phong_ban}
                      </option>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span>
                    Đơn vị cấp 1 trực thuộc trực tiếp <strong>Ban Giám Hiệu Nhà Trường</strong> (don_vi_cha_id = null).
                  </span>
                </div>
              )}

              {/* Người phụ trách / Trưởng đơn vị */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {formData.type === 'khoa'
                    ? 'Trưởng Khoa phụ trách'
                    : formData.type === 'bo_mon'
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
                    <option key={u.id} value={u.id}>
                      {u.ho_ten} ({u.ma_can_bo || u.email})
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
                    Bạn đang yêu cầu xóa <strong>{deleteTarget.ten_phong_ban}</strong>. Hệ thống chỉ cho phép xóa khi đơn vị không còn cán bộ/giảng viên hoặc bộ môn trực thuộc.
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

      {/* =========================================================================
          MODAL 3: POPUP XEM CHI TIẾT ĐƠN VỊ TỔ CHỨC
         ========================================================================= */}
      {detailDept && (
        <Portal>
          <div
            onClick={() => setDetailDept(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <div className="w-11 h-11 rounded-2xl bg-brand-600/20 border border-brand-400/30 text-brand-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                        {UNIT_TYPE_META[detailDept.loai_don_vi]?.label || detailDept.loai_don_vi}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold">
                        {getDirectMemberCount(detailDept)} nhân sự
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                      {detailDept.ten_phong_ban}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailDept(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <TruongThongTin
                    label="Đơn vị quản lý cấp trên"
                    value={
                      detailDept.don_vi_cha?.ten_phong_ban ||
                      (typeof detailDept.don_vi_cha_id === 'object' && detailDept.don_vi_cha_id
                        ? detailDept.don_vi_cha_id.ten_phong_ban
                        : null) ||
                      'Ban Giám Hiệu • Trường ĐH Nguyễn Trãi'
                    }
                  />
                  <TruongThongTin
                    label="Lãnh đạo phụ trách"
                    value={
                      detailDept.truong_don_vi?.ho_ten ||
                      (typeof detailDept.truong_don_vi_id === 'object' && detailDept.truong_don_vi_id
                        ? detailDept.truong_don_vi_id.ho_ten
                        : null) ||
                      'Chưa bổ nhiệm'
                    }
                  />
                  <TruongThongTin
                    label="Tọa độ tâm GPS Geofence"
                    mono
                    value={(() => {
                      const lat = detailDept.vi_do ?? detailDept.toa_do?.vi_do;
                      const lng = detailDept.kinh_do ?? detailDept.toa_do?.kinh_do;
                      return lat != null && lng != null
                        ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
                        : 'Chưa thiết lập tọa độ';
                    })()}
                  />
                  <TruongThongTin
                    label="Bán kính cho phép chấm công"
                    value={`${detailDept.ban_kinh_met || 200} mét`}
                  />
                  <TruongThongTin
                    label="Số môn học trực thuộc"
                    value={`${detailDept.so_luong_mon_hoc ?? 0} môn học`}
                  />
                  <TruongThongTin
                    label="Đơn vị trực thuộc"
                    value={
                      (childrenByFacultyId[detailDept.id] || []).length > 0
                        ? (childrenByFacultyId[detailDept.id] || []).map((c) => c.ten_phong_ban).join(', ')
                        : 'Không có đơn vị con'
                    }
                  />
                  <TruongThongTin
                    label="Ngày tạo đơn vị"
                    mono
                    value={
                      detailDept.tao_luc
                        ? new Date(detailDept.tao_luc).toLocaleString('vi-VN')
                        : 'Chưa ghi nhận'
                    }
                  />
                  <TruongThongTin
                    label="Cập nhật gần nhất"
                    mono
                    value={
                      detailDept.cap_nhat_luc
                        ? new Date(detailDept.cap_nhat_luc).toLocaleString('vi-VN')
                        : 'Chưa ghi nhận'
                    }
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between gap-2 shrink-0">
                {isAdmin && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                    onClick={(e) => {
                      const target = detailDept;
                      setDetailDept(null);
                      openEditModal(target, e);
                    }}
                  >
                    Chỉnh sửa đơn vị
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailDept(null)}
                  className="ml-auto"
                >
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL 4: POPUP XEM CHI TIẾT CÁN BỘ TRỰC THUỘC ĐƠN VỊ
         ========================================================================= */}
      {detailMember && (
        <Portal>
          <div
            onClick={() => setDetailMember(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            >
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3.5 min-w-0 pr-4">
                  <UserAvatar
                    user={detailMember}
                    name={detailMember.ho_ten}
                    avatarUrl={detailMember.anh_dai_dien}
                    staffCode={detailMember.ma_can_bo || detailMember.id}
                    size="lg"
                    shape="circle"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-mono font-bold text-slate-200">
                        {detailMember.ma_can_bo || 'CHƯA CẤP MÃ'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold">
                        {detailMember.vai_tro_chinh || 'Cán bộ'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1 truncate">
                      {splitNameAndTitle(detailMember.ho_ten).cleanName}
                    </h3>
                    {splitNameAndTitle(detailMember.ho_ten).title && (
                      <p className="text-xs text-slate-400 truncate">
                        {splitNameAndTitle(detailMember.ho_ten).title}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailMember(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <TruongThongTin
                    label="Đơn vị công tác"
                    value={activeDepartment?.ten_phong_ban || 'Trường ĐH Nguyễn Trãi'}
                  />
                  <TruongThongTin
                    label="Sinh trắc học Face ID"
                    value={
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            detailMember.da_dang_ky_face ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {detailMember.da_dang_ky_face ? 'Đã đăng ký Face ID (5 góc)' : 'Chưa đăng ký'}
                      </span>
                    }
                  />
                  <TruongThongTin
                    label="Email công vụ"
                    value={detailMember.email || 'Chưa cập nhật email'}
                  />
                  <TruongThongTin
                    label="Số điện thoại"
                    value={detailMember.so_dien_thoai || 'Chưa cập nhật'}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setDetailMember(null)}>
                  Đóng
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
