import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { DepartmentItem } from '../../../../types';
import { Button } from '../../../../components/chung/NutBam';
import { Portal } from '../../../../components/chung/CongDichChuyen';

interface ModalXoaDonViProps {
  target: DepartmentItem | null;
  childCount: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ModalXoaDonVi: React.FC<ModalXoaDonViProps> = ({
  target,
  childCount,
  submitting,
  onClose,
  onConfirm,
}) => {
  if (!target) return null;

  const activeMembers = Number(target.so_luong_thanh_vien ?? 0);
  const totalLinkedMembers = Number(target.tong_so_thanh_vien ?? activeMembers);
  const inactiveMembers = Math.max(0, totalLinkedMembers - activeMembers);
  const subjectCount = Number(target.so_luong_mon_hoc ?? 0);

  const hasBlockers = totalLinkedMembers > 0 || childCount > 0 || subjectCount > 0;

  const checks = [
    {
      label: 'Nhân sự gắn với đơn vị',
      count: totalLinkedMembers,
      detail:
        totalLinkedMembers === 0
          ? 'Không có nhân sự trực thuộc'
          : inactiveMembers > 0
            ? `${totalLinkedMembers} nhân sự (${activeMembers} đang hoạt động, ${inactiveMembers} đã khóa/nghỉ việc)`
            : `${totalLinkedMembers} nhân sự đang trực thuộc`,
    },
    {
      label: 'Bộ môn / đơn vị con trực thuộc',
      count: childCount,
      detail: childCount === 0 ? 'Không có đơn vị con' : `${childCount} bộ môn trực thuộc`,
    },
    {
      label: 'Môn học thuộc đơn vị',
      count: subjectCount,
      detail: subjectCount === 0 ? 'Không có môn học gắn kết' : `${subjectCount} môn học đang gắn đơn vị`,
    },
  ];

  return (
    <Portal>
      <div
        onClick={() => !submitting && onClose()}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
        >
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200/60 dark:border-rose-800/40 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Xác nhận xóa đơn vị tổ chức?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Đơn vị: <strong className="text-slate-800 dark:text-slate-200">{target.ten_phong_ban}</strong>.
                Hệ thống kiểm tra đủ 3 ràng buộc toàn vẹn trước khi cho phép xóa:
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-2.5">
            {checks.map((item) => {
              const ok = item.count === 0;
              return (
                <div key={item.label} className="flex items-start gap-2.5 text-xs">
                  {ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</div>
                    <div className={ok ? 'text-emerald-600 dark:text-emerald-400 text-[11px]' : 'text-rose-600 dark:text-rose-400 text-[11px]'}>
                      {item.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasBlockers && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed">
              Không thể xóa đơn vị này cho đến khi chuyển hết nhân sự (kể cả tài khoản đã khóa), bộ môn con và môn học sang đơn vị khác.
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Đóng
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onConfirm}
              disabled={hasBlockers || submitting}
              isLoading={submitting}
            >
              Xác nhận xóa
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
