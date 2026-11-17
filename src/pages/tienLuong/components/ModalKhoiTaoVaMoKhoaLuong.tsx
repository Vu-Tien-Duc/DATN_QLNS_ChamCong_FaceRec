import React from 'react';
import { Play, Unlock, X } from 'lucide-react';
import { Portal } from '../../../components/chung/CongDichChuyen';
import { DepartmentSelect } from '../../../components/chung/ChonDonVi';

interface ModalKhoiTaoLuongProps {
  isOpen: boolean;
  selectedMonth: number;
  selectedYear: number;
  selectedDepartment: string;
  departments: any[];
  isSubmitting: boolean;
  onChangeMonth: (month: number) => void;
  onChangeYear: (year: number) => void;
  onChangeDepartment: (deptId: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const ModalKhoiTaoLuong: React.FC<ModalKhoiTaoLuongProps> = ({
  isOpen,
  selectedMonth,
  selectedYear,
  selectedDepartment,
  departments,
  isSubmitting,
  onChangeMonth,
  onChangeYear,
  onChangeDepartment,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Khởi Tạo &amp; Tính Bảng Lương</h3>
                <p className="text-[11px] text-slate-400">Áp dụng NĐ 73/2024/NĐ-CP toàn trường</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Tháng tính lương</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={selectedMonth}
                  onChange={(e) => onChangeMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Năm</label>
                <input
                  type="number"
                  min="2020"
                  max="2035"
                  value={selectedYear}
                  onChange={(e) => onChangeYear(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Phạm vi tính lương</label>
              <div className="w-full">
                <DepartmentSelect
                  departments={departments}
                  value={selectedDepartment}
                  onChange={onChangeDepartment}
                  allowAll={true}
                  allLabel="Toàn Trường (Tất cả khoa / phòng ban)"
                  placeholder="Chọn phạm vi đơn vị..."
                  size="md"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-800">
              Hệ thống sẽ tự động quét số tiết giảng dạy, hệ số lương và khấu trừ bảo hiểm để tính ra bảng lương dự thảo cho tháng {selectedMonth}/{selectedYear}.
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onSubmit}
                className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang tính toán...' : 'Chạy Tính Lương'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

interface ModalMoKhoaLuongProps {
  isOpen: boolean;
  selectedMonth: number;
  selectedYear: number;
  unlockReason: string;
  isSubmitting: boolean;
  onChangeReason: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export const ModalMoKhoaLuong: React.FC<ModalMoKhoaLuongProps> = ({
  isOpen,
  selectedMonth,
  selectedYear,
  unlockReason,
  isSubmitting,
  onChangeReason,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Unlock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Mở Khóa Sổ Bảng Lương</h3>
            <p className="text-xs text-slate-500">
              Bạn đang yêu cầu mở khóa sổ bảng lương{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                Tháng {selectedMonth}/{selectedYear}
              </strong>
              . Hành động này sẽ được ghi nhận vào nhật ký kiểm toán hệ thống.
            </p>

            <div className="text-left pt-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Lý do mở khóa sổ <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={unlockReason}
                onChange={(e) => onChangeReason(e.target.value)}
                placeholder="VD: Điều chỉnh bổ sung tiết vượt giờ khoa CNTT theo đề xuất..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
            </div>

            <div className="pt-3 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onSubmit}
                className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Đang mở khóa...' : 'Xác Nhận Mở Khóa'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
