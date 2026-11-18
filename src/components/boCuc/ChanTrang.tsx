import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-8 py-4 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <span>Hệ thống Quản lý Nhân sự &amp; Chấm công — Đại học Nguyễn Trãi (NTU)</span>
        <span>Đồ án Tốt nghiệp 2026 • Vũ Tiến Đức (2310900023)</span>
      </div>
    </footer>
  );
};
