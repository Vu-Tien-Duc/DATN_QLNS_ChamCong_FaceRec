import { create } from 'zustand';
import { AccentColor, FontScale, ThemeMode } from '../types/index';

type ShadeKey = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950';

export interface AccentPaletteMeta {
  id: AccentColor;
  label: string;
  swatchHex: string;
  shades: Record<ShadeKey, string>;
}

export const ACCENT_PALETTES: AccentPaletteMeta[] = [
  {
    id: 'indigo',
    label: 'Chàm NTU',
    swatchHex: '#4f46e5',
    shades: {
      50: '238 242 255',
      100: '224 231 255',
      200: '199 210 254',
      300: '165 180 252',
      400: '129 140 248',
      500: '99 102 241',
      600: '79 70 229',
      700: '67 56 202',
      800: '55 48 163',
      900: '49 46 129',
      950: '30 27 75',
    },
  },
  {
    id: 'blue',
    label: 'Xanh Dương',
    swatchHex: '#2563eb',
    shades: {
      50: '239 246 255',
      100: '219 234 254',
      200: '191 219 254',
      300: '147 197 253',
      400: '96 165 250',
      500: '59 130 246',
      600: '37 99 235',
      700: '29 78 216',
      800: '30 64 175',
      900: '30 58 138',
      950: '23 37 84',
    },
  },
  {
    id: 'emerald',
    label: 'Xanh Ngọc',
    swatchHex: '#059669',
    shades: {
      50: '236 253 245',
      100: '209 250 229',
      200: '167 243 208',
      300: '110 231 183',
      400: '52 211 153',
      500: '16 185 129',
      600: '5 150 105',
      700: '4 120 87',
      800: '6 95 70',
      900: '6 78 59',
      950: '2 44 34',
    },
  },
  {
    id: 'violet',
    label: 'Tím',
    swatchHex: '#7c3aed',
    shades: {
      50: '245 243 255',
      100: '237 233 254',
      200: '221 214 254',
      300: '196 181 253',
      400: '167 139 250',
      500: '139 92 246',
      600: '124 58 237',
      700: '109 40 217',
      800: '91 33 182',
      900: '76 29 149',
      950: '46 16 101',
    },
  },
  {
    id: 'rose',
    label: 'Đỏ Hồng',
    swatchHex: '#e11d48',
    shades: {
      50: '255 241 242',
      100: '255 228 230',
      200: '254 205 211',
      300: '253 164 175',
      400: '251 113 133',
      500: '244 63 94',
      600: '225 29 72',
      700: '190 18 60',
      800: '159 18 57',
      900: '136 19 55',
      950: '76 5 25',
    },
  },
  {
    id: 'amber',
    label: 'Cam Vàng',
    swatchHex: '#b45309',
    shades: {
      50: '255 251 235',
      100: '254 243 199',
      200: '253 230 138',
      300: '252 211 77',
      400: '251 191 36',
      500: '217 119 6',
      600: '180 83 9',
      700: '146 64 14',
      800: '120 53 15',
      900: '96 42 12',
      950: '69 26 3',
    },
  },
];

const FONT_SCALE_PX: Record<FontScale, string> = {
  compact: '14.5px',
  normal: '16px',
  large: '17px',
};

interface ThemeState {
  theme: ThemeMode;
  isDark: boolean;
  accentColor: AccentColor;
  fontScale: FontScale;
  reduceMotion: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setAccentColor: (color: AccentColor) => void;
  setFontScale: (scale: FontScale) => void;
  setReduceMotion: (reduce: boolean) => void;
  resetAppearance: () => void;
}

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  const saved = localStorage.getItem('app-theme') as ThemeMode;
  if (saved && ['light', 'dark', 'system'].includes(saved)) {
    return saved;
  }
  return 'system';
};

const getInitialAccent = (): AccentColor => {
  if (typeof window === 'undefined') return 'indigo';
  const saved = localStorage.getItem('app-accent-color') as AccentColor;
  if (saved && ACCENT_PALETTES.some((p) => p.id === saved)) {
    return saved;
  }
  return 'indigo';
};

const getInitialFontScale = (): FontScale => {
  if (typeof window === 'undefined') return 'normal';
  const saved = localStorage.getItem('app-font-scale') as FontScale;
  if (saved && ['compact', 'normal', 'large'].includes(saved)) {
    return saved;
  }
  return 'normal';
};

const getInitialReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('app-reduce-motion') === 'true';
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

const applyAccentToDOM = (color: AccentColor) => {
  if (typeof document === 'undefined') return;
  const palette = ACCENT_PALETTES.find((p) => p.id === color) || ACCENT_PALETTES[0];
  const root = document.documentElement;
  (Object.keys(palette.shades) as ShadeKey[]).forEach((shade) => {
    root.style.setProperty(`--brand-${shade}`, palette.shades[shade]);
  });
  root.style.setProperty('--brand-primary', palette.swatchHex);
};

const applyFontScaleToDOM = (scale: FontScale) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = FONT_SCALE_PX[scale] || '16px';
};

const applyReduceMotionToDOM = (reduce: boolean) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', reduce);
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initialTheme = getInitialTheme();
  const initialIsDark = resolveIsDark(initialTheme);
  const initialAccent = getInitialAccent();
  const initialFontScale = getInitialFontScale();
  const initialReduceMotion = getInitialReduceMotion();

  applyThemeToDOM(initialIsDark);
  applyAccentToDOM(initialAccent);
  applyFontScaleToDOM(initialFontScale);
  applyReduceMotionToDOM(initialReduceMotion);

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
    accentColor: initialAccent,
    fontScale: initialFontScale,
    reduceMotion: initialReduceMotion,

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

    setAccentColor: (accentColor: AccentColor) => {
      localStorage.setItem('app-accent-color', accentColor);
      applyAccentToDOM(accentColor);
      set({ accentColor });
    },

    setFontScale: (fontScale: FontScale) => {
      localStorage.setItem('app-font-scale', fontScale);
      applyFontScaleToDOM(fontScale);
      set({ fontScale });
    },

    setReduceMotion: (reduceMotion: boolean) => {
      localStorage.setItem('app-reduce-motion', String(reduceMotion));
      applyReduceMotionToDOM(reduceMotion);
      set({ reduceMotion });
    },

    resetAppearance: () => {
      const nextIsDark = resolveIsDark('system');
      localStorage.setItem('app-theme', 'system');
      localStorage.setItem('app-accent-color', 'indigo');
      localStorage.setItem('app-font-scale', 'normal');
      localStorage.setItem('app-reduce-motion', 'false');
      applyThemeToDOM(nextIsDark);
      applyAccentToDOM('indigo');
      applyFontScaleToDOM('normal');
      applyReduceMotionToDOM(false);
      set({
        theme: 'system',
        isDark: nextIsDark,
        accentColor: 'indigo',
        fontScale: 'normal',
        reduceMotion: false,
      });
    },
  };
});
