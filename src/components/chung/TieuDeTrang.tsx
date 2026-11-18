import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: string | React.ReactNode;
  badgeVariant?: 'brand' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) => {
  return (
    <div
      className={`pb-3 border-b border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 ${className}`}
      data-purpose="page-header"
    >
      <div className="min-w-[240px] flex-1">
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 max-w-3xl truncate">
            {subtitle}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
};
