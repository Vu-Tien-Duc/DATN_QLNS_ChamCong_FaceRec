
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { PERMISSIONS } from './constants/permissions';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadSources from './pages/LeadSources';
import Enrollments from './pages/Enrollments';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import CSKH from './pages/CSKH';
import Reports from './pages/Reports';
import StudentReport from './pages/StudentReport';
import Schedule from './pages/Schedule';
import Classes from './pages/Classes';
import Attendance from './pages/Attendance';
import TeacherAttendanceReport from './pages/TeacherAttendanceReport';
import TeacherSelfAttendance from './pages/TeacherSelfAttendance';
import PayrollReport from './pages/PayrollReport';
import OperatingExpenseReport from './pages/OperatingExpenseReport';
import Tuition from './pages/Tuition';
import Transactions from './pages/Transactions';
import BankAccounts from './pages/BankAccounts';
import Settings from './pages/Settings';
import Permissions from './pages/Permissions';
import Employees from './pages/Employees';
import Resources from './pages/Resources';
import Users from './pages/Users';
import Appointments from './pages/Appointments';
import Courses from './pages/Courses';
import Campuses from './pages/Campuses';
import Syllabus from './pages/Syllabus';
import Grades from './pages/Grades';
import WorkSchedule from './pages/WorkSchedule';
import TeamSchedule from './pages/TeamSchedule';
import Timekeeping from './pages/Timekeeping';
import ReceptionistAttendance from './pages/ReceptionistAttendance';
import Newsfeed from './pages/Newsfeed';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tasks from './pages/Tasks';
import Departments from './pages/Departments';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import LoginLogs from './pages/LoginLogs';
import ShiftAttendance from './pages/ShiftAttendance';
import ShiftReport from './pages/ShiftReport';
import ManageShiftAttendance from './pages/ManageShiftAttendance';
import EmployeeAttendance from './pages/EmployeeAttendance';

/**
 * Higher Order Component để bảo vệ Route theo quyền hạn
 */
