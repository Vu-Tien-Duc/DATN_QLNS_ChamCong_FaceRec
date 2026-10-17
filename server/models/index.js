/**
 * Barrel Export cho đúng 14 Model Cơ sở dữ liệu:
 * CSDL thuần Việt (14 collections & fields tiếng Việt) + Model Code Tiếng Anh (aliases)
 * Đúng theo bản đặc tả v2.5 THIET_KE_CSDL_VA_QUY_TRINH_NGHIEP_VU.md
 */
const User = require('./user.model');
const FaceTemplate = require('./faceTemplate.model');
const Department = require('./department.model');
const ShiftConfig = require('./shiftConfig.model');
const Subject = require('./subject.model');
const Schedule = require('./schedule.model');
const Holiday = require('./holiday.model');
const PunchLog = require('./punchLog.model');
const AttendanceLog = require('./attendanceLog.model');
const LeaveRequest = require('./leaveRequest.model');
const Payroll = require('./payroll.model');
const RefreshToken = require('./refreshToken.model');
const SystemConfig = require('./systemConfig.model');
const AuditLog = require('./auditLog.model');

module.exports = {
  // 14 Model chuẩn Code tiếng Anh
  User,
  FaceTemplate,
  Department,
  ShiftConfig,
  Subject,
  Schedule,
  Holiday,
  PunchLog,
  AttendanceLog,
  LeaveRequest,
  Payroll,
  RefreshToken,
  SystemConfig,
  AuditLog,

  // 14 Model tương thích chuẩn tiếng Việt
  NguoiDung: User,
  DuLieuKhuonMat: FaceTemplate,
  MauKhuonMat: FaceTemplate,
  DonVi: Department,
  PhongBan: Department,
  CaLamViec: ShiftConfig,
  MonHoc: Subject,
  LichGiangDay: Schedule,
  LichTrinh: Schedule,
  NgayNghiLe: Holiday,
  LuotQuetChamCong: PunchLog,
  LuotQuet: PunchLog,
  CongTongHop: AttendanceLog,
  NhatKyChamCong: AttendanceLog,
  DonTu: LeaveRequest,
  DonNghiPhep: LeaveRequest,
  PhieuLuong: Payroll,
  MaLamMoi: RefreshToken,
  CauHinhHeThong: SystemConfig,
  NhatKyKiemToan: AuditLog,
};
