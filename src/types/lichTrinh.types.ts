import { ShiftItem } from './chamCong.types';

export type ScheduleType = 'chinh_khoa' | 'day_bu';
export type ScheduleExceptionStatus = 'nghi' | 'huy' | 'day_bu' | 'doi_ca';

export interface ScheduleExceptionItem {
  _id?: string;
  date?: string;
  ngay?: string;
  reason?: string;
  ly_do?: string;
  status?: ScheduleExceptionStatus;
  trang_thai?: ScheduleExceptionStatus;
  makeupDate?: string;
  ngay_day_bu?: string;
}

export interface SubjectItem {
  _id: string;
  name: string;
  ten_mon?: string;
  code: string;
  ma_mon?: string;
  credits?: number;
  so_tin_chi?: number;
  departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
  phong_ban_id?: string | { _id: string; name: string; ten_phong_ban?: string };
  description?: string;
  mo_ta?: string;
  isActive?: boolean;
  kich_hoat?: boolean;
}

export interface ScheduleItem {
  _id: string;
  userId?: {
    _id: string;
    fullName: string;
    ho_ten?: string;
    email: string;
    staffCode?: string;
    ma_can_bo?: string;
    role?: string;
    avatarUrl?: string;
    departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
    don_vi_chinh_id?: string | { _id: string; name: string; ten_phong_ban?: string };
  };
  nguoi_dung_id?: any;
  shiftId?: ShiftItem | string;
  ca_id?: ShiftItem | string;
  subjectId?: SubjectItem | string;
  mon_hoc_id?: SubjectItem | string;
  roomId: string;
  phong_hoc?: string;
  weekday: number;
  thu_trong_tuan?: number;
  startTime: string;
  gio_bat_dau?: string;
  endTime: string;
  gio_ket_thuc?: string;
  startPeriod?: number;
  tiet_bat_dau?: number;
  periodCount?: number;
  so_tiet?: number;
  isRecurring: boolean;
  lap_lai_hang_tuan?: boolean;
  startDate: string;
  ngay_bat_dau?: string;
  endDate: string;
  ngay_ket_thuc?: string;
  scheduleType?: ScheduleType;
  loai_lich?: ScheduleType;
  makeupDate?: string | null;
  ngay_day_bu?: string | null;
  weekNumbers?: number[];
  danh_sach_tuan?: number[];
  academicYear?: string;
  nam_hoc?: string;
  semester?: number;
  hoc_ky?: number;
  exceptions?: ScheduleExceptionItem[];
  ngoai_le?: ScheduleExceptionItem[];
  latitude?: number | null;
  vi_do?: number | null;
  longitude?: number | null;
  kinh_do?: number | null;
  radiusMeters?: number;
  ban_kinh_met?: number;
  createdAt?: string;
  tao_luc?: string;
  updatedAt?: string;
  cap_nhat_luc?: string;
}

export interface ScheduleQueryParams {
  userId?: string;
  shiftId?: string;
  weekday?: number | string;
  academicYear?: string;
  semester?: number | string;
  startDate?: string;
  endDate?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface CreateSchedulePayload {
  userId: string;
  shiftId?: string;
  subjectId?: string;
  roomId: string;
  weekday: number;
  startTime?: string;
  endTime?: string;
  startPeriod?: number;
  periodCount?: number;
  isRecurring?: boolean;
  startDate: string;
  endDate: string;
  scheduleType?: ScheduleType;
  makeupDate?: string;
  weekNumbers?: number[];
  academicYear?: string;
  semester?: number;
}
