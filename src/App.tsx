import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from './components/boCuc/KhungChinh';
import { Dashboard } from './pages/tongQuan/TrangTongQuan';
import { FaceAttendance } from './pages/chamCong/TrangChamCongKhuonMat';
import { FaceRegistrationPage } from './pages/khuonMat/TrangDangKyKhuonMat';
import { Schedules } from './pages/nhanSu/TrangLichTrinh';
import { Users } from './pages/nhanSu/TrangNguoiDung';
import { Departments } from './pages/nhanSu/TrangPhongBan';
import { LeaveRequests } from './pages/donNghiPhep/TrangDonNghiPhep';
import { AttendanceMe } from './pages/chamCong/TrangChamCongCaNhan';
import { AttendanceManage } from './pages/chamCong/TrangQuanLyChamCong';
import { Payroll } from './pages/tienLuong/TrangPhieuLuong';
import { Reports } from './pages/baoCao/TrangBaoCao';
import { Subjects } from './pages/nhanSu/TrangMonHoc';
import { Shifts } from './pages/chamCong/TrangCaLamViec';
import { Holidays } from './pages/chamCong/TrangNgayNghiLe';
import { AuditLogs } from './pages/heThong/TrangNhatKyKiemToan';
import { Settings } from './pages/heThong/TrangCaiDatHeThong';
import { Profile } from './pages/xacThuc/TrangHoSoCaNhan';
import { Login } from './pages/xacThuc/TrangDangNhap';
import { PublicLayout } from './pages/congKhai/BoCucCongKhai';
import { FacultyDirectory } from './pages/congKhai/DanhBaGiangVien';
import { FacultyDetail } from './pages/congKhai/ChiTietGiangVien';
import { ProtectedRoute } from './components/xacThuc/TuyenBaoVe';
import { useThemeStore } from './stores/useGiaoDienStore';
import { useAuthStore } from './stores/useXacThucStore';

export const App: React.FC = () => {
  const { isDark } = useThemeStore();
  const { fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <BrowserRouter>
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
        <Route path="/dang-nhap" element={<Login />} />
        <Route path="/login" element={<Navigate to="/dang-nhap" replace />} />

        {/* Cổng Thông Tin & Danh Bạ Giảng Viên Công Khai */}
        <Route path="/giang-vien" element={<PublicLayout />}>
          <Route index element={<FacultyDirectory />} />
          <Route path=":id" element={<FacultyDetail />} />
        </Route>
        <Route path="/public-giangvien" element={<Navigate to="/giang-vien" replace />} />

        {/* Các tuyến được bảo vệ bởi ProtectedRoute */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Chấm công & Sinh trắc học */}
          <Route path="diem-danh-khuon-mat" element={<FaceAttendance />} />
          <Route
            path="cham-cong-ca-nhan"
            element={
              <ProtectedRoute excludeRoles={['admin']}>
                <AttendanceMe />
              </ProtectedRoute>
            }
          />
          <Route
            path="quan-ly-cham-cong"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'truong_bo_mon', 'pho_bo_mon', 'truong_phong', 'pho_phong', 'tccb']}>
                <AttendanceManage />
              </ProtectedRoute>
            }
          />

          {/* Hồ sơ, Đơn từ & Lịch trình */}
          <Route path="ho-so" element={<Profile />} />
          <Route path="don-nghi-phep" element={<LeaveRequests />} />
          <Route path="lich-trinh" element={<Schedules />} />

          {/* Nhân sự & Tổ chức */}
          <Route
            path="nguoi-dung"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'tccb']}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route path="phong-ban" element={<Departments />} />
          <Route
            path="mon-hoc"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'truong_khoa', 'dao_tao']}>
                <Subjects />
              </ProtectedRoute>
            }
          />

          {/* Tài chính Lương & Báo cáo */}
          <Route path="phieu-luong" element={<Payroll />} />
          <Route
            path="bao-cao"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'ke_toan', 'truong_khoa', 'pho_khoa']}>
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Cấu hình & Quản trị hệ thống */}
          <Route
            path="dang-ky-khuon-mat"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'tccb']}>
                <FaceRegistrationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="ca-lam-viec"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'dao_tao']}>
                <Shifts />
              </ProtectedRoute>
            }
          />
          <Route path="ngay-nghi-le" element={<Holidays />} />
          <Route
            path="nhat-ky-kiem-toan"
            element={
              <ProtectedRoute allowedRoles={['admin', 'bgh', 'kiem_toan']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="cai-dat"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Chuyển hướng tương thích ngược từ URL tiếng Anh cũ */}
          <Route path="face-attendance" element={<Navigate to="/diem-danh-khuon-mat" replace />} />
          <Route path="attendance-me" element={<Navigate to="/cham-cong-ca-nhan" replace />} />
          <Route path="attendance-manage" element={<Navigate to="/quan-ly-cham-cong" replace />} />
          <Route path="profile" element={<Navigate to="/ho-so" replace />} />
          <Route path="leave-requests" element={<Navigate to="/don-nghi-phep" replace />} />
          <Route path="schedules" element={<Navigate to="/lich-trinh" replace />} />
          <Route path="users" element={<Navigate to="/nguoi-dung" replace />} />
          <Route path="departments" element={<Navigate to="/phong-ban" replace />} />
          <Route path="subjects" element={<Navigate to="/mon-hoc" replace />} />
          <Route path="payroll" element={<Navigate to="/phieu-luong" replace />} />
          <Route path="reports" element={<Navigate to="/bao-cao" replace />} />
          <Route path="face-registration" element={<Navigate to="/dang-ky-khuon-mat" replace />} />
          <Route path="face-templates" element={<Navigate to="/dang-ky-khuon-mat" replace />} />
          <Route path="shifts" element={<Navigate to="/ca-lam-viec" replace />} />
          <Route path="holidays" element={<Navigate to="/ngay-nghi-le" replace />} />
          <Route path="audit-logs" element={<Navigate to="/nhat-ky-kiem-toan" replace />} />
          <Route path="settings" element={<Navigate to="/cai-dat" replace />} />

          {/* Fallback 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
