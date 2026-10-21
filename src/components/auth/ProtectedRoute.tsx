import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiểm tra quyền truy cập theo vai trò nếu có yêu cầu
  if (allowedRoles && allowedRoles.length > 0) {
    const normUserRole = String(user?.role || '').toLowerCase().replace(/_/g, '');
    const hasRole =
      Boolean(normUserRole) &&
      allowedRoles.some((r) => r.toLowerCase().replace(/_/g, '') === normUserRole);

    if (!hasRole) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <Card glass className="max-w-md w-full text-center p-6 border-rose-200 dark:border-rose-900/50">
            <CardContent className="space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/60 shadow-sm">
                <ShieldAlert className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Truy Cập Bị Giới Hạn (403)
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tài khoản của bạn ({user?.fullName} - {user?.role?.toUpperCase()}) không có quyền truy
                cập vào phân hệ này. Vui lòng liên hệ Quản trị viên để được cấp quyền.
              </p>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => window.history.back()}
                >
                  Quay Lại
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
};
