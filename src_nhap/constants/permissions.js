// src/constants/permissions.js

export const SUPER_ADMIN = 'all';

export const PERMISSIONS = {
  SUPER_ADMIN: 'all',

  // Nhóm Tổng quan & Báo cáo
  DASHBOARD: {
    VIEW: 'dashboard.view',
    REPORTS_GENERAL: 'reports.view',
    REPORTS_STUDENT: 'student-report.view',
  },
  REPORTS: {
    GENERAL: 'reports.view',
    STUDENT: 'student-report.view',
  },
  POSTS: {
    VIEW: 'posts.view',
    MANAGE: 'posts.manage',
  },

  // Nhóm CRM & Marketing
  LEADS: {
    VIEW: 'leads.view',
    EDIT: 'leads.edit',
  },
  APPOINTMENTS: {
    VIEW: 'appointments.view',
  },
  ENROLLMENTS: {
    VIEW: 'enrollments.view',
  },
  CSKH: {
    VIEW: 'cskh.view',
  },
  LEAD_SOURCES: {
    MANAGE: 'lead-sources.manage',
  },

  // Nhóm Học vụ
  STUDENTS: {
    VIEW: 'students.view',
    EDIT: 'students.edit',
  },
  COURSES: {
    VIEW: 'courses.view',
    MANAGE: 'courses.manage',
  },
  SYLLABUS: {
    VIEW: 'syllabus.view',
    MANAGE: 'syllabus.manage',
  },
  CLASSES: {
    VIEW: 'classes.view',
    MANAGE: 'classes.manage',
  },
  GRADES: {
    VIEW: 'grades.view',
    MANAGE: 'grades.manage',
  },
  SCHEDULE: {
    VIEW: 'schedule.view',
    MANAGE: 'schedule.manage',
  },
  TEACHERS: {
    VIEW: 'teachers.view',
  },
  TEACHER_SELF_ATTENDANCE: {
    VIEW: 'teacher-self-attendance.view',
    MANAGE: 'teacher-self-attendance.manage',
  },
  ATTENDANCE: {
    VIEW: 'attendance.view',
    MANAGE: 'attendance.manage',
  },
  RESOURCES: {
    MANAGE: 'resources.manage',
  },

  // Nhóm Tài chính
  TUITION: {
    VIEW: 'tuition.view',
    COLLECT: 'tuition.collect',
  },
  TRANSACTIONS: {
    VIEW: 'transactions.view',
  },

  // Nhóm Nhân sự & Lịch làm việc
  EMPLOYEES: {
    VIEW: 'employees.view',
    MANAGE: 'employees.manage',
  },
  WORK_SCHEDULE: {
    VIEW: 'work-schedule.view',
    REGISTER: 'work-schedule.register',
    MANAGE: 'work-schedule.manage',
  },
  RECEPTIONIST_ATTENDANCE: {
    VIEW: 'receptionist-attendance.view',
    MANAGE: 'receptionist-attendance.manage',
  },
  TIMEKEEPING: {
    VIEW: 'timekeeping.view',
    MANAGE: 'timekeeping.manage',
  },
  SHIFT_ATTENDANCE: {
    VIEW: 'shift-attendance.view',
    MANAGE: 'shift-attendance.manage',
  },

  // Nhóm Hệ thống
  USERS: {
    MANAGE: 'users.manage',
  },
  CAMPUSES: {
    MANAGE: 'campuses.manage',
  },
  PERMISSIONS: {
    MANAGE: 'permissions.manage',
  },
  SETTINGS: {
    EDIT: 'settings.edit',
  },

  // Nhóm Dự án & Công việc
  PROJECTS: {
    VIEW: 'projects.view',
    MANAGE: 'projects.manage',
  },
  TASKS: {
    VIEW: 'tasks.view',
    MANAGE: 'tasks.manage',
  },
  DEPARTMENTS: {
    VIEW: 'departments.view',
    MANAGE: 'departments.manage',
  },
  GROUPS: {
    VIEW: 'groups.view',
    MANAGE: 'groups.manage',
  }
};

