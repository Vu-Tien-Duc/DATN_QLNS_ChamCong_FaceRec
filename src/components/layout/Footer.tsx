import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-4 px-6 border-t border-slate-200/60 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-xs text-slate-500 dark:text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="NTU" className="w-5 h-5 object-contain" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Hệ Thống Quản Lý Nhân Sự & Chấm Công - Đại Học Nguyễn Trãi (NTU)
          </span>
          <span className="hidden md:inline">• Đồ Án Tốt Nghiệp 2026</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400 font-medium">
            <Cpu className="w-3.5 h-3.5" />
            InsightFace Buffalo_S (512D)
          </span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            CSDL v2.5 Chuẩn Hóa
          </span>
          <span className="text-slate-400">SV: Vũ Tiến Đức (2310900023)</span>
        </div>
      </div>
    </footer>
  );
};
