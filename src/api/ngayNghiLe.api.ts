import { apiClient } from './apiClient';

export interface HolidayItem {
  _id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  year: number;
  isPaid: boolean;
  description?: string | null;
  createdBy?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateHolidayPayload {
  name: string;
  startDate: string;
  endDate: string;
  year?: number;
  isPaid?: boolean;
  description?: string;
}

export interface UpdateHolidayPayload {
  name?: string;
  startDate?: string;
  endDate?: string;
  year?: number;
  isPaid?: boolean;
  description?: string;
}

const mapHolidayFields = (h: any): HolidayItem => {
  if (!h || typeof h !== 'object') return h;
  const start = h.startDate || h.ngay_bat_dau || '';
  const end = h.endDate || h.ngay_ket_thuc || '';
  const parsedYear = h.year || h.nam || (start ? parseInt(start.slice(0, 4), 10) : new Date().getFullYear());

  return {
    ...h,
    _id: h._id,
    name: h.name || h.ten_ngay_le || '',
    startDate: start,
    endDate: end,
    year: parsedYear,
    isPaid: h.isPaid !== undefined ? h.isPaid : (h.huong_luong !== undefined ? h.huong_luong : true),
    description: h.description !== undefined ? h.description : (h.mo_ta !== undefined ? h.mo_ta : ''),
    createdBy: h.createdBy || h.nguoi_tao_id || null,
  };
};

export const holidayApi = {
  /**
   * 1. Lấy danh sách ngày nghỉ lễ (hỗ trợ lọc theo năm)
   */
  async getHolidays(params?: { year?: number | string }): Promise<HolidayItem[]> {
    const queryParams = params?.year ? { nam: params.year } : undefined;
    const res = await apiClient.get<any>('/ngay-nghi-le', { params: queryParams });
    const raw = res.data?.data || res.data;
    const list = Array.isArray(raw) ? raw : raw?.holidays || [];
    return list.map(mapHolidayFields);
  },

  /**
   * 2. Lấy chi tiết thông tin một ngày nghỉ lễ theo ID
   */
  async getHolidayById(id: string): Promise<HolidayItem> {
    const res = await apiClient.get<any>(`/ngay-nghi-le/${id}`);
    const raw = res.data?.data || res.data;
    return mapHolidayFields(raw);
  },

  /**
   * 3. Thêm mới ngày nghỉ lễ (Admin & BGH)
   */
  async createHoliday(payload: CreateHolidayPayload): Promise<HolidayItem> {
    const body = {
      ten_ngay_le: payload.name ?? (payload as any).ten_ngay_le,
      ngay_bat_dau: payload.startDate ?? (payload as any).ngay_bat_dau,
      ngay_ket_thuc: payload.endDate ?? (payload as any).ngay_ket_thuc,
      huong_luong: payload.isPaid !== undefined ? payload.isPaid : (payload as any).huong_luong,
      mo_ta: payload.description ?? (payload as any).mo_ta,
      nam: payload.year ?? (payload as any).nam,
    };
    const res = await apiClient.post<any>('/ngay-nghi-le', body);
    const raw = res.data?.data || res.data;
    return mapHolidayFields(raw);
  },

  /**
   * 4. Cập nhật ngày nghỉ lễ (Admin & BGH)
   */
  async updateHoliday(id: string, payload: UpdateHolidayPayload): Promise<HolidayItem> {
    const body = {
      ten_ngay_le: payload.name ?? (payload as any).ten_ngay_le,
      ngay_bat_dau: payload.startDate ?? (payload as any).ngay_bat_dau,
      ngay_ket_thuc: payload.endDate ?? (payload as any).ngay_ket_thuc,
      huong_luong: payload.isPaid !== undefined ? payload.isPaid : (payload as any).huong_luong,
      mo_ta: payload.description ?? (payload as any).mo_ta,
      nam: payload.year ?? (payload as any).nam,
    };
    const res = await apiClient.put<any>(`/ngay-nghi-le/${id}`, body);
    const raw = res.data?.data || res.data;
    return mapHolidayFields(raw);
  },

  /**
   * 5. Xóa ngày nghỉ lễ (Admin & BGH)
   */
  async deleteHoliday(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/ngay-nghi-le/${id}`);
    return res.data?.data || res.data;
  },
};
