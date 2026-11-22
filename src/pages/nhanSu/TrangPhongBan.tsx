import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FolderTree, Plus, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { departmentApi } from '../../api/phongBan.api';
import { userApi, UserListResponse } from '../../api/nguoiDung.api';
import { CreateDepartmentPayload, DepartmentItem, DepartmentType, UserProfile } from '../../types';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { Button } from '../../components/chung/NutBam';
import { hasRole } from '../../utils/phanQuyen';
import { CayCoCauToChuc } from './components/phongBan/CayCoCauToChuc';
import { ChiTietDonViPanel } from './components/phongBan/ChiTietDonViPanel';
import { ModalFormDonVi } from './components/phongBan/ModalFormDonVi';
import { ModalXoaDonVi } from './components/phongBan/ModalXoaDonVi';
import { ModalHoSoThanhVien } from './components/phongBan/ModalHoSoThanhVien';
import {
  DepartmentAggregateStats,
  DeptMembersCacheEntry,
  getDeptManagerId,
  getDeptParentId,
} from './components/phongBan/phongBan.helpers';

export const Departments: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = hasRole(user, ['admin', 'bgh']);
  const canFetchUsers = hasRole(user, [
    'admin',
    'bgh',
    'tccb',
    'dao_tao',
    'truong_khoa',
    'pho_khoa',
    'truong_bo_mon',
    'pho_bo_mon',
    'truong_phong',
    'pho_phong',
  ]);

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Lazy-load cache nhân sự theo deptId (tránh tải toàn trường & xử lý sạch 403/race condition)
  const [membersCache, setMembersCache] = useState<Record<string, DeptMembersCacheEntry>>({});
  const inFlightDeptRef = useRef<Set<string>>(new Set());
  const cacheVersionRef = useRef<number>(0);

  // Trạng thái cây tổ chức
  const [selectedNodeId, setSelectedNodeId] = useState<string>('ROOT_BGH');
  const [treeSearch, setTreeSearch] = useState<string>('');
  const [expandedFacultyIds, setExpandedFacultyIds] = useState<Record<string, boolean>>({});
  const [isFacultiesFolderOpen, setIsFacultiesFolderOpen] = useState<boolean>(true);
  const [isFunctionalFolderOpen, setIsFunctionalFolderOpen] = useState<boolean>(true);

  // Trạng thái các Modal
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingDept, setEditingDept] = useState<DepartmentItem | null>(null);
  const [presetType, setPresetType] = useState<DepartmentType>('khoa');
  const [presetParentId, setPresetParentId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<DepartmentItem | null>(null);
  const [detailMember, setDetailMember] = useState<UserProfile | null>(null);

  const loadDepartments = useCallback(async (resetMembersCache = false) => {
    setLoading(true);
    try {
      const deptRes = await departmentApi.getDepartmentsFlat();
      const deptList: DepartmentItem[] = Array.isArray(deptRes?.data) ? deptRes.data : [];
      setDepartments(deptList);

      const initialExpanded: Record<string, boolean> = {};
      deptList.forEach((d) => {
        if (d.loai_don_vi === 'khoa') initialExpanded[d.id] = true;
      });
      setExpandedFacultyIds((prev) => (Object.keys(prev).length > 0 ? prev : initialExpanded));

      if (resetMembersCache) {
        cacheVersionRef.current += 1;
        inFlightDeptRef.current.clear();
        setMembersCache({});
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải danh sách Khoa & Phòng ban.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments(false);
  }, [loadDepartments]);

  // Tải nhân sự theo đơn vị (lazy-load + cache)
  const ensureDeptMembers = useCallback(
    async (deptId: string, forceReload = false) => {
      if (!deptId || deptId === 'ROOT_BGH' || !canFetchUsers) return;
      if (!forceReload && inFlightDeptRef.current.has(deptId)) return;

      let shouldSkip = false;
      setMembersCache((prev) => {
        const existing = prev[deptId];
        if (!forceReload && existing && (existing.status === 'loaded' || existing.status === 'forbidden')) {
          shouldSkip = true;
          return prev;
        }
        return {
          ...prev,
          [deptId]: { status: 'loading', users: existing?.users || [] },
        };
      });
      if (shouldSkip) return;

      const requestVersion = cacheVersionRef.current;
      inFlightDeptRef.current.add(deptId);
      try {
        const firstRes = await userApi.getUsers({ don_vi_id: deptId, trang: 1, gioi_han: 100 });
        let list: UserProfile[] = [];
        const raw = firstRes?.data;
        if (Array.isArray(raw)) {
          list = raw;
        } else if (raw && 'users' in raw && Array.isArray((raw as UserListResponse).users)) {
          list = (raw as UserListResponse).users;
          const totalPages = Number((raw as UserListResponse).pagination?.totalPages || 1);
          if (totalPages > 1) {
            const rest = await Promise.all(
              Array.from({ length: totalPages - 1 }, (_, i) =>
                userApi.getUsers({ don_vi_id: deptId, trang: i + 2, gioi_han: 100 }).catch(() => null)
              )
            );
            rest.forEach((r) => {
              const extra = (r?.data as UserListResponse | undefined)?.users;
              if (Array.isArray(extra)) list = list.concat(extra);
            });
          }
        }

        if (cacheVersionRef.current !== requestVersion) return;
        setMembersCache((prev) => ({
          ...prev,
          [deptId]: { status: 'loaded', users: list },
        }));
      } catch (err: any) {
        if (cacheVersionRef.current !== requestVersion) return;
        const status = err?.response?.status;
        if (status === 403) {
          setMembersCache((prev) => ({
            ...prev,
            [deptId]: { status: 'forbidden', users: [] },
          }));
        } else {
          setMembersCache((prev) => ({
            ...prev,
            [deptId]: {
              status: 'error',
              users: [],
              errorMessage: err?.response?.data?.message || 'Không thể tải danh sách nhân sự đơn vị.',
            },
          }));
        }
      } finally {
        inFlightDeptRef.current.delete(deptId);
      }
    },
    [canFetchUsers]
  );

  // Tự động lazy-load nhân sự khi chọn 1 đơn vị cụ thể trên cây
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== 'ROOT_BGH' && canFetchUsers) {
      ensureDeptMembers(selectedNodeId);
    }
  }, [selectedNodeId, canFetchUsers, ensureDeptMembers]);

  // Tính cấu trúc phân cấp
  const faculties = useMemo(
    () =>
      departments
        .filter((d) => d.loai_don_vi === 'khoa')
        .sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi')),
    [departments]
  );

  const functionalDepts = useMemo(
    () =>
      departments
        .filter((d) => d.loai_don_vi === 'phong_ban')
        .sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi')),
    [departments]
  );

  const childrenByFacultyId = useMemo(() => {
    const map: Record<string, DepartmentItem[]> = {};
    departments.forEach((d) => {
      if (d.loai_don_vi === 'bo_mon') {
        const pId = getDeptParentId(d);
        if (pId) {
          if (!map[pId]) map[pId] = [];
          map[pId].push(d);
        }
      }
    });
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi'))
    );
    return map;
  }, [departments]);

  const getAggregateStats = useCallback(
    (dept: DepartmentItem): DepartmentAggregateStats => {
      const directMembers = Number(dept.so_luong_thanh_vien ?? 0);
      const directTotalLinkedMembers = Number(dept.tong_so_thanh_vien ?? directMembers);
      const directSubjects = Number(dept.so_luong_mon_hoc ?? 0);
      if (dept.loai_don_vi !== 'khoa') {
        return {
          directMembers,
          totalMembers: directMembers,
          directTotalLinkedMembers,
          totalLinkedMembers: directTotalLinkedMembers,
          totalSubjects: directSubjects,
          childCount: 0,
        };
      }
      const children = childrenByFacultyId[dept.id] || [];
      const childMembers = children.reduce((sum, c) => sum + Number(c.so_luong_thanh_vien ?? 0), 0);
      const childLinked = children.reduce(
        (sum, c) => sum + Number(c.tong_so_thanh_vien ?? c.so_luong_thanh_vien ?? 0),
        0
      );
      const childSubjects = children.reduce((sum, c) => sum + Number(c.so_luong_mon_hoc ?? 0), 0);
      return {
        directMembers,
        totalMembers: directMembers + childMembers,
        directTotalLinkedMembers,
        totalLinkedMembers: directTotalLinkedMembers + childLinked,
        totalSubjects: directSubjects + childSubjects,
        childCount: children.length,
      };
    },
    [childrenByFacultyId]
  );

  // KPI toàn trường (dùng trực tiếp so_luong_thanh_vien từ BE -> chính xác cho mọi vai trò kể cả giang_vien)
  const stats = useMemo(() => {
    const total = departments.length;
    const khoaCount = faculties.length;
    const bomonCount = departments.filter((d) => d.loai_don_vi === 'bo_mon').length;
    const phongbanCount = functionalDepts.length;
    const assignedManagers = departments.filter((d) => Boolean(getDeptManagerId(d))).length;
    const totalCampusStaff = departments.reduce((sum, d) => sum + Number(d.so_luong_thanh_vien ?? 0), 0);
    return { total, khoaCount, bomonCount, phongbanCount, assignedManagers, totalCampusStaff };
  }, [departments, faculties, functionalDepts]);

  const activeDepartment = useMemo(
    () => departments.find((d) => d.id === selectedNodeId) || null,
    [departments, selectedNodeId]
  );

  const activeMembersEntry: DeptMembersCacheEntry = useMemo(() => {
    if (!activeDepartment) return { status: 'idle', users: [] };
    return membersCache[activeDepartment.id] || { status: 'idle', users: [] };
  }, [activeDepartment, membersCache]);

  // Thao tác cây
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

  const handleToggleFaculty = (facultyId: string) => {
    setExpandedFacultyIds((prev) => ({ ...prev, [facultyId]: !prev[facultyId] }));
  };

  // Thao tác Modal
  const openCreateModal = (type: DepartmentType = 'khoa', parentId = '') => {
    setIsEditing(false);
    setEditingDept(null);
    setPresetType(type);
    setPresetParentId(parentId);
    setIsFormModalOpen(true);
  };

  const openEditModal = (dept: DepartmentItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setEditingDept(dept);
    setPresetType((dept.loai_don_vi as DepartmentType) || 'khoa');
    setPresetParentId(getDeptParentId(dept));
    setIsFormModalOpen(true);
  };

  const handleSaveDepartment = async (payload: CreateDepartmentPayload, editingDeptId: string | null) => {
    setSubmitting(true);
    try {
      if (editingDeptId) {
        await departmentApi.updateDepartment(editingDeptId, payload);
        toast.success('Cập nhật đơn vị thành công');
      } else {
        const created = await departmentApi.createDepartment(payload);
        toast.success('Thêm mới đơn vị thành công');
        if (created?.data?.id) {
          setSelectedNodeId(created.data.id);
        }
      }
      setIsFormModalOpen(false);
      await loadDepartments(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Thao tác thất bại.', { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const targetName = deleteTarget.ten_phong_ban;
    setSubmitting(true);
    try {
      await departmentApi.deleteDepartment(targetId);
      toast.success(`Đã xóa đơn vị "${targetName}"`);
      if (selectedNodeId === targetId) setSelectedNodeId('ROOT_BGH');
      setDeleteTarget(null);
      await loadDepartments(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xóa đơn vị.', { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-12 animate-fade-in">
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
              onClick={() => loadDepartments(true)}
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

      {/* Bố cục Master-Detail 4/12 - 8/12 */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 lg:divide-x divide-y lg:divide-y-0 divide-slate-100 dark:divide-slate-800 items-start">
        <CayCoCauToChuc
          faculties={faculties}
          functionalDepts={functionalDepts}
          childrenByFacultyId={childrenByFacultyId}
          selectedNodeId={selectedNodeId}
          totalCampusStaff={stats.totalCampusStaff}
          treeSearch={treeSearch}
          expandedFacultyIds={expandedFacultyIds}
          isFacultiesFolderOpen={isFacultiesFolderOpen}
          isFunctionalFolderOpen={isFunctionalFolderOpen}
          loading={loading}
          getAggregateStats={getAggregateStats}
          onSelectNode={setSelectedNodeId}
          onTreeSearchChange={setTreeSearch}
          onToggleFaculty={handleToggleFaculty}
          onToggleFacultiesFolder={() => setIsFacultiesFolderOpen((prev) => !prev)}
          onToggleFunctionalFolder={() => setIsFunctionalFolderOpen((prev) => !prev)}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
        />

        <ChiTietDonViPanel
          selectedNodeId={selectedNodeId}
          activeDepartment={activeDepartment}
          departments={departments}
          faculties={faculties}
          functionalDepts={functionalDepts}
          childrenByFacultyId={childrenByFacultyId}
          totalCampusStaff={stats.totalCampusStaff}
          isAdmin={isAdmin}
          canFetchUsers={canFetchUsers}
          membersEntry={activeMembersEntry}
          getAggregateStats={getAggregateStats}
          onSelectNode={setSelectedNodeId}
          onOpenCreate={openCreateModal}
          onOpenEdit={openEditModal}
          onOpenDelete={setDeleteTarget}
          onSelectMember={setDetailMember}
          onRetryLoadMembers={(deptId) => ensureDeptMembers(deptId, true)}
        />
      </div>

      {/* Modal 1: Thêm / Cập nhật đơn vị */}
      <ModalFormDonVi
        isOpen={isFormModalOpen}
        isEditing={isEditing}
        editingDept={editingDept}
        presetType={presetType}
        presetParentId={presetParentId}
        departments={departments}
        faculties={faculties}
        childrenByFacultyId={childrenByFacultyId}
        membersCache={membersCache}
        submitting={submitting}
        onEnsureDeptMembers={(deptId) => ensureDeptMembers(deptId)}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleSaveDepartment}
      />

      {/* Modal 2: Xác nhận xóa đơn vị (có checklist ràng buộc khớp 100% BE) */}
      <ModalXoaDonVi
        target={deleteTarget}
        childCount={deleteTarget ? (childrenByFacultyId[deleteTarget.id] || []).length : 0}
        submitting={submitting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Modal 3: Xem nhanh hồ sơ thành viên / Trưởng đơn vị */}
      <ModalHoSoThanhVien
        member={detailMember}
        departmentName={activeDepartment?.ten_phong_ban}
        onClose={() => setDetailMember(null)}
      />
    </div>
  );
};

export default Departments;
