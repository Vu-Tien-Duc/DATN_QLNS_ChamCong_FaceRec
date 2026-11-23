import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Compass,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateDepartmentPayload, DepartmentItem, DepartmentType, UserProfile } from '../../../../types';
import { attendanceApi } from '../../../../api/chamCong.api';
import { Button } from '../../../../components/chung/NutBam';
import { Portal } from '../../../../components/chung/CongDichChuyen';
import {
  ACADEMIC_MANAGER_ROLES,
  ADMIN_DEPT_MANAGER_ROLES,
  DeptMembersCacheEntry,
  UNIT_TYPE_META,
  getDeptManagerId,
  getDeptParentId,
  getRoleDisplayLabel,
  getUnitLeaderTitle,
  getUserPrimaryDeptId,
  isActiveStaff,
  isBghDepartmentName,
} from './phongBan.helpers';

interface ModalFormDonViProps {
  isOpen: boolean;
  isEditing: boolean;
  editingDept: DepartmentItem | null;
  presetType: DepartmentType;
  presetParentId: string;
  departments: DepartmentItem[];
  faculties: DepartmentItem[];
  childrenByFacultyId: Record<string, DepartmentItem[]>;
  membersCache: Record<string, DeptMembersCacheEntry>;
  submitting: boolean;
  onEnsureDeptMembers: (deptId: string) => void;
  onClose: () => void;
  onSubmit: (payload: CreateDepartmentPayload, editingDeptId: string | null) => Promise<void>;
}

