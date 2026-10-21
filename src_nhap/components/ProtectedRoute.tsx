import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';

/**
 * ProtectedRoute
 *
 * Ngoài việc kiểm tra xác thực, còn chủ động xác minh token
 * với server MỖI KHI CHUYỂN ROUTE — để phát hiện force logout ngay lập tức.
 *
 * Luồng:
 * • Mỗi khi location thay đổi (navigate)
 *   → gọi ngầm GET /auth/me
 *   → Nếu bình thường: không làm gì
 *   → Nếu 401 + FORCE_LOGGED_OUT: apiClient interceptor tự clear session + redirect
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();
  const lastCheckedPath = useRef<string | null>(null);

  // ── Kiểm tra token mỗi khi chuyển route ──
  useEffect(() => {
    // Chỉ check khi đã initialized và đang đăng nhập
    if (!isInitialized || !isAuthenticated) return;

    // Tránh gọi 2 lần cho cùng 1 route
    if (lastCheckedPath.current === location.pathname) return;
    lastCheckedPath.current = location.pathname;

    // Gọi ngầm - không block UI, không hiện loading
    // Nếu token bị revoke → interceptor trong apiClient.ts tự xử lý
    apiClient.get('/auth/me').catch(() => {
      // Lỗi thường (network, 500...) bỏ qua
      // Lỗi 401 FORCE_LOGGED_OUT đã được interceptor bắt → auto logout
    });
  }, [location.pathname, isInitialized, isAuthenticated]);

  // ── Spinner khi đang bootstrap ──
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-4 border-indigo-100 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-500 font-medium text-sm">Đang xác thực tài khoản...</p>
        </div>
      </div>
    );
  }

  // ── Chưa đăng nhập → về /login ──
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}