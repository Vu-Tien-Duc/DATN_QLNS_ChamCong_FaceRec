import React from 'react';
import { X, Mail, Phone, ShieldCheck, ScanFace } from 'lucide-react';
import { UserProfile } from '../../../../types';
import { Button } from '../../../../components/chung/NutBam';
import { Portal } from '../../../../components/chung/CongDichChuyen';
import { UserAvatar } from '../../../../components/chung/AnhDaiDienNguoiDung';
import { TruongThongTin } from '../../../../components/chung/HoSoBenTrai';
import { getRoleDisplayLabel, isActiveStaff, splitNameAndTitle } from './phongBan.helpers';

interface ModalHoSoThanhVienProps {
  member: UserProfile | null;
  departmentName?: string;
  onClose: () => void;
}

export const ModalHoSoThanhVien: React.FC<ModalHoSoThanhVienProps> = ({
  member,
  departmentName,
  onClose,
}) => {
  if (!member) return null;

  const { cleanName, title } = splitNameAndTitle(member.ho_ten);
  const active = isActiveStaff(member);
  const unitLabel = member.ten_phong_ban || member.don_vi_chinh?.ten_phong_ban || departmentName || 'Chưa phân bổ';
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const activeRoles = Array.isArray(member.danh_sach_vai_tro)
    ? member.danh_sach_vai_tro.filter((r: any) => {
        if (!r) return false;
        const start = r.tu_ngay ? String(r.tu_ngay).slice(0, 10) : null;
        const end = r.den_ngay ? String(r.den_ngay).slice(0, 10) : null;
        if (start && start > todayKey) return false;
        if (end && end < todayKey) return false;
        return true;
      })
    : [];

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-3.5 min-w-0 pr-3">
              <UserAvatar
                user={member}
                name={member.ho_ten}
                avatarUrl={member.anh_dai_dien}
                staffCode={member.ma_can_bo || member.id}
                size="lg"
                shape="circle"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                    {getRoleDisplayLabel(member.vai_tro_chinh)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                    }`}
                  >
                    {active ? 'Đang hoạt động' : 'Đã khóa / Nghỉ việc'}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1 truncate">{cleanName}</h3>
                {title && <p className="text-xs text-slate-300 truncate">{title}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TruongThongTin label="Mã cán bộ" value={member.ma_can_bo || 'Chưa cấp mã'} mono />
              <TruongThongTin label="Đơn vị công tác" value={unitLabel} />
              <TruongThongTin
                label="Email công vụ"
                value={
                  <span className="inline-flex items-center gap-1.5 break-all">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {member.email || '—'}
                  </span>
                }
              />
              <TruongThongTin
                label="Số điện thoại"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {member.so_dien_thoai || 'Chưa cập nhật'}
                  </span>
                }
              />
              <TruongThongTin label="Chức vụ / Chức danh" value={member.chuc_vu || 'Chưa cập nhật'} />
              <TruongThongTin
                label="Sinh trắc học Face ID"
                value={
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      member.da_dang_ky_face
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5" />
                    {member.da_dang_ky_face ? 'Đã đăng ký Face ID' : 'Chưa đăng ký Face ID'}
                  </span>
                }
              />
            </div>

            {activeRoles.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
                  Vai trò đang gán
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeRoles.map((r: any, idx: number) => (
                    <span
                      key={`${r.ma_vai_tro}-${r.don_vi_id || 'all'}-${idx}`}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                    >
                      {getRoleDisplayLabel(r.ma_vai_tro)}
                      {r.don_vi?.ten_phong_ban ? ` • ${r.don_vi.ten_phong_ban}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex justify-end shrink-0">
            <Button variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
