import { ShiftItem } from './chamCong.types';

export type ScheduleType = 'chinh_khoa' | 'day_bu';
export type ScheduleExceptionStatus = 'nghi' | 'huy' | 'day_bu' | 'doi_ca';

export interface ScheduleExceptionItem {
  id?: string;
  ngay: string;
  ly_do?: string;
  trang_thai: ScheduleExceptionStatus;
  ngay_day_bu?: string | null;
  tao_luc?: string;
}

export interface SubjectItem {
  id: string;
  ten_mon: string;
  ma_mon: string;
  so_tin_chi?: number;
  phong_ban_id?: string | { id: string; ten_phong_ban: string };
  phong_ban?: { id: string; ten_phong_ban: string; loai_don_vi?: string; don_vi_cha_id?: string | null };
  mo_ta?: string;
  kich_hoat?: boolean;
}

export interface ScheduleLecturerRef {
  id: string;
  ho_ten: string;
  email: string;
  ma_can_bo?: string;
  vai_tro_chinh?: string;
  anh_dai_dien?: string | null;
  don_vi_chinh_id?: string | { id: string; ten_phong_ban: string } | null;
}

export interface ScheduleItem {
  id: string;
  nguoi_dung_id: ScheduleLecturerRef | string;
  giang_vien?: ScheduleLecturerRef;
  nguoi_dung?: ScheduleLecturerRef;
  ca_id?: ShiftItem | string;
  ca?: ShiftItem;
  mon_hoc_id?: SubjectItem | string;
  mon_hoc?: SubjectItem;
  phong_hoc: string;
  co_so?: string;
  thu_trong_tuan: number;
  gio_bat_dau: string;
  gio_ket_thuc: string;
  tiet_bat_dau?: number;
  so_tiet?: number;
  lap_lai_hang_tuan: boolean;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  loai_lich?: ScheduleType;
  ngay_day_bu?: string | null;
  danh_sach_tuan?: number[];
  nam_hoc?: string;
  hoc_ky?: number;
  la_truc_tuyen?: boolean;
  ngoai_le?: ScheduleExceptionItem[];
  vi_do?: number | null;
  kinh_do?: number | null;
  ban_kinh_met?: number;
  tao_luc?: string;
  cap_nhat_luc?: string;
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
  nguoi_dung_id: string;
  ca_id?: string;
  mon_hoc_id?: string;
  phong_hoc: string;
  thu_trong_tuan: number;
  gio_bat_dau?: string;
  gio_ket_thuc?: string;
  tiet_bat_dau?: number;
  so_tiet?: number;
  lap_lai_hang_tuan?: boolean;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  loai_lich?: ScheduleType;
  ngay_day_bu?: string;
  danh_sach_tuan?: number[];
  nam_hoc?: string;
  hoc_ky?: number;
}
