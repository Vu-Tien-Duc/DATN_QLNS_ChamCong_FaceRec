import { create } from 'zustand';
import { ThemeMode } from '../types';

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem('app-theme') as ThemeMode;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    return saved;
  }
  return 'system';
};

const resolveIsDark = (theme: ThemeMode): boolean => {
  if (typeof window === 'undefined') return false;
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyThemeToDOM = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getInitialTheme();
  const initialIsDark = resolveIsDark(initialTheme);
  applyThemeToDOM(initialIsDark);

  // Lắng nghe thay đổi theme từ hệ điều hành nếu đang ở mode 'system'
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const isDark = e.matches;
        applyThemeToDOM(isDark);
        set({ isDark });
      }
    });
  }

  return {
    theme: initialTheme,
    isDark: initialIsDark,

    setTheme: (theme: ThemeMode) => {
      const isDark = resolveIsDark(theme);
      localStorage.setItem('app-theme', theme);
      applyThemeToDOM(isDark);
      set({ theme, isDark });
    },

    toggleTheme: () => {
      const currentIsDark = get().isDark;
      const nextTheme: ThemeMode = currentIsDark ? 'light' : 'dark';
      get().setTheme(nextTheme);
    },
  };
});
