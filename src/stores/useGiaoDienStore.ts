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

type SlateShadeKey = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '850' | '900' | '950';

const DEFAULT_SLATE_SHADES: Record<SlateShadeKey, string> = {
  50: '237 241 247',
  100: '226 232 240',
  200: '203 213 225',
  300: '158 176 199',
  400: '148 163 184',
  500: '82 98 122',
  600: '63 79 102',
  700: '55 73 102',
  800: '38 53 79',
  850: '30 44 68',
  900: '23 34 54',
  950: '15 23 42',
};

export interface ThemePresetMeta {
  id: Exclude<ThemeMode, 'system'>;
  label: string;
  desc: string;
  isDark: boolean;
  accent: AccentColor;
  pageBg: string;
  surfaceBg: string;
  borderColor: string;
  swatchHex: string;
  slateShades: Record<SlateShadeKey, string>;
}

export const THEME_PRESETS: ThemePresetMeta[] = [
  {
    id: 'light',
    label: 'Sáng Chuẩn',
    desc: 'Nền trắng xanh NTU',
    isDark: false,
    accent: 'indigo',
    pageBg: '#F8F9FC',
    surfaceBg: '#FFFFFF',
    borderColor: '#CBD5E1',
    swatchHex: '#4F46E5',
    slateShades: DEFAULT_SLATE_SHADES,
  },
  {
    id: 'warm',
    label: 'Sáng Kem Ấm',
    desc: 'Nền giấy kem rõ nét',
    isDark: false,
    accent: 'amber',
    pageBg: '#EFE4CE',
    surfaceBg: '#FAF3E4',
    borderColor: '#D6C29F',
    swatchHex: '#B45309',
    slateShades: {
      50: '239 228 206',
      100: '229 214 185',
      200: '214 194 159',
      300: '186 162 126',
      400: '145 121 90',
      500: '107 86 60',
      600: '82 64 43',
      700: '64 49 32',
      800: '46 34 21',
      850: '37 27 16',
      900: '29 21 12',
      950: '20 14 8',
    },
  },
  {
    id: 'mint',
    label: 'Sáng Xanh Ngọc',
    desc: 'Nền xanh bạc hà dịu',
    isDark: false,
    accent: 'emerald',
    pageBg: '#D4EFE4',
    surfaceBg: '#ECF9F3',
    borderColor: '#9CD3BE',
    swatchHex: '#059669',
    slateShades: {
      50: '212 239 228',
      100: '192 229 214',
      200: '156 211 190',
      300: '112 184 157',
      400: '72 145 119',
      500: '45 107 86',
      600: '31 84 67',
      700: '22 66 52',
      800: '15 48 38',
      850: '11 38 30',
      900: '8 29 23',
      950: '4 19 15',
    },
  },
  {
    id: 'dark',
    label: 'Tối Tiêu Chuẩn',
    desc: 'Nền xanh xám Slate',
    isDark: true,
    accent: 'indigo',
    pageBg: '#0F172A',
    surfaceBg: '#172236',
    borderColor: '#374966',
    swatchHex: '#6366F1',
    slateShades: DEFAULT_SLATE_SHADES,
  },
  {
    id: 'midnight',
    label: 'Tối Đen Tuyền',
    desc: 'Nền đen thuần OLED',
    isDark: true,
    accent: 'blue',
    pageBg: '#000000',
    surfaceBg: '#0A0A0D',
    borderColor: '#27272A',
    swatchHex: '#3B82F6',
    slateShades: {
      50: '244 244 245',
      100: '228 228 231',
      200: '212 212 216',
      300: '161 161 170',
      400: '132 132 142',
      500: '96 96 106',
      600: '68 68 76',
      700: '46 46 54',
      800: '28 28 34',
      850: '18 18 23',
      900: '10 10 13',
      950: '0 0 0',
    },
  },
  {
    id: 'forest',
    label: 'Tối Tím Đêm',
    desc: 'Nền tím than huyền bí',
    isDark: true,
    accent: 'violet',
    pageBg: '#110B22',
    surfaceBg: '#1B1336',
    borderColor: '#3B2B63',
    swatchHex: '#8B5CF6',
    slateShades: {
      50: '243 240 255',
      100: '232 225 255',
      200: '209 196 250',
      300: '176 156 235',
      400: '142 120 209',
      500: '106 86 168',
      600: '78 60 130',
      700: '59 43 99',
      800: '41 29 74',
      850: '33 23 61',
      900: '27 19 54',
      950: '17 11 34',
    },
  },
];

const VALID_THEMES: ThemeMode[] = ['light', 'warm', 'mint', 'dark', 'midnight', 'forest', 'system'];

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('app-theme') as ThemeMode;
  if (saved && VALID_THEMES.includes(saved)) {
    return saved;
  }
  return 'light';
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

const resolvePreset = (theme: ThemeMode): ThemePresetMeta => {
  if (theme === 'system') {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return THEME_PRESETS.find((p) => p.id === (prefersDark ? 'dark' : 'light')) || THEME_PRESETS[0];
  }
  return THEME_PRESETS.find((p) => p.id === theme) || THEME_PRESETS[0];
};

const applyThemePresetToDOM = (preset: ThemePresetMeta) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', preset.id);
  root.classList.toggle('dark', preset.isDark);
  root.style.setProperty('--bg-page', preset.pageBg);
  root.style.setProperty('--bg-surface', preset.surfaceBg);
  root.style.setProperty('--border-subtle', preset.borderColor);
  (Object.keys(preset.slateShades) as SlateShadeKey[]).forEach((shade) => {
    root.style.setProperty(`--slate-${shade}`, preset.slateShades[shade]);
  });
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
  const initialPreset = resolvePreset(initialTheme);
  const initialIsDark = initialPreset.isDark;
  const initialAccent = initialPreset.accent || getInitialAccent();
  const initialFontScale = getInitialFontScale();
  const initialReduceMotion = getInitialReduceMotion();

  applyThemePresetToDOM(initialPreset);
  applyAccentToDOM(initialAccent);
  applyFontScaleToDOM(initialFontScale);
  applyReduceMotionToDOM(initialReduceMotion);

  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (get().theme === 'system') {
        const preset = resolvePreset('system');
        applyThemePresetToDOM(preset);
        applyAccentToDOM(preset.accent);
        set({ isDark: preset.isDark, accentColor: preset.accent });
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
      const preset = resolvePreset(theme);
      localStorage.setItem('app-theme', theme);
      localStorage.setItem('app-accent-color', preset.accent);
      applyThemePresetToDOM(preset);
      applyAccentToDOM(preset.accent);
      set({ theme, isDark: preset.isDark, accentColor: preset.accent });
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
      const preset = resolvePreset('light');
      localStorage.setItem('app-theme', 'light');
      localStorage.setItem('app-accent-color', preset.accent);
      localStorage.setItem('app-font-scale', 'normal');
      localStorage.setItem('app-reduce-motion', 'false');
      applyThemePresetToDOM(preset);
      applyAccentToDOM(preset.accent);
      applyFontScaleToDOM('normal');
      applyReduceMotionToDOM(false);
      set({
        theme: 'light',
        isDark: preset.isDark,
        accentColor: preset.accent,
        fontScale: 'normal',
        reduceMotion: false,
      });
    },
  };
});
