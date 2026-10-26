import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { hasRole, getRoleLabel } from '../../utils/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  excludeRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, excludeRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  const isAllowed = !((allowedRoles && allowedRoles.length > 0) || (excludeRoles && excludeRoles.length > 0)) ||
    hasRole(user, allowedRoles, excludeRoles);

  useEffect(() => {
    if (isAuthenticated && !isAllowed) {
      toast.error('Bạn không có quyền truy cập chức năng này.', { id: 'forbidden-access' });
    }
  }, [isAuthenticated, isAllowed]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiểm tra quyền truy cập theo vai trò nếu có yêu cầu
  if (!isAllowed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card glass className="max-w-md w-full text-center p-6 border-rose-200 dark:border-rose-900/50">
          <CardContent className="space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200/60 dark:border-rose-800/60 shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {user?.role && String(user.role).toLowerCase().includes('admin')
                ? 'Phân Hệ Không Dành Cho Quản Trị Viên'
                : 'Bạn Không Có Quyền Truy Cập Chức Năng Này'}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.role && String(user.role).toLowerCase().includes('admin')
                ? `Tài khoản Quản trị viên (${user?.fullName}) phụ trách quản trị và giám sát hệ thống, không áp dụng dữ liệu cá nhân này. Vui lòng chuyển sang phân hệ Quản lý tương ứng.`
                : `Tài khoản của bạn (${user?.fullName} - ${getRoleLabel(user?.role)}) không có quyền truy cập vào phân hệ này. Vui lòng liên hệ Ban Giám Hiệu hoặc Quản trị viên để được cấp quyền.`}
            </p>

              <div className="pt-2 flex items-center justify-center gap-2">
                {user?.role && String(user.role).toLowerCase().includes('admin') ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => (window.location.href = '/attendance-manage')}
                  >
                    Đến Quản Lý Điểm Danh
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                    onClick={() => window.history.back()}
                  >
                    Quay Lại
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/')}
                >
                  Trang Chủ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

  return <>{children}</>;
};