const PermissionRoute = ({ 
  children, 
  permission 
}: { 
  children: React.ReactNode, 
  permission: string 
}) => {
  const { can, isInitialized, hasRole } = useAuth();
  
  // Chờ bootstrap xong mới kiểm tra quyền
  if (!isInitialized) return null;

  const isParent = hasRole('parent') || hasRole('phụ huynh');
  if (isParent) {
    const currentPath = window.location.pathname;
    // Phụ huynh chỉ được vào một số mục nhất định
    const allowedPaths = ['/attendance', '/student-report', '/newsfeed', '/students'];
    const isAllowed = allowedPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'));
    if (!isAllowed) {
      return <Navigate to="/student-report" replace />;
    }
  }
  
  const isStudent = hasRole('student') || hasRole('học viên');
  if (isStudent && (permission === PERMISSIONS.TIMEKEEPING.VIEW || permission === PERMISSIONS.TIMEKEEPING.MANAGE)) {
    return <Navigate to="/" replace />;
  }
  
  if (!can(permission)) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/newsfeed" element={<PermissionRoute permission={PERMISSIONS.POSTS.VIEW}><Newsfeed /></PermissionRoute>} />
                    
                    {/* CRM & Marketing */}
                    <Route path="/leads" element={<PermissionRoute permission={PERMISSIONS.LEADS.VIEW}><Leads /></PermissionRoute>} />
                    <Route path="/appointments" element={<PermissionRoute permission={PERMISSIONS.APPOINTMENTS.VIEW}><Appointments /></PermissionRoute>} />
                    <Route path="/enrollments" element={<PermissionRoute permission={PERMISSIONS.ENROLLMENTS.VIEW}><Enrollments /></PermissionRoute>} />
                    <Route path="/cskh" element={<PermissionRoute permission={PERMISSIONS.CSKH.VIEW}><CSKH /></PermissionRoute>} />
                    <Route path="/lead-sources" element={<PermissionRoute permission={PERMISSIONS.LEAD_SOURCES.MANAGE}><LeadSources /></PermissionRoute>} />
                    
                    {/* Học vụ */}
                    <Route path="/students" element={<PermissionRoute permission={PERMISSIONS.STUDENTS.VIEW}><Students /></PermissionRoute>} />
                    <Route path="/teachers" element={<PermissionRoute permission={PERMISSIONS.TEACHERS.VIEW}><Teachers /></PermissionRoute>} />
                    <Route path="/courses" element={<PermissionRoute permission={PERMISSIONS.COURSES.VIEW}><Courses /></PermissionRoute>} />
                    <Route path="/syllabus" element={<PermissionRoute permission={PERMISSIONS.SYLLABUS.VIEW}><Syllabus /></PermissionRoute>} />
                    <Route path="/classes" element={<PermissionRoute permission={PERMISSIONS.CLASSES.VIEW}><Classes /></PermissionRoute>} />
                    <Route path="/grades" element={<PermissionRoute permission={PERMISSIONS.GRADES.VIEW}><Grades /></PermissionRoute>} />
                    <Route path="/schedule" element={<PermissionRoute permission={PERMISSIONS.SCHEDULE.VIEW}><Schedule /></PermissionRoute>} />
                    <Route path="/attendance" element={<PermissionRoute permission={PERMISSIONS.ATTENDANCE.VIEW}><Attendance /></PermissionRoute>} />
                    <Route path="/teacher-self-attendance" element={<PermissionRoute permission={PERMISSIONS.TEACHER_SELF_ATTENDANCE.VIEW}><TeacherSelfAttendance /></PermissionRoute>} />
                    <Route path="/teacher-attendance-report" element={<PermissionRoute permission={PERMISSIONS.ATTENDANCE.VIEW}><TeacherAttendanceReport /></PermissionRoute>} />
                    <Route path="/resources" element={<PermissionRoute permission={PERMISSIONS.RESOURCES.MANAGE}><Resources /></PermissionRoute>} />
                    
                    {/* Tài chính */}
                    <Route path="/tuition" element={<PermissionRoute permission={PERMISSIONS.TUITION.VIEW}><Tuition /></PermissionRoute>} />
                    <Route path="/transactions" element={<PermissionRoute permission={PERMISSIONS.TRANSACTIONS.VIEW}><Transactions /></PermissionRoute>} />
                    <Route path="/bank-accounts" element={<PermissionRoute permission={PERMISSIONS.TRANSACTIONS.VIEW}><BankAccounts /></PermissionRoute>} />
                    
                    {/* Nhân sự & Vận hành */}
                    <Route path="/employees" element={<PermissionRoute permission={PERMISSIONS.EMPLOYEES.VIEW}><Employees /></PermissionRoute>} />
                    <Route path="/users" element={<PermissionRoute permission={PERMISSIONS.USERS.MANAGE}><Users /></PermissionRoute>} />
                    <Route path="/work-schedule" element={<PermissionRoute permission={PERMISSIONS.WORK_SCHEDULE.VIEW}><WorkSchedule /></PermissionRoute>} />
                    <Route path="/team-schedule" element={<PermissionRoute permission={PERMISSIONS.WORK_SCHEDULE.MANAGE}><TeamSchedule /></PermissionRoute>} />
                    <Route path="/employee-attendance" element={<PermissionRoute permission={PERMISSIONS.EMPLOYEES.VIEW}><EmployeeAttendance /></PermissionRoute>} />
                    <Route path="/staff-attendance" element={<PermissionRoute permission={PERMISSIONS.EMPLOYEES.VIEW}><EmployeeAttendance /></PermissionRoute>} />
                    <Route path="/receptionist-attendance" element={<PermissionRoute permission={PERMISSIONS.EMPLOYEES.VIEW}><ReceptionistAttendance /></PermissionRoute>} />
                    <Route path="/timekeeping" element={<PermissionRoute permission={PERMISSIONS.TIMEKEEPING.VIEW}><Timekeeping /></PermissionRoute>} />
                    
                    {/* Nhân sự thời vụ */}
                    <Route path="/shift-worker/my-schedule" element={<PermissionRoute permission={PERMISSIONS.SHIFT_ATTENDANCE.VIEW}><WorkSchedule /></PermissionRoute>} />
                    <Route path="/shift-worker/attendance" element={<PermissionRoute permission={PERMISSIONS.SHIFT_ATTENDANCE.VIEW}><ShiftAttendance /></PermissionRoute>} />
                    <Route path="/shift-worker/my-report" element={<PermissionRoute permission={PERMISSIONS.SHIFT_ATTENDANCE.VIEW}><ShiftReport /></PermissionRoute>} />
                    <Route path="/shift-worker/manage" element={<PermissionRoute permission={PERMISSIONS.SHIFT_ATTENDANCE.MANAGE}><ManageShiftAttendance /></PermissionRoute>} />
                    
                    {/* Báo cáo */}
                    <Route path="/reports" element={<PermissionRoute permission={PERMISSIONS.DASHBOARD.REPORTS_GENERAL}><Reports /></PermissionRoute>} />
                    <Route path="/student-report" element={<PermissionRoute permission={PERMISSIONS.DASHBOARD.REPORTS_STUDENT}><StudentReport /></PermissionRoute>} />
                    <Route path="/payroll-report" element={<PermissionRoute permission={PERMISSIONS.ATTENDANCE.VIEW}><PayrollReport /></PermissionRoute>} />
                    <Route path="/operating-expense-report" element={<PermissionRoute permission={PERMISSIONS.ATTENDANCE.VIEW}><OperatingExpenseReport /></PermissionRoute>} />
                    
                    {/* Hệ thống */}
                    <Route path="/campuses" element={<PermissionRoute permission={PERMISSIONS.CAMPUSES.MANAGE}><Campuses /></PermissionRoute>} />
                    <Route path="/settings" element={<PermissionRoute permission={PERMISSIONS.SETTINGS.EDIT}><Settings /></PermissionRoute>} />
                    <Route path="/permissions" element={<PermissionRoute permission={PERMISSIONS.PERMISSIONS.MANAGE}><Permissions /></PermissionRoute>} />
                    <Route path="/login-logs" element={<PermissionRoute permission={PERMISSIONS.USERS.MANAGE}><LoginLogs /></PermissionRoute>} />

                    {/* Dự án & Công việc */}
                    <Route path="/projects" element={<PermissionRoute permission={PERMISSIONS.PROJECTS.VIEW}><Projects /></PermissionRoute>} />
                    <Route path="/projects/:id" element={<PermissionRoute permission={PERMISSIONS.PROJECTS.VIEW}><ProjectDetail /></PermissionRoute>} />
                    <Route path="/tasks" element={<PermissionRoute permission={PERMISSIONS.TASKS.VIEW}><Tasks /></PermissionRoute>} />
                    <Route path="/departments" element={<PermissionRoute permission={PERMISSIONS.DEPARTMENTS.VIEW}><Departments /></PermissionRoute>} />

                    {/* Sự kiện */}
                    <Route path="/events" element={<PermissionRoute permission={PERMISSIONS.SUPER_ADMIN}><Events /></PermissionRoute>} />
                    <Route path="/events/:id" element={<PermissionRoute permission={PERMISSIONS.SUPER_ADMIN}><EventDetail /></PermissionRoute>} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
