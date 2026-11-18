import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral' | 'brand';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  };

  const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
    brand: {
      badge: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/35 dark:text-brand-300 dark:border-brand-700/70',
      dot: 'bg-brand-500',
    },
    success: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/35 dark:text-emerald-300 dark:border-emerald-700/70',
      dot: 'bg-emerald-500',
    },
    warning: {
      badge: 'bg-amber-50 text-amber-800 border-amber-300/80 dark:bg-amber-900/35 dark:text-amber-300 dark:border-amber-700/70',
      dot: 'bg-amber-500',
    },
    danger: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/35 dark:text-rose-300 dark:border-rose-700/70',
      dot: 'bg-rose-500',
    },
    info: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/35 dark:text-blue-300 dark:border-blue-700/70',
      dot: 'bg-blue-500',
    },
    purple: {
      badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/35 dark:text-purple-300 dark:border-purple-700/70',
      dot: 'bg-purple-500',
    },
    neutral: {
      badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
      dot: 'bg-slate-500 dark:bg-slate-400',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm transition-colors ${sizeStyles[size]} ${currentVariant.badge} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-subtle ${currentVariant.dot}`} />
      )}
      <span>{children}</span>
    </span>
  );
};
