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
    sm: 'text-[11px] px-2.5 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-3 py-1 gap-1.5 font-semibold',
  };

  const variantStyles: Record<BadgeVariant, { badge: string; dot: string }> = {
    brand: {
      badge: 'bg-brand-50 text-brand-700 border-transparent dark:bg-brand-950/60 dark:text-brand-300',
      dot: 'bg-brand-500',
    },
    success: {
      badge: 'bg-emerald-50 text-emerald-700 border-transparent dark:bg-emerald-950/60 dark:text-emerald-300',
      dot: 'bg-emerald-500',
    },
    warning: {
      badge: 'bg-amber-50 text-amber-800 border-transparent dark:bg-amber-950/60 dark:text-amber-300',
      dot: 'bg-amber-500',
    },
    danger: {
      badge: 'bg-rose-50 text-rose-700 border-transparent dark:bg-rose-950/60 dark:text-rose-300',
      dot: 'bg-rose-500',
    },
    info: {
      badge: 'bg-blue-50 text-blue-700 border-transparent dark:bg-blue-950/60 dark:text-blue-300',
      dot: 'bg-blue-500',
    },
    purple: {
      badge: 'bg-purple-50 text-purple-700 border-transparent dark:bg-purple-950/60 dark:text-purple-300',
      dot: 'bg-purple-500',
    },
    neutral: {
      badge: 'bg-slate-100 text-slate-700 border-transparent dark:bg-slate-800 dark:text-slate-200',
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
