import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Compass,
  Edit,
  ExternalLink,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  MapPin,
  Plus,
  RefreshCw,
  ScanFace,
  Search,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  Users as UsersIcon,
} from 'lucide-react';
import { DepartmentItem, DepartmentType, UserProfile } from '../../../../types';
import { Card, CardContent } from '../../../../components/chung/TheThongTin';
import { Button } from '../../../../components/chung/NutBam';
import { Badge } from '../../../../components/chung/NhanTrangThai';
import { UserAvatar } from '../../../../components/chung/AnhDaiDienNguoiDung';
import {
  DepartmentAggregateStats,
  DeptMembersCacheEntry,
  UNIT_TYPE_META,
  getDeptManagerId,
  getDeptParentId,
  getRoleDisplayLabel,
  getUnitDeputyMeta,
  getUnitLeaderTitle,
  getUserPrimaryDeptId,
  isActiveStaff,
  isBghDepartmentName,
  splitNameAndTitle,
} from './phongBan.helpers';

interface ChiTietDonViPanelProps {
  selectedNodeId: string;
  activeDepartment: DepartmentItem | null;
  departments: DepartmentItem[];
  faculties: DepartmentItem[];
  functionalDepts: DepartmentItem[];
  childrenByFacultyId: Record<string, DepartmentItem[]>;
  totalCampusStaff: number;
  isAdmin: boolean;
  canFetchUsers: boolean;
  membersEntry: DeptMembersCacheEntry;
  getAggregateStats: (dept: DepartmentItem) => DepartmentAggregateStats;
  onSelectNode: (nodeId: string) => void;
  onOpenCreate: (presetType: DepartmentType, presetParentId?: string) => void;
  onOpenEdit: (dept: DepartmentItem, e?: React.MouseEvent) => void;
  onOpenDelete: (dept: DepartmentItem) => void;
  onSelectMember: (member: UserProfile) => void;
  onRetryLoadMembers: (deptId: string) => void;
}

