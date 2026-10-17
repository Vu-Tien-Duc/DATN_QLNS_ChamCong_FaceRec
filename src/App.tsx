import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Departments from './pages/Departments';
import AttendanceMe from './pages/AttendanceMe';
import AttendanceManage from './pages/AttendanceManage';
import Shifts from './pages/Shifts';
import Schedules from './pages/Schedules';
import Subjects from './pages/Subjects';
import LeaveRequests from './pages/LeaveRequests';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import FaceRegistrationPage from './pages/FaceRegistrationPage';
import Payroll from './pages/Payroll';
import AIChat from './pages/AIChat';
import Holidays from './pages/Holidays';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    {/* Dashboard */}
                    <Route path="/" element={<Dashboard />} />

                    {/* Trợ lý AI */}
                    <Route path="/ai-chat" element={<AIChat />} />

                    {/* Nhân sự & Sinh trắc học */}
                    <Route path="/users" element={<Users />} />
                    <Route path="/departments" element={<Departments />} />
                    <Route path="/face-registration" element={<FaceRegistrationPage />} />

                    {/* Chấm công */}
                    <Route path="/attendance/me" element={<AttendanceMe />} />
                    <Route path="/attendance/history" element={<AttendanceManage />} />
                    <Route path="/attendance/manage" element={<AttendanceManage />} />

                    {/* Lịch làm việc & Ngày nghỉ */}
                    <Route path="/shifts" element={<Shifts />} />
                    <Route path="/schedules" element={<Schedules />} />
                    <Route path="/holidays" element={<Holidays />} />

                    {/* Môn học */}
                    <Route path="/subjects" element={<Subjects />} />

                    {/* Nghỉ phép */}
                    <Route path="/leave-requests" element={<LeaveRequests />} />

                    {/* Bảng lương & Thu nhập */}
                    <Route path="/payroll" element={<Payroll />} />

                    {/* Báo cáo */}
                    <Route path="/reports/attendance" element={<Reports />} />
                    <Route path="/reports/audit" element={<AuditLogs />} />

                    {/* Cài đặt */}
                    <Route path="/settings" element={<Settings />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#1e293b',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
    </AuthProvider>
  );
}
