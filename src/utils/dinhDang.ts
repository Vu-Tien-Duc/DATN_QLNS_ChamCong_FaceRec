/**
 * Các hàm định dạng dùng chung cho toàn bộ giao diện (Tiền tệ, Ngày giờ VN, Tên viết tắt).
 */

export function formatVND(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Number(amount)) + ' đ';
}

export function formatTimeVN(dateStr?: string | Date | null): string {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateVN(dateStr?: string | Date | null): string {
  if (!dateStr) return '--/--/----';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('vi-VN');
}

export function formatDateTimeVN(dateStr?: string | Date | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
}

export function getInitials(fullName?: string | null): string {
  if (!fullName) return 'CB';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
