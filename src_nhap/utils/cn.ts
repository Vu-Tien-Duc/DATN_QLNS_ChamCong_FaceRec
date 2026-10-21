import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Hàm cn: Kết hợp clsx và tailwind-merge
 * - clsx: Cho phép viết class theo điều kiện (vd: isActive && 'bg-blue-500')
 * - twMerge: Xử lý các class Tailwind bị trùng lặp/xung đột
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}