export const ChiTietDonViPanel: React.FC<ChiTietDonViPanelProps> = ({
  selectedNodeId,
  activeDepartment,
  departments,
  faculties,
  functionalDepts,
  childrenByFacultyId,
  totalCampusStaff,
  isAdmin,
  canFetchUsers,
  membersEntry,
  getAggregateStats,
  onSelectNode,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
  onSelectMember,
  onRetryLoadMembers,
}) => {
  const navigate = useNavigate();
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffFaceFilter, setStaffFaceFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'active' | 'all'>('active');
  const [subDeptFilter, setSubDeptFilter] = useState<string>('ALL');

  // Reset bộ lọc khi chuyển đơn vị khác
  useEffect(() => {
    setStaffSearchQuery('');
    setStaffFaceFilter('all');
    setStaffStatusFilter('active');
    setSubDeptFilter('ALL');
  }, [selectedNodeId]);

  const unassignedUnits = useMemo(
    () => departments.filter((d) => !getDeptManagerId(d)),
    [departments]
  );

  const deptNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.id, d.ten_phong_ban));
    return map;
  }, [departments]);

  // Danh sách bộ môn con nếu đang xem Khoa
  const childDepartments = useMemo(() => {
    if (!activeDepartment || activeDepartment.loai_don_vi !== 'khoa') return [];
    return childrenByFacultyId[activeDepartment.id] || [];
  }, [activeDepartment, childrenByFacultyId]);

  // Tập ID đơn vị chính thức của nút đang chọn (Khoa gồm chính Khoa + các Bộ môn con)
  const officialDeptIdSet = useMemo(() => {
    const set = new Set<string>();
    if (!activeDepartment) return set;
    set.add(activeDepartment.id);
    childDepartments.forEach((c) => set.add(c.id));
    return set;
  }, [activeDepartment, childDepartments]);

  // Phân loại nhân sự chính thức vs kiêm nhiệm (Edge Case #3) và áp bộ lọc
  const classifiedMembers = useMemo(() => {
    const raw = membersEntry.users || [];
    return raw.map((u) => {
      const primaryDeptId = getUserPrimaryDeptId(u);
      const isOfficial = Boolean(primaryDeptId && officialDeptIdSet.has(primaryDeptId));
      return { user: u, primaryDeptId, isOfficial };
    });
  }, [membersEntry.users, officialDeptIdSet]);

  const officialActiveCount = useMemo(
    () => classifiedMembers.filter((m) => m.isOfficial && isActiveStaff(m.user)).length,
    [classifiedMembers]
  );

  const concurrentActiveCount = useMemo(
    () => classifiedMembers.filter((m) => !m.isOfficial && isActiveStaff(m.user)).length,
    [classifiedMembers]
  );

  // Danh sách Phó đơn vị (Phó Trưởng Khoa / Phó Trưởng Bộ môn / Phó Trưởng Phòng) còn hiệu lực của đơn vị đang xem
  const deputyMeta = useMemo(
    () => (activeDepartment ? getUnitDeputyMeta(activeDepartment.loai_don_vi, activeDepartment.ten_phong_ban) : null),
    [activeDepartment]
  );

  const deputyLeaders = useMemo(() => {
    if (!activeDepartment || !deputyMeta) return [] as Array<{ user: UserProfile; isDelegated: boolean }>;
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const activeDeptId = String(activeDepartment.id);
    const list: Array<{ user: UserProfile; isDelegated: boolean }> = [];

    for (const { user, primaryDeptId } of classifiedMembers) {
      if (!isActiveStaff(user)) continue;
      const roleRows = Array.isArray(user.danh_sach_vai_tro) ? user.danh_sach_vai_tro : [];
      const matchingRoleRow = roleRows.find((r: any) => {
        if (!r || String(r.ma_vai_tro || '').toLowerCase().trim() !== deputyMeta.role) return false;
        const rowDeptId = r.don_vi_id ? String(r.don_vi_id) : primaryDeptId;
        if (rowDeptId !== activeDeptId) return false;
        const start = r.tu_ngay ? String(r.tu_ngay).slice(0, 10) : null;
        const end = r.den_ngay ? String(r.den_ngay).slice(0, 10) : null;
        if (start && start > todayKey) return false;
        if (end && end < todayKey) return false;
        return true;
      });
      const isPrimaryDeputy =
        String(user.vai_tro_chinh || '').toLowerCase().trim() === deputyMeta.role &&
        primaryDeptId === activeDeptId;

      if (matchingRoleRow || isPrimaryDeputy) {
        list.push({
          user,
          isDelegated: Boolean((matchingRoleRow as any)?.duoc_uy_quyen),
        });
      }
    }
    return list.sort((a, b) => (a.user.ho_ten || '').localeCompare(b.user.ho_ten || '', 'vi'));
  }, [activeDepartment, deputyMeta, classifiedMembers]);

  const filteredMembers = useMemo(() => {
    const q = staffSearchQuery.toLowerCase().trim();
    return classifiedMembers.filter(({ user, primaryDeptId, isOfficial }) => {
      if (staffStatusFilter === 'active' && !isActiveStaff(user)) return false;
      if (staffFaceFilter === 'registered' && !user.da_dang_ky_face) return false;
      if (staffFaceFilter === 'unregistered' && user.da_dang_ky_face) return false;

      if (activeDepartment?.loai_don_vi === 'khoa' && subDeptFilter !== 'ALL') {
        if (subDeptFilter === 'CONCURRENT') {
          if (isOfficial) return false;
        } else if (subDeptFilter === 'DIRECT') {
          if (primaryDeptId !== activeDepartment.id) return false;
        } else {
          if (primaryDeptId !== subDeptFilter) return false;
        }
      }

      if (q) {
        const name = (user.ho_ten || '').toLowerCase();
        const code = (user.ma_can_bo || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [classifiedMembers, staffStatusFilter, staffFaceFilter, staffSearchQuery, activeDepartment, subDeptFilter]);

  // ===========================================================================
  // CHẾ ĐỘ 1: TỔNG QUAN TOÀN TRƯỜNG (ROOT_BGH)
  // ===========================================================================
  if (!activeDepartment || selectedNodeId === 'ROOT_BGH') {
    return (
      <div className="lg:col-span-8 p-4 sm:p-6 space-y-5 min-w-0">
        {/* Banner Ban Giám Hiệu */}
        <Card className="border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
          <CardContent className="p-5 sm:p-6 bg-gradient-to-br from-brand-50/70 via-white to-slate-50/60 dark:from-brand-950/30 dark:via-slate-900 dark:to-slate-950 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                    Cơ Cấu Tổ Chức Trường Đại Học Nguyễn Trãi
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tổng số <strong>{totalCampusStaff}</strong> cán bộ/giảng viên đang hoạt động trực thuộc các đơn vị ({departments.length} đơn vị).
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => onOpenCreate('khoa')}
                >
                  Thêm Khoa mới
                </Button>
              )}
            </div>

            {unassignedUnits.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    Đơn vị chưa bổ nhiệm Trưởng đơn vị ({unassignedUnits.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedUnits.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onSelectNode(u.id)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:border-amber-400 transition-colors cursor-pointer"
                    >
                      {u.ten_phong_ban}
                    </button>
                  ))}
                  {unassignedUnits.length > 8 && (
                    <span className="px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                      +{unassignedUnits.length - 8} đơn vị khác
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lưới Khối Khoa Đào Tạo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              Khối Khoa Đào Tạo ({faculties.length})
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onOpenCreate('khoa')}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Khoa
              </button>
            )}
          </div>
          {faculties.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Chưa có Khoa đào tạo nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {faculties.map((f) => {
                const agg = getAggregateStats(f);
                const mgrName = f.truong_don_vi?.ho_ten ? splitNameAndTitle(f.truong_don_vi.ho_ten).cleanName : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onSelectNode(f.id)}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400 dark:hover:border-brand-700 hover:shadow-sm transition-all text-left space-y-2.5 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                          {f.ten_phong_ban}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {mgrName ? `Trưởng Khoa: ${mgrName}` : 'Chưa bổ nhiệm Trưởng Khoa'}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <UsersIcon className="w-3.5 h-3.5 text-brand-500" />
                        {agg.totalMembers} nhân sự
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        {agg.childCount} bộ môn
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                        {agg.totalSubjects} môn
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Lưới Khối Phòng Ban Chức Năng */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Khối Phòng Ban Chức Năng ({functionalDepts.length})
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onOpenCreate('phong_ban')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Phòng ban
              </button>
            )}
          </div>
          {functionalDepts.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Chưa có Phòng ban chức năng nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {functionalDepts.map((pb) => {
                const mgrName = pb.truong_don_vi?.ho_ten ? splitNameAndTitle(pb.truong_don_vi.ho_ten).cleanName : null;
                const leaderLabel = isBghDepartmentName(pb.ten_phong_ban) ? 'Người đứng đầu' : 'Trưởng phòng';
                return (
                  <button
                    key={pb.id}
                    type="button"
                    onClick={() => onSelectNode(pb.id)}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-sm transition-all text-left space-y-2 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate">
                          {pb.ten_phong_ban}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {mgrName ? `${leaderLabel}: ${mgrName}` : `Chưa gán ${leaderLabel.toLowerCase()}`}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shrink-0">
                        {pb.so_luong_thanh_vien ?? 0} NS
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // CHẾ ĐỘ 2: CHI TIẾT MỘT ĐƠN VỊ CỤ THỂ (KHOA / BỘ MÔN / PHÒNG BAN)
  // ===========================================================================
  const agg = getAggregateStats(activeDepartment);
  const parentId = getDeptParentId(activeDepartment);
  const parentDeptName =
    activeDepartment.don_vi_cha?.ten_phong_ban || (parentId ? deptNameMap.get(parentId) : '') || '';
  const managerRef = activeDepartment.truong_don_vi || null;
  const lat = activeDepartment.vi_do ?? activeDepartment.toa_do?.vi_do ?? null;
  const lng = activeDepartment.kinh_do ?? activeDepartment.toa_do?.kinh_do ?? null;
  const hasGps = lat !== null && lng !== null;

  const handleOpenManagerProfile = () => {
    if (!managerRef) return;
    const foundFull = membersEntry.users.find((u) => String(u.id) === String(managerRef.id));
    if (foundFull) {
      onSelectMember(foundFull);
      return;
    }
    onSelectMember({
      id: managerRef.id,
      ho_ten: managerRef.ho_ten,
      email: managerRef.email || '',
      ma_can_bo: managerRef.ma_can_bo || '',
      vai_tro_chinh: managerRef.vai_tro_chinh || 'giang_vien',
      anh_dai_dien: managerRef.anh_dai_dien || null,
      ten_phong_ban: activeDepartment.ten_phong_ban,
      kich_hoat: managerRef.kich_hoat !== false,
      da_dang_ky_face: false,
    });
  };

  return (
    <div className="lg:col-span-8 p-4 sm:p-6 space-y-5 min-w-0">
      {/* 1. Header Đơn vị + Breadcrumb + Nút thao tác */}
      <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
        <CardContent className="p-5 space-y-3.5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectNode('ROOT_BGH')}
              className="hover:text-brand-600 dark:hover:text-brand-400 font-medium cursor-pointer"
            >
              Trường ĐH Nguyễn Trãi
            </button>
            {activeDepartment.loai_don_vi === 'bo_mon' && parentId && (
              <>
                <span>/</span>
                <button
                  type="button"
                  onClick={() => onSelectNode(parentId)}
                  className="hover:text-brand-600 dark:hover:text-brand-400 font-medium cursor-pointer"
                >
                  {parentDeptName || 'Khoa chủ quản'}
                </button>
              </>
            )}
            <span>/</span>
            <span className="text-slate-600 dark:text-slate-300 font-semibold">
              {activeDepartment.ten_phong_ban}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
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
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {activeDepartment.ten_phong_ban}
                  </h2>
                  <Badge variant={UNIT_TYPE_META[activeDepartment.loai_don_vi]?.badgeVariant || 'info'} size="sm">
                    {UNIT_TYPE_META[activeDepartment.loai_don_vi]?.label || activeDepartment.loai_don_vi}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                  <span>
                    <strong className="text-slate-700 dark:text-slate-200">{agg.totalMembers}</strong> nhân sự đang hoạt động
                  </span>
                  {activeDepartment.loai_don_vi === 'khoa' && (
                    <span>
                      • <strong className="text-slate-700 dark:text-slate-200">{agg.childCount}</strong> bộ môn
                    </span>
                  )}
                  {(activeDepartment.loai_don_vi === 'khoa' || activeDepartment.loai_don_vi === 'bo_mon') && (
                    <span>
                      • <strong className="text-slate-700 dark:text-slate-200">{agg.totalSubjects}</strong> môn học
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {activeDepartment.loai_don_vi === 'khoa' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    leftIcon={<Plus className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                    onClick={() => onOpenCreate('bo_mon', activeDepartment.id)}
                  >
                    Thêm Bộ Môn
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  leftIcon={<Edit className="w-3.5 h-3.5 text-brand-600" />}
                  onClick={(e) => onOpenEdit(activeDepartment, e)}
                >
                  Sửa
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="text-xs"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => onOpenDelete(activeDepartment)}
                >
                  Xóa
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Hai thẻ thông tin: Lãnh đạo phụ trách & Geofence GPS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Thẻ Trưởng đơn vị */}
        <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                {getUnitLeaderTitle(activeDepartment.loai_don_vi, activeDepartment.ten_phong_ban)}
              </span>
              {isAdmin && managerRef && (
                <button
                  type="button"
                  onClick={(e) => onOpenEdit(activeDepartment, e)}
                  className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  Đổi / Miễn nhiệm
                </button>
              )}
            </div>

            {managerRef ? (
              (() => {
                const { cleanName, title } = splitNameAndTitle(managerRef.ho_ten);
                return (
                  <button
                    type="button"
                    onClick={handleOpenManagerProfile}
                    className="w-full flex items-center gap-3.5 pt-1 text-left rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 -m-1.5 transition-colors cursor-pointer"
                  >
                    <UserAvatar
                      user={managerRef}
                      name={managerRef.ho_ten}
                      avatarUrl={managerRef.anh_dai_dien}
                      staffCode={managerRef.ma_can_bo || managerRef.id}
                      size="md"
                      shape="circle"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cleanName}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {managerRef.ma_can_bo && (
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] font-semibold">
                            {managerRef.ma_can_bo}
                          </span>
                        )}
                        {title && <span className="truncate">{title}</span>}
                      </div>
                      {managerRef.email && (
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" /> {managerRef.email}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })()
            ) : (
              <div className="py-3 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 italic flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 opacity-50" />
                  Chưa bổ nhiệm lãnh đạo
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => onOpenEdit(activeDepartment, e)}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer shrink-0"
                  >
                    Bổ nhiệm ngay
                  </button>
                )}
              </div>
            )}

            {/* Phần Phó Trưởng Khoa / Phó Trưởng Bộ môn / Phó Trưởng Phòng */}
            {deputyMeta && (
              <div className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <UsersIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    {deputyMeta.title}
                    {deputyLeaders.length > 0 && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {deputyLeaders.length}
                      </span>
                    )}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => navigate('/nguoi-dung')}
                      className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                    >
                      Phân công / Ủy quyền
                    </button>
                  )}
                </div>

                {deputyLeaders.length > 0 ? (
                  <div className="space-y-1.5">
                    {deputyLeaders.map(({ user: depUser, isDelegated }) => {
                      const { cleanName, title } = splitNameAndTitle(depUser.ho_ten);
                      return (
                        <button
                          key={depUser.id}
                          type="button"
                          onClick={() => onSelectMember(depUser)}
                          className="w-full flex items-center gap-3 text-left rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 p-1.5 -m-1.5 transition-colors cursor-pointer"
                        >
                          <UserAvatar
                            user={depUser}
                            name={depUser.ho_ten}
                            avatarUrl={depUser.anh_dai_dien}
                            staffCode={depUser.ma_can_bo || depUser.id}
                            size="sm"
                            shape="circle"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cleanName}
                              </span>
                              {isDelegated && (
                                <span
                                  title="Được ủy quyền duyệt đơn cấp 1 & xếp lịch/môn học thay Trưởng đơn vị"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800"
                                >
                                  <ShieldCheck className="w-2.5 h-2.5" /> Ủy quyền
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {depUser.ma_can_bo && (
                                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                                  {depUser.ma_can_bo}
                                </span>
                              )}
                              {title && <span className="truncate">{title}</span>}
                              {depUser.email && (
                                <span className="text-slate-400 truncate inline-flex items-center gap-1">
                                  <Mail className="w-2.5 h-2.5 shrink-0" /> {depUser.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">
                    {membersEntry.status === 'loading'
                      ? 'Đang tải danh sách lãnh đạo...'
                      : `Chưa có ${deputyMeta.title} được phân công.`}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Thẻ Tọa độ Geofence */}
        <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Tọa Độ Geofence
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                Bán kính: {activeDepartment.ban_kinh_met || 200}m
              </span>
            </div>

            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate">
                    {hasGps
                      ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
                      : 'Kế thừa tọa độ mặc định của trường'}
                  </span>
                </span>
                {hasGps && (
                  <a
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    Bản đồ <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {hasGps
                  ? `Phạm vi điểm danh hợp lệ trong bán kính ${activeDepartment.ban_kinh_met || 200}m quanh tọa độ riêng của đơn vị.`
                  : 'Đơn vị chưa thiết lập tọa độ riêng, hệ thống tự động áp dụng cấu hình Geofence khuôn viên trường.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Bộ môn trực thuộc (nếu là Khoa) */}
      {activeDepartment.loai_don_vi === 'khoa' && (
        <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
          <CardContent className="p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                Bộ Môn Chuyên Môn Trực Thuộc ({childDepartments.length})
              </h4>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onOpenCreate('bo_mon', activeDepartment.id)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm Bộ môn
                </button>
              )}
            </div>

            {childDepartments.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                Khoa này chưa có bộ môn trực thuộc nào.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {childDepartments.map((bm) => (
                  <button
                    key={bm.id}
                    type="button"
                    onClick={() => onSelectNode(bm.id)}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-500/60 hover:shadow-2xs transition-all text-left space-y-2 cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                      {bm.ten_phong_ban}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {bm.truong_don_vi?.ho_ten
                        ? `TBM: ${splitNameAndTitle(bm.truong_don_vi.ho_ten).cleanName}`
                        : 'Chưa có Trưởng BM'}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>{bm.so_luong_thanh_vien ?? 0} nhân sự</span>
                      <span>{bm.so_luong_mon_hoc ?? 0} môn</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. Danh sách Nhân sự trực thuộc (Lazy-load per deptId) */}
      <Card className="border-slate-200/80 dark:border-slate-800/80 shadow-xs rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                {activeDepartment.loai_don_vi === 'khoa'
                  ? `Danh Sách Nhân Sự Toàn Khoa (${agg.totalMembers})`
                  : `Nhân Sự Trực Thuộc (${agg.totalMembers})`}
              </h4>
              {membersEntry.status === 'loaded' && concurrentActiveCount > 0 && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {officialActiveCount} nhân sự chính thức • {concurrentActiveCount} cán bộ kiêm nhiệm
                </p>
              )}
            </div>
            {canFetchUsers && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs self-start sm:self-auto"
                onClick={() => navigate('/nguoi-dung')}
              >
                Quản lý / Điều chuyển nhân sự
              </Button>
            )}
          </div>

          {!canFetchUsers ? (
            <div className="p-5 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Đơn vị hiện có {agg.totalMembers} cán bộ, giảng viên đang hoạt động.
              </p>
              <p className="text-[11px] text-slate-400">
                Danh sách hồ sơ chi tiết chỉ hiển thị cho Ban Giám Hiệu, TCCB, Đào tạo và Lãnh đạo đơn vị.
              </p>
            </div>
          ) : membersEntry.status === 'loading' || membersEntry.status === 'idle' ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-500" />
              Đang tải danh sách nhân sự đơn vị...
            </div>
          ) : membersEntry.status === 'forbidden' ? (
            <div className="p-5 rounded-xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center gap-1.5">
              <Lock className="w-5 h-5 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bạn chỉ có quyền xem chi tiết nhân sự thuộc đơn vị quản lý.
              </p>
              <p className="text-[11px] text-slate-400">
                Tổng sĩ số đang hoạt động tại đơn vị này: {agg.totalMembers} nhân sự.
              </p>
            </div>
          ) : membersEntry.status === 'error' ? (
            <div className="p-5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900 flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {membersEntry.errorMessage || 'Không thể tải danh sách nhân sự.'}
              </p>
              <Button variant="outline" size="sm" onClick={() => onRetryLoadMembers(activeDepartment.id)}>
                Thử lại
              </Button>
            </div>
          ) : (
            <>
              {/* Bộ lọc nhánh con (khi xem Khoa có Bộ môn con) */}
              {activeDepartment.loai_don_vi === 'khoa' && (childDepartments.length > 0 || concurrentActiveCount > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'ALL', label: `Toàn Khoa (${agg.totalMembers})` },
                    { id: 'DIRECT', label: `Trực thuộc Khoa (${agg.directMembers})` },
                    ...childDepartments.map((bm) => ({
                      id: bm.id,
                      label: `${bm.ten_phong_ban} (${bm.so_luong_thanh_vien ?? 0})`,
                    })),
                    ...(concurrentActiveCount > 0
                      ? [{ id: 'CONCURRENT', label: `Kiêm nhiệm (${concurrentActiveCount})` }]
                      : []),
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSubDeptFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        subDeptFilter === tab.id
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Thanh tìm kiếm + lọc Face ID + lọc trạng thái */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    placeholder="Tìm tên, mã cán bộ, email..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <select
                  value={staffStatusFilter}
                  onChange={(e) => setStaffStatusFilter(e.target.value as 'active' | 'all')}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="all">Tất cả (gồm đã khóa)</option>
                </select>
                <select
                  value={staffFaceFilter}
                  onChange={(e) => setStaffFaceFilter(e.target.value as 'all' | 'registered' | 'unregistered')}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                >
                  <option value="all">Tất cả Face ID</option>
                  <option value="registered">Đã đăng ký Face ID</option>
                  <option value="unregistered">Chưa đăng ký Face ID</option>
                </select>
              </div>

              {/* Danh sách nhân sự */}
              {filteredMembers.length === 0 ? (
                <div className="py-8 text-center rounded-xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  Không có nhân sự nào khớp bộ lọc hiện tại.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {filteredMembers.map(({ user: member, primaryDeptId, isOfficial }) => {
                    const { cleanName } = splitNameAndTitle(member.ho_ten);
                    const active = isActiveStaff(member);
                    const memberDeptName =
                      member.ten_phong_ban || member.don_vi_chinh?.ten_phong_ban || deptNameMap.get(primaryDeptId) || '';
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => onSelectMember(member)}
                        className={`w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          !active ? 'opacity-65 bg-slate-50/40 dark:bg-slate-950/30' : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <UserAvatar
                            user={member}
                            name={member.ho_ten}
                            avatarUrl={member.anh_dai_dien}
                            staffCode={member.ma_can_bo || member.id}
                            size="sm"
                            shape="circle"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {cleanName}
                              </span>
                              {member.ma_can_bo && (
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                                  {member.ma_can_bo}
                                </span>
                              )}
                              {!isOfficial && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold">
                                  Kiêm nhiệm
                                </span>
                              )}
                              {!active && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold">
                                  Đã khóa
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {getRoleDisplayLabel(member.vai_tro_chinh)}
                              {activeDepartment.loai_don_vi === 'khoa' && memberDeptName ? ` • ${memberDeptName}` : ''}
                              {member.email ? ` • ${member.email}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              member.da_dang_ky_face
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            <ScanFace className="w-3 h-3" />
                            {member.da_dang_ky_face ? 'Face ID' : 'Chưa ĐK'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
