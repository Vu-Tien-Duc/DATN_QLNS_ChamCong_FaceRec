import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { FaceAttendance } from './pages/FaceAttendance';
import { FaceRegistrationPage } from './pages/FaceRegistrationPage';
import { Schedules } from './pages/Schedules';
import { Users } from './pages/Users';
import { Departments } from './pages/Departments';
import { LeaveRequests } from './pages/LeaveRequests';
import { AttendanceMe } from './pages/AttendanceMe';
import { AttendanceManage } from './pages/AttendanceManage';
import { Payroll } from './pages/Payroll';
import { Reports } from './pages/Reports';
import { Subjects } from './pages/Subjects';
import { Shifts } from './pages/Shifts';
import { Holidays } from './pages/Holidays';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { useThemeStore } from './store/useThemeStore';
import { useAuthStore } from './store/useAuthStore';

export const App: React.FC = () => {
  const { isDark } = useThemeStore();
  const { fetchMe } = useAuthStore();

  // Tự động kiểm tra và làm mới hồ sơ người dùng nếu đã có token
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <BrowserRouter>
      {/* Toast Notification Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#0f172a',
            border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
            borderRadius: '16px',
            fontSize: '13px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          },
        }}
      />

      <Routes>
        {/* Tuyến Đăng nhập công khai */}
        <Route path="/login" element={<Login />} />

        {/* Các tuyến được bảo vệ bởi ProtectedRoute */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Trang chủ / Dashboard */}
          <Route index element={<Dashboard />} />

          {/* Các phân hệ Chấm công & Sinh trắc học */}
          <Route path="face-attendance" element={<FaceAttendance />} />
          <Route
            path="attendance-me"
            element={
              <ProtectedRoute excludeRoles={['admin']}>
                <AttendanceMe />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance-manage"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truongkhoa', 'phokhoa', 'tccb']}>
                <AttendanceManage />
              </ProtectedRoute>
            }
          />

          {/* Đơn từ & Lịch trình */}
          <Route path="profile" element={<Profile />} />
          <Route path="leave-requests" element={<LeaveRequests />} />
          <Route path="schedules" element={<Schedules />} />

          {/* Nhân sự & Tổ chức */}
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truongkhoa', 'tccb']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="departments" element={<Departments />} />
          <Route
            path="subjects"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truongkhoa', 'daotao']}>
                <Subjects />
              </ProtectedRoute>
            }
          />

          {/* Tài chính Lương & Báo cáo */}
          <Route path="payroll" element={<Payroll />} />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'ketoan', 'truongkhoa']}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Cấu hình & Quản trị hệ thống */}
          <Route
            path="face-registration"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh']}>
                <FaceRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="face-templates"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh']}>
                <FaceRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="shifts"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'daotao']}>
                <Shifts />
              </ProtectedRoute>
            }
          />
          <Route path="holidays" element={<Holidays />} />
          <Route
            path="audit-logs"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'kiemtoan']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Fallback 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
