import React from 'react';

export type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface StatStripItem {
  label: string;
  value: React.ReactNode;
  unit?: string;
  badge?: string;
  subtext?: string;
  progress?: number;
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

  // Chế độ Flux Standard (mặc định): Hàng các thẻ KPI sạch gọn chuẩn Face ID
  if (!embedded) {
    return (
      <div className={`grid ${colsClass} gap-3 w-full ${className}`} data-purpose="flux-stats-cards">
        {items.map((item, idx) => {
          const tone = item.tone || 'neutral';
          const Tag = item.onClick ? 'button' : 'div';
          const hasProgress = typeof item.progress === 'number';
          return (
            <Tag
              key={idx}
              {...(item.onClick ? { type: 'button' as const, onClick: item.onClick } : {})}
              className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 text-left flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs ${
                item.onClick ? 'cursor-pointer' : ''
              } ${item.active ? 'border-brand-400 dark:border-brand-600' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-semibold shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className={`text-xl font-bold tabular-nums leading-none ${VALUE_TONES[tone]}`}>
                  {item.value}
                </span>
                {item.unit && (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {item.unit}
                  </span>
                )}
              </div>
              {hasProgress ? (
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${DOT_TONES[tone]}`}
                    style={{ width: `${Math.min(100, Math.max(0, item.progress || 0))}%` }}
                  />
                </div>
              ) : item.subtext ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1.5 truncate">
                  {item.subtext}
                </span>
              ) : null}
            </Tag>
          );
        })}
      </div>
    );
  }

  // Chế độ Embedded: dải thống kê liền viền mỏng
  return (
    <div
      className={`bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 grid ${colsClass} divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 overflow-hidden ${className}`}
      data-purpose="compact-stats-bar"
    >
      {items.map((item, idx) => {
        const tone = item.tone || 'neutral';
        const Tag = item.onClick ? 'button' : 'div';
        return (
          <Tag
            key={idx}
            {...(item.onClick ? { type: 'button' as const, onClick: item.onClick } : {})}
            className={`px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-all ${
              item.onClick
                ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/70'
                : ''
            } ${item.active ? 'bg-brand-50/80 dark:bg-brand-950/60' : ''}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_TONES[tone]}`} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                {item.label}
              </span>
            </span>
            <span className="flex items-baseline gap-1.5 shrink-0">
              <span className={`text-base font-black font-mono tabular-nums tracking-tight ${VALUE_TONES[tone]}`}>
                {item.value}
              </span>
              {item.unit && (
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{item.unit}</span>
              )}
              {item.badge && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
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
