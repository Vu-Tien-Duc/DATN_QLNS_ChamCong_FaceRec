import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Portal } from '../../../components/chung/CongDichChuyen';
import { Button } from '../../../components/chung/NutBam';

interface ExceptionFormData {
  date: string;
  status: 'nghi' | 'day_bu' | 'huy' | string;
  makeupDate: string;
  reason: string;
}

interface ModalNgoaiLeLichTrinhProps {
  isOpen: boolean;
  exceptionData: ExceptionFormData;
  submitting: boolean;
  onChange: (next: ExceptionFormData) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalNgoaiLeLichTrinh: React.FC<ModalNgoaiLeLichTrinhProps> = ({
  isOpen,
  exceptionData,
  submitting,
  onChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-md overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Ghi Nhận Báo Nghỉ / Bù
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Ngày áp dụng <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={exceptionData.date}
                onChange={(e) => onChange({ ...exceptionData, date: e.target.value })}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Trạng thái ngoại lệ
              </label>
              <select
                value={exceptionData.status}
                onChange={(e) => onChange({ ...exceptionData, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="nghi">Báo Nghỉ (Tạm hoãn buổi học)</option>
                <option value="day_bu">Xếp Lịch Học Bù</option>
                <option value="huy">Hủy Bỏ Buổi Học Này</option>
              </select>
            </div>

            {String(exceptionData.status).toLowerCase() === 'day_bu' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Ngày học bù dự kiến <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={exceptionData.makeupDate}
                  onChange={(e) => onChange({ ...exceptionData, makeupDate: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Lý do ghi nhận
              </label>
              <textarea
                value={exceptionData.reason}
                onChange={(e) => onChange({ ...exceptionData, reason: e.target.value })}
                rows={2}
                placeholder="Nhập lý do giảng viên bận công tác / lịch bù..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Hủy
              </Button>
              <Button type="submit" isLoading={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Xác nhận
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
