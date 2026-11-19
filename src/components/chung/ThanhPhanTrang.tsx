import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
} from 'lucide-react';
import { Portal } from './CongDichChuyen';

export interface ThanhPhanTrangProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const ThanhPhanTrang: React.FC<ThanhPhanTrangProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'bản ghi',
  className = '',
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  }>({
    top: 0,
    left: 0,
    width: 98,
    openUp: true,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  const handleToggleMenu = () => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = pageSizeOptions.length * 32 + 12;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < estimatedHeight + 12 && rect.top > estimatedHeight;
      const menuWidth = Math.round(rect.width);
      const left = Math.min(
        Math.max(8, rect.left + (rect.width - menuWidth) / 2),
        window.innerWidth - menuWidth - 8
      );
      setMenuPos({
        top: openUp ? rect.top - 6 : rect.bottom + 6,
        left,
        width: menuWidth,
        openUp,
      });
    }
    setIsMenuOpen(true);
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    const handleViewportChange = () => setIsMenuOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isMenuOpen]);

  if (totalItems <= 0) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 ${className}`}
    >
      <div className="tabular-nums">
        Hiển thị <strong className="font-semibold text-slate-800 dark:text-white">{startItem}</strong>–
        <strong className="font-semibold text-slate-800 dark:text-white">{endItem}</strong> /{' '}
        <strong className="font-semibold text-brand-600 dark:text-brand-400">{totalItems}</strong> {itemLabel}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {onPageSizeChange && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Hiển thị:</span>
              <button
                ref={triggerRef}
                type="button"
                onClick={handleToggleMenu}
                aria-haspopup="listbox"
                aria-expanded={isMenuOpen}
                className={`h-7 w-[98px] inline-flex items-center justify-center gap-1 px-2 rounded-lg border text-xs font-semibold tabular-nums transition-all cursor-pointer select-none ${
                  isMenuOpen
                    ? 'bg-white dark:bg-slate-900 border-brand-500/80 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/10'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/80 dark:hover:bg-slate-800/70'
                }`}
              >
                <span>{pageSize} / trang</span>
                <ChevronDown
                  className={`w-3 h-3 shrink-0 transition-transform duration-200 ${
                    isMenuOpen
                      ? 'rotate-180 text-brand-600 dark:text-brand-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
              </button>

              {isMenuOpen && (
                <Portal>
                  <div
                    ref={menuRef}
                    role="listbox"
                    aria-label="Số dòng mỗi trang"
                    style={{
                      position: 'fixed',
                      top: menuPos.top,
                      left: menuPos.left,
                      width: menuPos.width,
                      transform: menuPos.openUp ? 'translateY(-100%)' : undefined,
                    }}
                    className="z-[120] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-lg shadow-slate-900/10 dark:shadow-black/40 p-1 space-y-0.5"
                  >
                    {pageSizeOptions.map((size) => {
                      const isSelected = pageSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onPageSizeChange(size);
                            setIsMenuOpen(false);
                          }}
                          className={`relative w-full h-7 flex items-center justify-center px-2 rounded-lg text-xs tabular-nums transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-300 font-semibold'
                              : 'text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <span>{size} / trang</span>
                          {isSelected && (
                            <Check className="w-3 h-3 text-brand-600 dark:text-brand-400 absolute right-1.5 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Portal>
              )}
            </div>
            <span className="hidden sm:block h-4 w-px bg-slate-200/90 dark:bg-slate-700/80" />
          </>
        )}

        <div className="flex items-center gap-0.5">
          {safeTotalPages > 3 && (
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={safePage <= 1}
              className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {Array.from({ length: safeTotalPages }, (_, i) => i + 1)
            .filter((p) => {
              if (safeTotalPages <= 7) return true;
              if (p === 1 || p === safeTotalPages) return true;
              return Math.abs(p - safePage) <= 1;
            })
            .map((p, idx, arr) => {
              const prevP = arr[idx - 1];
              const hasGap = prevP && p - prevP > 1;
              return (
                <React.Fragment key={p}>
                  {hasGap && <span className="px-0.5 text-slate-400">...</span>}
                  <button
                    type="button"
                    onClick={() => onPageChange(p)}
                    className={`min-w-[26px] h-7 px-1.5 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer flex items-center justify-center ${
                      p === safePage
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
            disabled={safePage >= safeTotalPages}
            className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Trang tiếp"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {safeTotalPages > 3 && (
            <button
              type="button"
              onClick={() => onPageChange(safeTotalPages)}
              disabled={safePage >= safeTotalPages}
              className="w-6 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Trang cuối"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThanhPhanTrang;
