import { UserRoleLegacy } from './nguoiDung.types';

export interface StatMetric {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  description?: string;
  iconName: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface NavigationItem {
  name: string;
  path: string;
  icon: string;
  badge?: string | number;
  allowedRoles?: (UserRoleLegacy | string)[];
  children?: NavigationItem[];
}
