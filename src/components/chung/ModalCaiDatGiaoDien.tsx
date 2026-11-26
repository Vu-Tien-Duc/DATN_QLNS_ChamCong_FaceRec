import React, { useEffect } from 'react';
import {
  Palette,
  Sun,
  Moon,
  Check,
  RotateCcw,
  X,
  Type,
  Sparkles,
} from 'lucide-react';
import { Portal } from './CongDichChuyen';
import { THEME_PRESETS, useThemeStore } from '../../stores/useGiaoDienStore';
import { FontScale } from '../../types/index';

interface ModalCaiDatGiaoDienProps {
  isOpen: boolean;
  onClose: () => void;
}

const FONT_SCALES: Array<{ id: FontScale; label: string; sample: string }> = [
  { id: 'compact', label: 'Nhỏ gọn', sample: '14.5px' },
  { id: 'normal', label: 'Tiêu chuẩn', sample: '16px' },
  { id: 'large', label: 'Lớn dễ đọc', sample: '17px' },
];

export const ModalCaiDatGiaoDien: React.FC<ModalCaiDatGiaoDienProps> = ({ isOpen, onClose }) => {
  const {
    theme,
    isDark,
    fontScale,
    reduceMotion,
    setTheme,
    setFontScale,
    setReduceMotion,
    resetAppearance,
  } = useThemeStore();

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      >
        <div
          data-themed-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Cài đặt giao diện và màu sắc"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200/70 dark:border-brand-800/60 flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Cài Đặt Giao Diện
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Chọn chủ đề giao diện hoàn chỉnh &amp; cỡ chữ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
            {/* 1. Chủ đề giao diện hoàn chỉnh (Sáng & Tối đa phong cách) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                  1. Chủ đề giao diện
                </span>
                <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                  {isDark ? 'Tông nền Tối' : 'Tông nền Sáng'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {THEME_PRESETS.map((preset) => {
                  const Icon = preset.isDark ? Moon : Sun;
                  const active = theme === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setTheme(preset.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                        active
                          ? 'border-brand-500 bg-brand-50/70 dark:bg-brand-950/50 ring-2 ring-brand-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {/* Mini preview: nền + card + chấm màu nhấn */}
                      <div
                        className="w-full h-9 rounded-xl border p-1.5 flex items-center justify-between"
                        style={{ backgroundColor: preset.pageBg, borderColor: preset.borderColor }}
                      >
                        <div
                          className="h-full w-3/4 rounded-md border flex items-center px-1.5 gap-1"
                          style={{ backgroundColor: preset.surfaceBg, borderColor: preset.borderColor }}
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: preset.swatchHex }} />
                          <span
                            className="h-1.5 w-8 rounded-full opacity-35"
                            style={{ backgroundColor: preset.isDark ? '#E2E8F0' : '#334155' }}
                          />
                        </div>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: preset.swatchHex }} />
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 text-[11px] sm:text-xs whitespace-nowrap">
                          <Icon className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                          <span>{preset.label}</span>
                        </span>
                        {active && <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        {preset.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Cỡ chữ & Hiệu ứng */}
            <div className="space-y-3 pt-1">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400">
                  <Type className="w-3.5 h-3.5" />
                  <span>2. Kích thước chữ</span>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
                  {FONT_SCALES.map((fs) => {
                    const active = fontScale === fs.id;
                    return (
                      <button
                        key={fs.id}
                        type="button"
                        onClick={() => setFontScale(fs.id)}
                        className={`py-2 px-2 rounded-lg text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 font-bold shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                        }`}
                      >
                        <div>{fs.label}</div>
                        <div className="text-[10px] opacity-70 font-mono">{fs.sample}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 cursor-pointer select-none">
                <span className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  <span>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">
                      Giảm hiệu ứng chuyển động
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Thao tác nhanh, tắt hoạt ảnh chuyển tiếp
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={reduceMotion}
                  onChange={(e) => setReduceMotion(e.target.checked)}
                  className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetAppearance}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Mặc định</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              Xong
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};
