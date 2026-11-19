import { apiClient } from './apiClient';

export interface HolidayItem {
  id: string;
  ten_ngay_le: string;
  ngay_bat_dau: string; // YYYY-MM-DD
  ngay_ket_thuc: string; // YYYY-MM-DD
  nam: number;
  huong_luong: boolean;
  mo_ta?: string | null;
  nguoi_tao_id?: {
    id: string;
    ho_ten: string;
    email: string;
    vai_tro_chinh: string;
  } | string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
}

export interface CreateHolidayPayload {
  ten_ngay_le: string;
  ngay_bat_dau: string;
  ngay_ket_thuc: string;
  nam?: number;
  huong_luong?: boolean;
  mo_ta?: string;
}

export interface UpdateHolidayPayload {
  ten_ngay_le?: string;
  ngay_bat_dau?: string;
  ngay_ket_thuc?: string;
  nam?: number;
  huong_luong?: boolean;
  mo_ta?: string;
}

export const holidayApi = {
  /**
   * 1. Lấy danh sách ngày nghỉ lễ (hỗ trợ lọc theo năm)
   */
  async getHolidays(params?: { nam?: number | string }): Promise<HolidayItem[]> {
    const queryParams = params?.nam ? { nam: params.nam } : undefined;
    const res = await apiClient.get<any>('/ngay-nghi-le', { params: queryParams });
    const raw = res.data?.data || res.data;
    return Array.isArray(raw) ? raw : raw?.holidays || [];
  },

  /**
   * 2. Lấy chi tiết thông tin một ngày nghỉ lễ theo ID
   */
  async getHolidayById(id: string): Promise<HolidayItem> {
    const res = await apiClient.get<any>(`/ngay-nghi-le/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * 3. Thêm mới ngày nghỉ lễ (Admin & BGH)
   */
  async createHoliday(payload: CreateHolidayPayload): Promise<HolidayItem> {
    const res = await apiClient.post<any>('/ngay-nghi-le', payload);
    return res.data?.data || res.data;
  },

  /**
   * 4. Cập nhật ngày nghỉ lễ (Admin & BGH)
   */
  async updateHoliday(id: string, payload: UpdateHolidayPayload): Promise<HolidayItem> {
    const res = await apiClient.put<any>(`/ngay-nghi-le/${id}`, payload);
    return res.data?.data || res.data;
  },

  /**
   * 5. Xóa ngày nghỉ lễ (Admin & BGH)
   */
  async deleteHoliday(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/ngay-nghi-le/${id}`);
    return res.data?.data || res.data;
  },
};