export const PERMISSION_GROUPS = [
  {
    title: 'Tổng quan & Báo cáo',
    permissions: [
      { id: PERMISSIONS.DASHBOARD.VIEW, name: 'Xem Dashboard tổng số' },
      { id: PERMISSIONS.REPORTS.GENERAL, name: 'Xem báo cáo tổng hợp' },
      { id: PERMISSIONS.REPORTS.STUDENT, name: 'Xem báo cáo học viên' },
      { id: PERMISSIONS.POSTS.VIEW, name: 'Xem bản tin doanh nghiệp' },
      { id: PERMISSIONS.POSTS.MANAGE, name: 'Quản lý bản tin doanh nghiệp' },
    ]
  },
  {
    title: 'CRM & Marketing',
    permissions: [
      { id: PERMISSIONS.LEADS.VIEW, name: 'Xem danh sách Lead' },
      { id: PERMISSIONS.LEADS.EDIT, name: 'Thêm/Sửa Lead' },
      { id: PERMISSIONS.APPOINTMENTS.VIEW, name: 'Quản lý lịch hẹn' },
      { id: PERMISSIONS.ENROLLMENTS.VIEW, name: 'Quản lý Ghi danh' },
      { id: PERMISSIONS.CSKH.VIEW, name: 'Chăm sóc khách hàng' },
      { id: PERMISSIONS.LEAD_SOURCES.MANAGE, name: 'Cấu hình Nguồn Lead' },
    ]
  },
  {
    title: 'Học vụ & Đào tạo',
    permissions: [
      { id: PERMISSIONS.STUDENTS.VIEW, name: 'Xem hồ sơ học viên' },
      { id: PERMISSIONS.STUDENTS.EDIT, name: 'Chỉnh sửa học viên' },
      { id: PERMISSIONS.COURSES.VIEW, name: 'Xem danh sách khóa học' },
      { id: PERMISSIONS.COURSES.MANAGE, name: 'Quản lý khóa học' },
      { id: PERMISSIONS.SYLLABUS.VIEW, name: 'Xem khung chương trình' },
      { id: PERMISSIONS.SYLLABUS.MANAGE, name: 'Quản lý Khung chương trình' },
      { id: PERMISSIONS.CLASSES.VIEW, name: 'Xem danh sách lớp' },
      { id: PERMISSIONS.CLASSES.MANAGE, name: 'Quản lý lớp học' },
      { id: PERMISSIONS.GRADES.VIEW, name: 'Xem bảng điểm' },
      { id: PERMISSIONS.GRADES.MANAGE, name: 'Quản lý điểm số' },
      { id: PERMISSIONS.SCHEDULE.VIEW, name: 'Xem lịch giảng dạy' },
      { id: PERMISSIONS.TEACHERS.VIEW, name: 'Xem danh sách giảng viên' },
      { id: PERMISSIONS.ATTENDANCE.VIEW, name: 'Thực hiện điểm danh' },
      { id: PERMISSIONS.ATTENDANCE.MANAGE, name: 'Quản lý điểm danh' },
      { id: PERMISSIONS.TEACHER_SELF_ATTENDANCE.VIEW, name: 'Giảng viên Tự tích công giảng dạy' },
      { id: PERMISSIONS.TEACHER_SELF_ATTENDANCE.MANAGE, name: 'Quản lý Duyệt công Giảng viên' },
      { id: PERMISSIONS.RESOURCES.MANAGE, name: 'Quản lý tài liệu học tập' },
    ]
  },
  {
    title: 'Tài chính & Kế toán',
    permissions: [
      { id: PERMISSIONS.TUITION.VIEW, name: 'Xem công nợ học phí' },
      { id: PERMISSIONS.TUITION.COLLECT, name: 'Thực hiện thu học phí' },
      { id: PERMISSIONS.TRANSACTIONS.VIEW, name: 'Quản lý Thu/Chi' },
    ]
  },
  {
    title: 'Nhân sự & Vận hành',
    permissions: [
      { id: PERMISSIONS.EMPLOYEES.VIEW, name: 'Xem danh sách nhân viên' },
      { id: PERMISSIONS.EMPLOYEES.MANAGE, name: 'Quản lý hồ sơ nhân viên' },
      { id: PERMISSIONS.WORK_SCHEDULE.VIEW, name: 'Đăng ký lịch làm việc cá nhân' },
      { id: PERMISSIONS.WORK_SCHEDULE.MANAGE, name: 'Quản lý lịch trực Team' },
      { id: PERMISSIONS.RECEPTIONIST_ATTENDANCE.VIEW, name: 'Lễ tân Tích ca làm việc tại Cơ sở' },
      { id: PERMISSIONS.RECEPTIONIST_ATTENDANCE.MANAGE, name: 'Quản lý Phân công & Duyệt ca Lễ tân' },
      { id: PERMISSIONS.ATTENDANCE.VIEW, name: 'Sử dụng Check-in/Chấm công' },
      { id: PERMISSIONS.USERS.MANAGE, name: 'Quản lý tài khoản hệ thống' },
      { id: PERMISSIONS.SHIFT_ATTENDANCE.VIEW, name: 'Tự điểm danh Ca làm việc (Nhân sự thời vụ)' },
      { id: PERMISSIONS.SHIFT_ATTENDANCE.MANAGE, name: 'Phê duyệt & Quản lý điểm danh (Nhân sự thời vụ)' },
    ]
  },
  {
    title: 'Hệ thống & Cài đặt',
    permissions: [
      { id: PERMISSIONS.CAMPUSES.MANAGE, name: 'Quản lý Cơ sở & Phòng học' },
      { id: PERMISSIONS.SETTINGS.EDIT, name: 'Cấu hình hệ thống chung' },
      { id: PERMISSIONS.PERMISSIONS.MANAGE, name: 'Cấu hình phân quyền Role' },
    ]
  },
  {
    title: 'Dự án & Công việc',
    permissions: [
      { id: PERMISSIONS.PROJECTS.VIEW, name: 'Xem danh sách dự án' },
      { id: PERMISSIONS.PROJECTS.MANAGE, name: 'Quản lý dự án' },
      { id: PERMISSIONS.TASKS.VIEW, name: 'Xem danh sách công việc' },
      { id: PERMISSIONS.TASKS.MANAGE, name: 'Quản lý công việc' },
      { id: PERMISSIONS.DEPARTMENTS.VIEW, name: 'Xem danh sách phòng ban' },
      { id: PERMISSIONS.DEPARTMENTS.MANAGE, name: 'Quản lý phòng ban' },
      { id: PERMISSIONS.GROUPS.VIEW, name: 'Xem danh sách nhóm' },
      { id: PERMISSIONS.GROUPS.MANAGE, name: 'Quản lý nhóm' },
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PERMISSIONS, PERMISSION_GROUPS, SUPER_ADMIN };
}