export const ModalFormDonVi: React.FC<ModalFormDonViProps> = ({
  isOpen,
  isEditing,
  editingDept,
  presetType,
  presetParentId,
  departments,
  faculties,
  childrenByFacultyId,
  membersCache,
  submitting,
  onEnsureDeptMembers,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<DepartmentType>('khoa');
  const [parentId, setParentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);
  const [loadingCampusCoords, setLoadingCampusCoords] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    payload: CreateDepartmentPayload;
    summaryLines: string[];
    title: string;
  } | null>(null);

  // Đồng bộ giá trị khởi tạo mỗi khi mở Modal
  useEffect(() => {
    if (!isOpen) {
      setPendingConfirm(null);
      return;
    }
    setPendingConfirm(null);
    if (isEditing && editingDept) {
      setName(editingDept.ten_phong_ban || '');
      setType((editingDept.loai_don_vi as DepartmentType) || 'khoa');
      setParentId(getDeptParentId(editingDept));
      setManagerId(getDeptManagerId(editingDept));
      const lat = editingDept.vi_do ?? editingDept.toa_do?.vi_do ?? null;
      const lng = editingDept.kinh_do ?? editingDept.toa_do?.kinh_do ?? null;
      setLatitude(lat !== null && lat !== undefined ? String(lat) : '');
      setLongitude(lng !== null && lng !== undefined ? String(lng) : '');
      setRadiusMeters(editingDept.ban_kinh_met || 200);
    } else {
      setName('');
      setType(presetType);
      setParentId(presetType === 'bo_mon' ? presetParentId || faculties[0]?.id || '' : '');
      setManagerId('');
      // Tạo mới để trống tọa độ (kế thừa geofence chung của trường)
      setLatitude('');
      setLongitude('');
      setRadiusMeters(200);
    }
  }, [isOpen, isEditing, editingDept, presetType, presetParentId, faculties]);

  // Xác định nguồn lazy-load ứng viên Trưởng đơn vị (xử lý gọn Edge Case #1 cho Bộ môn)
  const candidateFetchDeptId = useMemo(() => {
    if (!isOpen) return '';
    if (type === 'bo_mon') {
      // 1 lần gọi với parentId (Khoa cha) lấy đủ cả Khoa cha và Bộ môn đó, rồi lọc lại trên FE
      return parentId || (isEditing && editingDept ? editingDept.id : '');
    }
    if (isEditing && editingDept) {
      return editingDept.id;
    }
    return '';
  }, [isOpen, isEditing, editingDept, type, parentId]);

  useEffect(() => {
    if (isOpen && candidateFetchDeptId) {
      onEnsureDeptMembers(candidateFetchDeptId);
    }
  }, [isOpen, candidateFetchDeptId, onEnsureDeptMembers]);

  const candidateEntry: DeptMembersCacheEntry = candidateFetchDeptId
    ? membersCache[candidateFetchDeptId] || { status: 'loading', users: [] }
    : { status: 'loaded', users: [] };

  const currentEditingManagerId = useMemo(
    () => (isEditing && editingDept ? getDeptManagerId(editingDept) : ''),
    [isEditing, editingDept]
  );

  // Ràng buộc khóa đổi loại đơn vị khi đang có đơn vị con / nhân sự / môn học
  const editConstraints = useMemo(() => {
    if (!isEditing || !editingDept) {
      return { hasChildren: false, hasMembers: false, hasSubjects: false, originalType: null as DepartmentType | null };
    }
    const childCount = (childrenByFacultyId[editingDept.id] || []).length;
    const totalMembers = Number(editingDept.tong_so_thanh_vien ?? editingDept.so_luong_thanh_vien ?? 0);
    const subjectCount = Number(editingDept.so_luong_mon_hoc ?? 0);
    return {
      hasChildren: childCount > 0,
      hasMembers: totalMembers > 0,
      hasSubjects: subjectCount > 0,
      originalType: editingDept.loai_don_vi as DepartmentType,
    };
  }, [isEditing, editingDept, childrenByFacultyId]);

  const isTypeOptionDisabled = (optionType: DepartmentType): boolean => {
    if (!isEditing || !editConstraints.originalType) return false;
    if (optionType === editConstraints.originalType) return false;
    // Khoa có bộ môn con -> khóa chuyển sang mọi loại khác
    if (editConstraints.hasChildren && editConstraints.originalType === 'khoa') return true;
    // Chuyển chéo khối đào tạo <-> hành chính bị khóa khi còn nhân sự hoặc môn học
    const origIsAdmin = editConstraints.originalType === 'phong_ban';
    const nextIsAdmin = optionType === 'phong_ban';
    if (origIsAdmin !== nextIsAdmin && (editConstraints.hasMembers || editConstraints.hasSubjects)) {
      return true;
    }
    return false;
  };

  const canAssignManagerInForm = useMemo(() => {
    if (isEditing) return true;
    return type === 'bo_mon' && Boolean(parentId);
  }, [isEditing, type, parentId]);

  // Lọc chặt danh sách ứng viên nội bộ đúng đơn vị, đúng khối, chưa làm trưởng đơn vị khác
  const eligibleManagers = useMemo<UserProfile[]>(() => {
    if (!canAssignManagerInForm) return [];
    const pool = candidateEntry.users || [];
    const lowerDeptName = (name || editingDept?.ten_phong_ban || '').toLowerCase();
    const isBghUnit = isBghDepartmentName(lowerDeptName);
    const editingId = isEditing && editingDept ? String(editingDept.id) : null;

    const otherDeptManagerIds = new Set<string>();
    for (const d of departments) {
      if (editingId && String(d.id) === editingId) continue;
      const mgrId = getDeptManagerId(d);
      if (mgrId) otherDeptManagerIds.add(mgrId);
    }

    const allowedDeptIds = new Set<string>();
    if (!isEditing) {
      if (type === 'bo_mon' && parentId) {
        allowedDeptIds.add(String(parentId));
        (childrenByFacultyId[String(parentId)] || []).forEach((child) => allowedDeptIds.add(String(child.id)));
      }
    } else if (editingId) {
      allowedDeptIds.add(editingId);
      if (type === 'khoa') {
        (childrenByFacultyId[editingId] || []).forEach((child) => allowedDeptIds.add(String(child.id)));
      } else if (type === 'bo_mon' && parentId) {
        allowedDeptIds.add(String(parentId));
        (childrenByFacultyId[String(parentId)] || []).forEach((child) => allowedDeptIds.add(String(child.id)));
      }
    }

    const filtered = pool.filter((u) => {
      if (!isActiveStaff(u)) return false;
      const primaryRole = String(u.vai_tro_chinh || '').toLowerCase().trim();
      const hasAdminRole =
        primaryRole === 'admin' ||
        (Array.isArray(u.danh_sach_vai_tro) &&
          u.danh_sach_vai_tro.some((r: any) => String(r?.ma_vai_tro || '').toLowerCase() === 'admin'));
      if (hasAdminRole) return false;
      if (otherDeptManagerIds.has(String(u.id))) return false;

      if (type === 'khoa' || type === 'bo_mon') {
        if (!ACADEMIC_MANAGER_ROLES.has(primaryRole)) return false;
      } else if (isBghUnit) {
        if (primaryRole !== 'bgh') return false;
      } else {
        if (!ADMIN_DEPT_MANAGER_ROLES.has(primaryRole)) return false;
      }

      const userDeptId = getUserPrimaryDeptId(u);
      return Boolean(userDeptId && allowedDeptIds.has(userDeptId));
    });

    return filtered.sort((a, b) => (a.ho_ten || '').localeCompare(b.ho_ten || '', 'vi'));
  }, [
    canAssignManagerInForm,
    candidateEntry.users,
    name,
    editingDept,
    isEditing,
    departments,
    type,
    parentId,
    childrenByFacultyId,
  ]);

  const handleUseSchoolCampusCoords = async () => {
    setLoadingCampusCoords(true);
    try {
      const res = await attendanceApi.getCampusConfig();
      const cfg = res?.data || res;
      const lat = cfg?.vi_do ?? cfg?.toa_do?.vi_do;
      const lng = cfg?.kinh_do ?? cfg?.toa_do?.kinh_do;
      const radius = cfg?.ban_kinh_met;
      if (lat == null || lng == null) {
        toast.error('Chưa cấu hình tọa độ khuôn viên trường trong Cấu hình hệ thống.');
        return;
      }
      setLatitude(String(lat));
      setLongitude(String(lng));
      if (radius && Number(radius) >= 10 && Number(radius) <= 5000) {
        setRadiusMeters(Math.round(Number(radius)));
      }
      toast.success('Đã nạp tọa độ mặc định khuôn viên trường');
    } catch {
      toast.error('Không thể tải tọa độ mặc định của trường.');
    } finally {
      setLoadingCampusCoords(false);
    }
  };

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        toast.success('Đã lấy tọa độ GPS hiện tại');
      },
      () => toast.error('Không thể truy cập vị trí GPS. Hãy cấp quyền định vị cho trình duyệt.')
    );
  };

  const handleTypeSelect = (nextType: DepartmentType) => {
    if (isTypeOptionDisabled(nextType)) return;
    setType(nextType);
    setPendingConfirm(null);
    if (nextType === 'bo_mon') {
      setParentId((prev) => prev || faculties[0]?.id || '');
    } else {
      setParentId('');
    }
    // Khi chuyển loại đơn vị (vd bo_mon -> khoa), reset managerId để chọn lại đúng phạm vi
    if (nextType !== type) {
      setManagerId('');
    }
  };

  const handleValidateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Vui lòng nhập tên đơn vị.');
      return;
    }
    if (type === 'bo_mon' && !parentId) {
      toast.error('Bộ môn bắt buộc phải trực thuộc một Khoa đào tạo.');
      return;
    }

    const latRaw = latitude.trim();
    const lngRaw = longitude.trim();
    if ((latRaw === '') !== (lngRaw === '')) {
      toast.error('Vui lòng nhập đầy đủ cả Vĩ độ và Kinh độ, hoặc để trống cả hai.');
      return;
    }
    const latNum = latRaw !== '' ? Number(latRaw) : null;
    const lngNum = lngRaw !== '' ? Number(lngRaw) : null;
    if (latNum !== null && (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)) {
      toast.error('Vĩ độ phải nằm trong khoảng [-90, 90].');
      return;
    }
    if (lngNum !== null && (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)) {
      toast.error('Kinh độ phải nằm trong khoảng [-180, 180].');
      return;
    }
    const radiusNum = Number(radiusMeters);
    if (!Number.isFinite(radiusNum) || radiusNum < 10 || radiusNum > 5000) {
      toast.error('Bán kính chấm công phải nằm trong khoảng 10 đến 5000 mét.');
      return;
    }

    const nextManagerId = canAssignManagerInForm ? managerId || '' : '';
    const payload: CreateDepartmentPayload = {
      ten_phong_ban: trimmedName,
      loai_don_vi: type,
      don_vi_cha_id: type === 'bo_mon' ? parentId : null,
      truong_don_vi_id: nextManagerId || null,
      vi_do: latNum,
      kinh_do: lngNum,
      toa_do: { vi_do: latNum, kinh_do: lngNum },
      ban_kinh_met: Math.round(radiusNum),
    };

    // Bước xác nhận inline thay cho window.confirm khi có thay đổi người phụ trách đơn vị
    const prevManagerId = isEditing ? currentEditingManagerId : '';
    if (nextManagerId !== prevManagerId && !pendingConfirm) {
      const isBghUnit = isBghDepartmentName(trimmedName || editingDept?.ten_phong_ban);
      const roleTitle = getUnitLeaderTitle(type, trimmedName || editingDept?.ten_phong_ban);
      const fallbackRoleTitle = type === 'phong_ban' ? 'Nhân viên' : 'Giảng viên';
      const nextMgr = eligibleManagers.find((u) => String(u.id) === String(nextManagerId));
      const prevMgrName =
        editingDept?.truong_don_vi?.ho_ten ||
        candidateEntry.users.find((u) => String(u.id) === String(prevManagerId))?.ho_ten ||
        'Lãnh đạo hiện tại';

      const summaryLines: string[] = [];
      let title = `Xác nhận cập nhật lãnh đạo "${trimmedName}"`;
      if (isBghUnit) {
        if (nextMgr) {
          title = 'Xác nhận cập nhật Người đứng đầu Ban Giám Hiệu';
          summaryLines.push(`Gán "${nextMgr.ho_ten}" làm ${roleTitle} của "${trimmedName}".`);
          summaryLines.push('Vai trò hệ thống Ban Giám Hiệu (BGH) của cán bộ được giữ nguyên.');
        } else if (prevManagerId) {
          title = 'Xác nhận gỡ Người đứng đầu Ban Giám Hiệu';
          summaryLines.push(`Gỡ "${prevMgrName}" khỏi vị trí đại diện đơn vị "${trimmedName}".`);
          summaryLines.push('Vai trò hệ thống Ban Giám Hiệu (BGH) của cán bộ vẫn được giữ nguyên.');
        }
      } else if (nextMgr && prevManagerId) {
        title = `Xác nhận thay đổi ${roleTitle}`;
        summaryLines.push(`Bổ nhiệm "${nextMgr.ho_ten}" và cập nhật vai trò sang ${roleTitle}.`);
        summaryLines.push(`Miễn nhiệm "${prevMgrName}" trở về vai trò ${fallbackRoleTitle}.`);
      } else if (nextMgr) {
        title = `Xác nhận bổ nhiệm ${roleTitle}`;
        summaryLines.push(`Bổ nhiệm "${nextMgr.ho_ten}" làm ${roleTitle} của "${trimmedName}".`);
        summaryLines.push(`Vai trò chính của cán bộ sẽ được đồng bộ sang ${roleTitle}.`);
      } else if (prevManagerId) {
        title = `Xác nhận miễn nhiệm ${roleTitle}`;
        summaryLines.push(`Miễn nhiệm chức vụ ${roleTitle} của "${prevMgrName}".`);
        summaryLines.push(`Vai trò của cán bộ sẽ trở về ${fallbackRoleTitle}.`);
      }

      if (summaryLines.length > 0) {
        setPendingConfirm({ payload, summaryLines, title });
        return;
      }
    }

    await onSubmit(payload, isEditing && editingDept ? editingDept.id : null);
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        onClick={() => !submitting && onClose()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEditing
                    ? `Cập Nhật Đơn Vị: ${editingDept?.ten_phong_ban}`
                    : presetType === 'bo_mon'
                      ? 'Thêm Mới Bộ Môn Chuyên Môn'
                      : 'Thêm Mới Khoa / Phòng Ban'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {!isEditing && presetType === 'bo_mon'
                    ? 'Đơn vị cấp 2 trực thuộc Khoa đào tạo & Geofence điểm danh'
                    : 'Cơ cấu phân cấp tổ chức & Geofence điểm danh'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleValidateAndSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Khối 1: Thông tin & Phân cấp */}
              <div className="space-y-3.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {!isEditing && presetType === 'bo_mon' ? '1. Thông tin Bộ môn' : '1. Phân loại & Thông tin đơn vị'}
                </div>

                {/* Khi thêm Bộ môn: ẩn hàng tab loại đơn vị; khi thêm Khoa/Phòng ban: chỉ hiện 2 loại cấp 1; khi Sửa: giữ đủ 3 loại */}
                {(isEditing || presetType !== 'bo_mon') && (
                  <div className={`grid grid-cols-1 ${isEditing ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
                    {(isEditing
                      ? [
                          { id: 'khoa' as DepartmentType, title: 'Khoa Đào Tạo', sub: 'Cấp 1 • Trực thuộc BGH' },
                          { id: 'bo_mon' as DepartmentType, title: 'Bộ Môn', sub: 'Cấp 2 • Trực thuộc Khoa' },
                          { id: 'phong_ban' as DepartmentType, title: 'Phòng Ban', sub: 'Cấp 1 • Khối Hành chính' },
                        ]
                      : [
                          { id: 'khoa' as DepartmentType, title: 'Khoa Đào Tạo', sub: 'Cấp 1 • Trực thuộc BGH' },
                          { id: 'phong_ban' as DepartmentType, title: 'Phòng Ban', sub: 'Cấp 1 • Khối Hành chính' },
                        ]
                    ).map((item) => {
                      const disabled = isTypeOptionDisabled(item.id);
                      const active = type === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleTypeSelect(item.id)}
                          className={`p-3 rounded-2xl border text-left transition-all ${
                            active
                              ? 'border-brand-600 bg-brand-50/70 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                              : disabled
                                ? 'border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-50 cursor-not-allowed'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 cursor-pointer'
                          }`}
                        >
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{item.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {isEditing && (editConstraints.hasChildren || editConstraints.hasMembers || editConstraints.hasSubjects) && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                    Một số tùy chọn chuyển loại đơn vị bị khóa vì đơn vị đang có bộ môn con, nhân sự hoặc môn học trực thuộc.
                  </p>
                )}

                {isEditing && editConstraints.originalType === 'bo_mon' && type === 'khoa' && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Đổi Bộ môn sang Khoa sẽ tách khỏi Khoa cha cũ. Nếu Trưởng Bộ môn cũ thuộc Khoa cha, vui lòng chọn lại Trưởng Khoa hoặc để trống bổ nhiệm sau.
                    </span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên đơn vị ({UNIT_TYPE_META[type]?.label}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setPendingConfirm(null);
                    }}
                    placeholder={
                      type === 'khoa'
                        ? 'VD: Khoa Công nghệ Thông tin'
                        : type === 'bo_mon'
                          ? 'VD: Bộ môn Kỹ thuật Phần mềm'
                          : 'VD: Phòng Tổ chức Cán bộ'
                    }
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                </div>

                {type === 'bo_mon' ? (
                  <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
                    <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      Khoa đào tạo chủ quản <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={parentId}
                      onChange={(e) => {
                        setParentId(e.target.value);
                        setManagerId('');
                        setPendingConfirm(null);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    >
                      <option value="">-- Chọn Khoa đào tạo chủ quản --</option>
                      {faculties
                        .filter((f) => !editingDept || f.id !== editingDept.id)
                        .map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.ten_phong_ban}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-brand-600 shrink-0" />
                    <span>Đơn vị cấp 1 trực thuộc trực tiếp <strong>Ban Giám Hiệu Nhà Trường</strong>.</span>
                  </div>
                )}
              </div>

              {/* Khối 2: Bổ nhiệm Trưởng đơn vị (ẩn ô chọn khi tạo mới Khoa/Phòng ban chưa có nhân sự) */}
              {canAssignManagerInForm ? (
                <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-brand-500" />
                      2. {getUnitLeaderTitle(type, name || editingDept?.ten_phong_ban)}
                    </span>
                    {candidateEntry.status === 'loading' && (
                      <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải nhân sự đơn vị...
                      </span>
                    )}
                  </div>

                  <select
                    value={managerId}
                    disabled={candidateEntry.status === 'loading'}
                    onChange={(e) => {
                      setManagerId(e.target.value);
                      setPendingConfirm(null);
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
                  >
                    <option value="">-- Chưa bổ nhiệm / Bổ nhiệm sau --</option>
                    {eligibleManagers.map((u) => {
                      const deptLabel = u.ten_phong_ban || u.don_vi_chinh?.ten_phong_ban || '';
                      return (
                        <option key={u.id} value={u.id}>
                          {u.ho_ten} ({u.ma_can_bo || u.email})
                          {deptLabel ? ` — ${deptLabel}` : ''} • {getRoleDisplayLabel(u.vai_tro_chinh)}
                        </option>
                      );
                    })}
                  </select>

                  {candidateEntry.status === 'loaded' && eligibleManagers.length === 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                      Chưa có nhân sự nội bộ đủ điều kiện thuộc phạm vi đơn vị này (cùng khối công tác, đang hoạt động và chưa làm trưởng đơn vị khác). Hãy điều chuyển nhân sự vào đơn vị tại mục Danh sách cán bộ trước.
                    </p>
                  )}

                  {/* Bước xác nhận inline thay cho window.confirm */}
                  {pendingConfirm && (
                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            {pendingConfirm.title}
                          </div>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-200/90">
                            {pendingConfirm.summaryLines.map((line, idx) => (
                              <li key={idx}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingConfirm(null)}
                          disabled={submitting}
                        >
                          Quay lại sửa
                        </Button>
                        <Button type="submit" variant="primary" size="sm" isLoading={submitting}>
                          Xác nhận & Lưu
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                    <UserCheck className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-slate-800 dark:text-slate-100">Bổ nhiệm {getUnitLeaderTitle(type, name)}:</strong>{' '}
                      Sau khi tạo đơn vị, hãy thêm hoặc điều chuyển nhân sự vào đơn vị tại mục <strong>Danh sách cán bộ</strong>, rồi quay lại <strong>Chỉnh sửa</strong> để bổ nhiệm người phụ trách.
                    </p>
                  </div>
                </div>
              )}

              {/* Khối 3: Geofence GPS */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-emerald-500" />
                    {canAssignManagerInForm ? '3.' : '2.'} Tọa độ Geofence & Bán kính điểm danh
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={loadingCampusCoords}
                      onClick={handleUseSchoolCampusCoords}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loadingCampusCoords ? 'Đang lấy...' : 'Lấy tọa độ Trường'}
                    </button>
                    <button
                      type="button"
                      onClick={handleUseBrowserGps}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold hover:bg-slate-200/80 dark:hover:bg-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <MapPin className="w-3 h-3" /> GPS hiện tại
                    </button>
                    {(latitude || longitude) && (
                      <button
                        type="button"
                        onClick={() => {
                          setLatitude('');
                          setLongitude('');
                        }}
                        className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 text-[11px] font-semibold cursor-pointer"
                      >
                        Xóa tọa độ
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Vĩ độ (Latitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="Để trống = theo trường"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Kinh độ (Longitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="Để trống = theo trường"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                      Bán kính (10–5000m)
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Để trống cả Vĩ độ và Kinh độ nếu muốn đơn vị kế thừa tọa độ Geofence chung của toàn trường.
                </p>
              </div>
            </div>

            {!pendingConfirm && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
                <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" isLoading={submitting}>
                  {isEditing ? 'Lưu Cập Nhật' : 'Tạo Đơn Vị'}
                </Button>
              </div>
            )}
          </form>
        </div>
      </div>
    </Portal>
  );
};
