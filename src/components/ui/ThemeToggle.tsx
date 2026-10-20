import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ showLabel = false, className = '' }) => {
  const { theme, isDark, setTheme, toggleTheme } = useThemeStore();

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Nút bật/tắt nhanh 1 chạm */}
      <button
        onClick={toggleTheme}
        type="button"
        title={`Chuyển sang chế độ ${isDark ? 'Sáng' : 'Tối'}`}
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
      >
        <span className="sr-only">Toggle theme</span>
        <div className="relative w-5 h-5 flex items-center justify-center">
          {/* Sun icon for light mode */}
          <Sun
            className={`w-5 h-5 transition-all duration-300 absolute ${
              isDark ? 'opacity-0 rotate-90 scale-0 text-amber-500' : 'opacity-100 rotate-0 scale-100 text-amber-500'
            }`}
          />
          {/* Moon icon for dark mode */}
          <Moon
            className={`w-5 h-5 transition-all duration-300 absolute ${
              isDark ? 'opacity-100 rotate-0 scale-100 text-brand-400' : 'opacity-0 -rotate-90 scale-0 text-brand-500'
            }`}
          />
        </div>
      </button>

      {/* Tùy chọn 3 mode (Light / Dark / System) nếu cần hiển thị đầy đủ */}
      {showLabel && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 ml-2">
          <button
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              theme === 'light'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title="Chế độ Sáng"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Sáng</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              theme === 'dark'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title="Chế độ Tối"
          >
            <Moon className="w-3.5 h-3.5 text-brand-400" />
            <span>Tối</span>
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              theme === 'system'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            title="Theo hệ điều hành"
          >
            <Monitor className="w-3.5 h-3.5 text-slate-500" />
            <span>Hệ thống</span>
          </button>
        </div>
      )}
    </div>
  );
};
