import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from './components/layout/MainLayout';
import { DashboardDemo } from './pages/DashboardDemo';
import { FaceAttendance } from './pages/FaceAttendance';
import { FaceRegistrationPage } from './pages/FaceRegistrationPage';
import { Schedules } from './pages/Schedules';
import { Users } from './pages/Users';
import { Departments } from './pages/Departments';
import { PlaceholderPage } from './pages/PlaceholderPage';
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
          <Route index element={<DashboardDemo />} />

          {/* Các phân hệ Chấm công & Sinh trắc học */}
          <Route path="face-attendance" element={<FaceAttendance />} />
          <Route
            path="attendance-me"
            element={
              <PlaceholderPage
                title="Lịch Sử Chấm Công Cá Nhân"
                description="Xem chi tiết các lượt quét vân tay/khuôn mặt, ca làm việc và tổng số giờ công trong tháng."
              />
            }
          />
          <Route
            path="attendance-manage"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'pho_khoa']}>
                <PlaceholderPage
                  title="Quản Lý Chấm Công Toàn Trường"
                  description="Bảng tổng hợp điểm danh cán bộ, giảng viên theo khoa và hỗ trợ điểm danh bổ sung có phê duyệt."
                />
              </ProtectedRoute>
            }
          />

          {/* Đơn từ & Lịch trình */}
          <Route
            path="leave-requests"
            element={
              <PlaceholderPage
                title="Quản Lý Đơn Nghỉ Phép"
                description="Nộp đơn nghỉ ốm, phép năm, việc riêng và quy trình phê duyệt cấp bậc Trưởng khoa / Ban Giám Hiệu."
              />
            }
          />
          <Route path="schedules" element={<Schedules />} />

          {/* Nhân sự & Tổ chức */}
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'tccb']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="departments"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'truongkhoa', 'pho_khoa', 'tccb', 'giangvien', 'nhanvien']}>
                <Departments />
              </ProtectedRoute>
            }
          />
          <Route
            path="subjects"
            element={
              <PlaceholderPage
                title="Danh Mục Môn Học"
                description="Quản lý học phần, số tín chỉ, định mức giờ chuẩn giảng dạy và thuộc khoa quản lý."
              />
            }
          />

          {/* Tài chính Lương & Báo cáo */}
          <Route
            path="payroll"
            element={
              <PlaceholderPage
                title="Bảng Lương 2026 (Snapshot)"
                description="Tính lương tự động theo công thức 2026: Lương cơ sở 2.34tr, phụ cấp chức vụ, thâm niên, ưu đãi nghề và khấu trừ thuế TNCN."
              />
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'ke_toan', 'truong_khoa']}>
                <PlaceholderPage
                  title="Báo Cáo & Thống Kê"
                  description="Biểu đồ tỷ lệ đi làm đúng giờ, đi muộn, vắng mặt và xuất file Excel báo cáo định kỳ."
                />
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
              <ProtectedRoute allowedRoles={['admin', 'bgh']}>
                <PlaceholderPage
                  title="Ca Làm Việc & Khung Giờ Điểm Danh"
                  description="Ca hành chính sáng/chiều và các ca học theo tiết giảng đường."
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="audit-logs"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh']}>
                <PlaceholderPage
                  title="Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)"
                  description="Theo dõi mọi hành vi đăng nhập, thêm, sửa, xóa dữ liệu nhạy cảm phục vụ bảo mật an toàn thông tin."
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <PlaceholderPage
                  title="Cấu Hình 19 Tham Số Hệ Thống"
                  description="Điều chỉnh ngưỡng AI, bán kính GPS geofence trường, lương cơ sở và hạn mức phép năm."
                />
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
