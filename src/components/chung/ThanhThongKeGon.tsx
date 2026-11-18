import React from 'react';

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface StatStripItem {
  label: string;
  value: React.ReactNode;
  unit?: string;
  badge?: string;
  tone?: StatTone;
  active?: boolean;
  onClick?: () => void;
}

interface CompactStatsBarProps {
  items: StatStripItem[];
  className?: string;
  embedded?: boolean;
}

const DOT_TONES: Record<StatTone, string> = {
  neutral: 'bg-slate-400 dark:bg-slate-500',
  brand: 'bg-brand-600 dark:bg-brand-400',
  success: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-rose-500 dark:bg-rose-400',
};

const VALUE_TONES: Record<StatTone, string> = {
  neutral: 'text-slate-900 dark:text-slate-100',
  brand: 'text-brand-600 dark:text-brand-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
};

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
};

/**
 * Thanh thống kê tóm tắt 1 hàng gọn nhẹ (Secondary KPI Strip)
 * Giúp phần bảng dữ liệu chính luôn nằm ngay vùng nhìn đầu tiên.
 */
export const CompactStatsBar: React.FC<CompactStatsBarProps> = ({ items, className = '', embedded = false }) => {
  const colsClass = GRID_COLS[items.length] || 'grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={`${
        embedded
          ? 'bg-slate-50/60 dark:bg-slate-850/40 border-b border-slate-200/80 dark:border-slate-800'
          : 'bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs'
      } grid ${colsClass} divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-slate-700/70 overflow-hidden ${className}`}
      data-purpose="compact-stats-bar"
    >
      {items.map((item, idx) => {
        const tone = item.tone || 'neutral';
        const Tag = item.onClick ? 'button' : 'div';
        return (
          <Tag
            key={idx}
            {...(item.onClick ? { type: 'button' as const, onClick: item.onClick } : {})}
            className={`px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors ${
              item.onClick
                ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/70'
                : ''
            } ${item.active ? 'bg-brand-50 dark:bg-brand-900/35' : ''}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_TONES[tone]}`} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                {item.label}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5 shrink-0">
              <span className={`text-base font-bold font-mono tabular-nums ${VALUE_TONES[tone]}`}>
                {item.value}
              </span>
              {item.unit && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">{item.unit}</span>
              )}
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                  {item.badge}
                </span>
              )}
            </span>
          </Tag>
        );
      })}
    </div>
  );
};
