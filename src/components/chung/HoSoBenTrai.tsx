import React from 'react';

export interface HoSoThongTinDong {
  icon: React.ReactNode;
  text: React.ReactNode;
  title?: string;
}

export interface HoSoNhomPhu {
  tieuDe: string;
  noiDung: React.ReactNode;
}

interface HoSoBenTraiProps {
  /** Khối ảnh đại diện (đã bao gồm nút đổi ảnh nếu có) */
  anhDaiDien: React.ReactNode;
  maCanBo?: string;
  /** Nhãn trạng thái màu xanh dưới mã cán bộ, ví dụ "Đang làm việc" */
  trangThai?: string;
  trangThaiHoatDong?: boolean;
  hoTen: string;
  /** Dòng thông tin ngắn: đơn vị, chức vụ... */
  thongTinChinh?: HoSoThongTinDong[];
  /** Dòng liên hệ: điện thoại, email... */
  lienHe?: HoSoThongTinDong[];
  /** Các khối phụ: ngày vào làm, người quản lý... */
  cacNhomPhu?: HoSoNhomPhu[];
  /** Vùng thao tác dưới cùng (nút bấm) */
  thaoTac?: React.ReactNode;
  className?: string;
}

/**
 * Cột trái dùng chung cho Hồ sơ nhân viên (Quản lý nhân sự & Hồ sơ cá nhân):
 * ảnh đại diện, mã, trạng thái, tên, thông tin tóm tắt và liên hệ.
 */
export const HoSoBenTrai: React.FC<HoSoBenTraiProps> = ({
  anhDaiDien,
  maCanBo,
  trangThai,
  trangThaiHoatDong = true,
  hoTen,
  thongTinChinh = [],
  lienHe = [],
  cacNhomPhu = [],
  thaoTac,
  className = '',
}) => {
  const renderDong = (d: HoSoThongTinDong, i: number) => (
    <div
      key={i}
      title={d.title}
      className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 min-w-0"
    >
      <span className="w-4 h-4 text-slate-400 shrink-0 flex items-center justify-center mt-0.5">{d.icon}</span>
      <span className="min-w-0 break-words font-semibold">{d.text}</span>
    </div>
  );

  return (
    <aside
      className={`bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col gap-4 p-5 overflow-y-auto ${className}`}
    >
      <div className="flex flex-col items-center text-center gap-1.5">
        {anhDaiDien}
        {maCanBo && (
          <div className="mt-2 text-sm font-black tracking-wide text-brand-600 dark:text-brand-400 font-mono">
            {maCanBo}
          </div>
        )}
        {trangThai && (
          <div
            className={`text-xs font-bold ${
              trangThaiHoatDong ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trangThai}
          </div>
        )}
        <div className="text-sm font-black text-slate-900 dark:text-white uppercase leading-snug">{hoTen}</div>
      </div>

      {thongTinChinh.length > 0 && (
        <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
          {thongTinChinh.map(renderDong)}
        </div>
      )}

      {lienHe.length > 0 && (
        <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">{lienHe.map(renderDong)}</div>
      )}

      {cacNhomPhu.map((nhom, i) => (
        <div key={i} className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            {nhom.tieuDe}
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{nhom.noiDung}</div>
        </div>
      ))}

      {thaoTac && <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">{thaoTac}</div>}
    </aside>
  );
};

interface TruongThongTinProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}

/** Hiển thị một trường thông tin phẳng sạch sẽ (nhãn trên, giá trị dưới — không đóng khung, không đường gạch chân đứt đoạn). */
export const TruongThongTin: React.FC<TruongThongTinProps> = ({ label, value, mono, className = '' }) => {
  const isPlaceholder = typeof value === 'string' && (value === 'Chưa cập nhật' || value === '—');
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
      <div
        className={`text-[13px] leading-snug ${
          isPlaceholder
            ? 'font-medium text-slate-400 dark:text-slate-500 italic'
            : `font-semibold text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''}`
        }`}
      >
        {value}
      </div>
    </div>
  );
};

export interface HoSoTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ThanhTabHoSoProps {
  tabs: HoSoTabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Thanh tab gạch chân dùng chung cho các khung hồ sơ nhân viên. */
export const ThanhTabHoSo: React.FC<ThanhTabHoSoProps> = ({ tabs, active, onChange, className = '' }) => (
  <div
    className={`flex items-center gap-1 px-4 border-b border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar bg-white dark:bg-slate-900 shrink-0 ${className}`}
  >
    {tabs.map((t) => {
      const isActive = t.id === active;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-3.5 py-3 text-xs font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
            isActive
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      );
    })}
  </div>
);
