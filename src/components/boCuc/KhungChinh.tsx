import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './ThanhBen';
import { Navbar } from './ThanhTren';
import { Footer } from './ChanTrang';
import { AiChatBox } from '../troLyAi/index';
import { cameraManager } from '../../utils/quanLyCamera';
import { touchSessionActivity } from '../../stores/useXacThucStore';

export const MainLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Tự động tắt toàn bộ camera phần cứng khi người dùng điều hướng sang trang khác
  useEffect(() => {
    if (location.pathname !== '/diem-danh-khuon-mat') {
      cameraManager.stopAllStreams();
    }
  }, [location.pathname]);

  // Ghi nhận hoạt động người dùng (tối đa mỗi 15 giây) để phục vụ idle timeout 15 phút
  useEffect(() => {
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouch > 15000) {
        lastTouch = now;
        touchSessionActivity();
      }
    };
    window.addEventListener('click', onActivity);
    window.addEventListener('keydown', onActivity);
    window.addEventListener('mousemove', onActivity);
    return () => {
      window.removeEventListener('click', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('mousemove', onActivity);
    };
  }, []);

  // Lift collapsed state so the main content can coordinate its width
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ntu_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('ntu_sidebar_collapsed', String(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  return (
    /* Root: exactly viewport height, no page-level scroll.
       Sidebar & main each manage their own overflow internally. */
    <div
      data-app-shell="true"
      className="h-screen flex overflow-hidden bg-[#F8F9FC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200"
    >
      {/* Sidebar — fixed-height flex child on desktop, overlay on mobile */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
      />

      {/* Main Content Area — flex-1, scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMobileOpen={() => setIsMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6 pb-20 sm:pb-16 w-full min-w-0 animate-fade-in">
          <Outlet />
          {/* Footer inside scrollable area so it stays below content */}
          <Footer />
        </main>
      </div>

      {/* Trợ lý AI Đa Năng (NTU AI Hub Floating Bubble) */}
      <AiChatBox />
    </div>
  );
};
