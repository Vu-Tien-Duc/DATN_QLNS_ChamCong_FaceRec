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

export const holidayApi = {
  /**
   * 1. Lấy danh sách ngày nghỉ lễ (hỗ trợ lọc theo năm)
   */
  async getHolidays(params?: { year?: number | string }): Promise<HolidayItem[]> {
    const res = await apiClient.get<any>('/holidays', { params });
    const raw = res.data?.data || res.data;
    return Array.isArray(raw) ? raw : raw?.holidays || [];
  },

  /**
   * 2. Lấy chi tiết thông tin một ngày nghỉ lễ theo ID
   */
  async getHolidayById(id: string): Promise<HolidayItem> {
    const res = await apiClient.get<any>(`/holidays/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * 3. Thêm mới ngày nghỉ lễ (Admin & BGH)
   */
  async createHoliday(payload: CreateHolidayPayload): Promise<HolidayItem> {
    const res = await apiClient.post<any>('/holidays', payload);
    return res.data?.data || res.data;
  },

  /**
   * 4. Cập nhật ngày nghỉ lễ (Admin & BGH)
   */
  async updateHoliday(id: string, payload: UpdateHolidayPayload): Promise<HolidayItem> {
    const res = await apiClient.put<any>(`/holidays/${id}`, payload);
    return res.data?.data || res.data;
  },

  /**
   * 5. Xóa ngày nghỉ lễ (Admin & BGH)
   */
  async deleteHoliday(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/holidays/${id}`);
    return res.data?.data || res.data;
  },
};
