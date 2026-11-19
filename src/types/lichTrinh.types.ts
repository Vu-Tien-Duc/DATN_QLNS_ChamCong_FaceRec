import { ShiftItem } from './chamCong.types';

export type ScheduleType = 'chinh_khoa' | 'day_bu';
export type ScheduleExceptionStatus = 'nghi' | 'huy' | 'day_bu' | 'doi_ca';

export interface ScheduleExceptionItem {
  id?: string;
  ngay?: string;
  ly_do?: string;
  trang_thai?: ScheduleExceptionStatus;
  ngay_day_bu?: string;
  /** @deprecated Dùng id */
  _id?: string;
  /** @deprecated Dùng ngay */
  date?: string;
  /** @deprecated Dùng ly_do */
  reason?: string;
  /** @deprecated Dùng trang_thai */
  status?: ScheduleExceptionStatus;
  /** @deprecated Dùng ngay_day_bu */
  makeupDate?: string;
}

export interface SubjectItem {
  id?: string;
  ten_mon?: string;
  ma_mon?: string;
  so_tin_chi?: number;
  phong_ban_id?: string | { id?: string; _id?: string; ten_phong_ban?: string; name?: string };
  mo_ta?: string;
  kich_hoat?: boolean;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng ten_mon */
  name: string;
  /** @deprecated Dùng ma_mon */
  code: string;
  /** @deprecated Dùng so_tin_chi */
  credits?: number;
  /** @deprecated Dùng phong_ban_id */
  departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
  /** @deprecated Dùng mo_ta */
  description?: string;
  /** @deprecated Dùng kich_hoat */
  isActive?: boolean;
}

export interface ScheduleItem {
  id?: string;
  nguoi_dung_id?: any;
  ca_id?: ShiftItem | string;
  mon_hoc_id?: SubjectItem | string;
  phong_hoc?: string;
  thu_trong_tuan?: number;
  gio_bat_dau?: string;
  gio_ket_thuc?: string;
  tiet_bat_dau?: number;
  so_tiet?: number;
  lap_lai_hang_tuan?: boolean;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  loai_lich?: ScheduleType;
  ngay_day_bu?: string | null;
  danh_sach_tuan?: number[];
  nam_hoc?: string;
  hoc_ky?: number;
  ngoai_le?: ScheduleExceptionItem[];
  vi_do?: number | null;
  kinh_do?: number | null;
  ban_kinh_met?: number;
  tao_luc?: string;
  cap_nhat_luc?: string;
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng nguoi_dung_id */
  userId?: {
    id?: string;
    _id: string;
    ho_ten?: string;
    fullName: string;
    email: string;
    ma_can_bo?: string;
    staffCode?: string;
    vai_tro_chinh?: string;
    role?: string;
    anh_dai_dien?: string;
    avatarUrl?: string;
    don_vi_chinh_id?: string | { id?: string; _id?: string; ten_phong_ban?: string; name?: string };
    departmentId?: string | { _id: string; name: string; ten_phong_ban?: string };
  };
  /** @deprecated Dùng ca_id */
  shiftId?: ShiftItem | string;
  /** @deprecated Dùng mon_hoc_id */
  subjectId?: SubjectItem | string;
  /** @deprecated Dùng phong_hoc */
  roomId: string;
  /** @deprecated Dùng thu_trong_tuan */
  weekday: number;
  /** @deprecated Dùng gio_bat_dau */
  startTime: string;
  /** @deprecated Dùng gio_ket_thuc */
  endTime: string;
  /** @deprecated Dùng tiet_bat_dau */
  startPeriod?: number;
  /** @deprecated Dùng so_tiet */
  periodCount?: number;
  /** @deprecated Dùng lap_lai_hang_tuan */
  isRecurring: boolean;
  /** @deprecated Dùng ngay_bat_dau */
  startDate: string;
  /** @deprecated Dùng ngay_ket_thuc */
  endDate: string;
  /** @deprecated Dùng loai_lich */
  scheduleType?: ScheduleType;
  /** @deprecated Dùng ngay_day_bu */
  makeupDate?: string | null;
  /** @deprecated Dùng danh_sach_tuan */
  weekNumbers?: number[];
  /** @deprecated Dùng nam_hoc */
  academicYear?: string;
  /** @deprecated Dùng hoc_ky */
  semester?: number;
  /** @deprecated Dùng ngoai_le */
  exceptions?: ScheduleExceptionItem[];
  /** @deprecated Dùng vi_do */
  latitude?: number | null;
  /** @deprecated Dùng kinh_do */
  longitude?: number | null;
  /** @deprecated Dùng ban_kinh_met */
  radiusMeters?: number;
  /** @deprecated Dùng tao_luc */
  createdAt?: string;
  /** @deprecated Dùng cap_nhat_luc */
  updatedAt?: string;
}

export interface ScheduleQueryParams {
  nguoi_dung_id?: string;
  ca_id?: string;
  thu_trong_tuan?: number | string;
  nam_hoc?: string;
  hoc_ky?: number | string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  ngay?: string;
  trang?: number;
  gioi_han?: number;
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
