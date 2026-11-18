import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicHeader } from './components/TieuDeCongKhai';
import { PublicFooter } from './components/ChanTrangCongKhai';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full overflow-x-hidden flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Cổng Header Đại học Nguyễn Trãi (Khung chuẩn Phenikaa) */}
      <PublicHeader />

      {/* Main Content Area */}
      <main className="flex-1 w-full overflow-x-hidden">
        <Outlet />
      </main>

      {/* Footer Học thuật & Liên kết Hệ sinh thái */}
      <PublicFooter />
    </div>
  );
};
