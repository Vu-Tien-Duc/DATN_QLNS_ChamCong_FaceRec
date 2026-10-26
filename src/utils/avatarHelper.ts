/**
 * avatarHelper.ts - Tiện ích chuẩn hoá Avatar và Chữ viết tắt (Initials) toàn hệ thống
 * Đảm bảo:
 * 1. Phân định tuyệt đối giữa Avatar hồ sơ và Ảnh Face ID sinh trắc học
 * 2. Lọc bỏ các tiền tố học hàm / học vị (GS., PGS., TS., ThS., CN., KS.,...) khi lấy chữ viết tắt
 * 3. Sinh bộ màu đồng bộ, nhất quán (Deterministic Hash Palette) cho từng cán bộ trên toàn bộ màn hình
 */

export interface AvatarColorTheme {
  gradient: string;
  ring: string;
  bgLight: string;
  textLight: string;
}

export const AVATAR_COLOR_PALETTES: AvatarColorTheme[] = [
  {
    gradient: 'from-indigo-600 to-blue-600',
    ring: 'ring-indigo-300 dark:ring-indigo-800',
    bgLight: 'bg-indigo-50 dark:bg-indigo-950/40',
    textLight: 'text-indigo-600 dark:text-indigo-300',
  },
  {
    gradient: 'from-emerald-600 to-teal-600',
    ring: 'ring-emerald-300 dark:ring-emerald-800',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/40',
    textLight: 'text-emerald-600 dark:text-emerald-300',
  },
  {
    gradient: 'from-purple-600 to-indigo-600',
    ring: 'ring-purple-300 dark:ring-purple-800',
    bgLight: 'bg-purple-50 dark:bg-purple-950/40',
    textLight: 'text-purple-600 dark:text-purple-300',
  },
  {
    gradient: 'from-rose-500 to-pink-600',
    ring: 'ring-rose-300 dark:ring-rose-800',
    bgLight: 'bg-rose-50 dark:bg-rose-950/40',
    textLight: 'text-rose-600 dark:text-rose-300',
  },
  {
    gradient: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-300 dark:ring-amber-800',
    bgLight: 'bg-amber-50 dark:bg-amber-950/40',
    textLight: 'text-amber-700 dark:text-amber-300',
  },
  {
    gradient: 'from-cyan-600 to-blue-600',
    ring: 'ring-cyan-300 dark:ring-cyan-800',
    bgLight: 'bg-cyan-50 dark:bg-cyan-950/40',
    textLight: 'text-cyan-600 dark:text-cyan-300',
  },
  {
    gradient: 'from-violet-600 to-fuchsia-600',
    ring: 'ring-violet-300 dark:ring-violet-800',
    bgLight: 'bg-violet-50 dark:bg-violet-950/40',
    textLight: 'text-violet-600 dark:text-violet-300',
  },
  {
    gradient: 'from-teal-600 to-emerald-600',
    ring: 'ring-teal-300 dark:ring-teal-800',
    bgLight: 'bg-teal-50 dark:bg-teal-950/40',
    textLight: 'text-teal-600 dark:text-teal-300',
  },
];

/**
 * Tách bỏ học hàm, học vị để lấy chữ cái viết tắt chuẩn xác 2 chữ
 * Ví dụ:
 * - "ThS. Hoàng Diệu Linh" -> "HL" (không lấy chữ T của ThS.)
 * - "ThS. Nguyễn Trọng An" -> "NA" (không lấy chữ T của ThS.)
 * - "Đỗ Thu Hà" -> "DH"
 * - "Lê Quang Thành" -> "LT"
 */
export function getCleanInitials(fullName?: string): string {
  if (!fullName || typeof fullName !== 'string') return 'CB';

  // Loại bỏ các tiền tố học hàm / học vị nhiều cấp
  const clean = fullName
    .trim()
    .replace(/^(GS|PGS|TS|ThS|CN|KS|BS|Ths|Ts|Pgs|Gs|Bs)\.?\s*/gi, '')
    .replace(/^(GS|PGS|TS|ThS|CN|KS|BS|Ths|Ts|Pgs|Gs|Bs)\.?\s*/gi, '')
    .replace(/^(\(.*\)|\[.*\])\s*/gi, '')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  const firstLetter = words[0][0];
  const lastLetter = words[words.length - 1][0];
  return (firstLetter + lastLetter).toUpperCase();
}

/**
 * Lọc URL Avatar hợp lệ, loại trừ hoàn toàn ảnh Face ID sinh trắc học
 */
export function getCleanAvatarUrl(userOrUrl: any): string | null {
  if (!userOrUrl) return null;

  let raw = '';
  if (typeof userOrUrl === 'string') {
    raw = userOrUrl.trim();
  } else if (typeof userOrUrl === 'object') {
    // Chỉ lấy trường avatar hồ sơ (không lấy facePhoto / anh_khuon_mat)
    raw = (userOrUrl.avatar || userOrUrl.avatarUrl || userOrUrl.anh_dai_dien || '').trim();
  }

  if (!raw) return null;

  // Nếu là ảnh sinh trắc học từ camera điểm danh/đăng ký (chứa face- hoặc camera punch) -> BỎ QUA
  if (raw.includes('face-') || raw.includes('punch-') || raw.includes('evidence-')) {
    return null;
  }

  // Chuẩn hoá URL
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('/api/')) return raw;
  if (raw.startsWith('/uploads/')) return `/api${raw}`;
  if (raw.startsWith('uploads/')) return `/api/${raw}`;

  return `/api/upload/file/${raw}`;
}

/**
 * Trả về bộ màu sắc đồng nhất (Consistent Color Palette) dựa trên mã nhân viên hoặc tên
 * Giúp cho cùng 1 cán bộ luôn có cùng 1 màu sắc avatar trên mọi màn hình
 */
export function getAvatarTheme(identifier?: string): AvatarColorTheme {
  if (!identifier || typeof identifier !== 'string') {
    return AVATAR_COLOR_PALETTES[0];
  }

  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
}
