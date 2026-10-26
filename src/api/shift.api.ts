import { apiClient } from './apiClient';

export interface ShiftItem {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes?: number;
  isActive?: boolean;
}

export interface UpdateShiftPayload {
  name?: string;
  startTime?: string;
  endTime?: string;
  lateThresholdMinutes?: number;
  isActive?: boolean;
}

export const shiftApi = {
  /**
   * 1. Lấy danh sách cấu hình toàn bộ ca làm việc (Shift Configs)
   */
  async getShifts(): Promise<ShiftItem[]> {
    const res = await apiClient.get<any>('/shifts');
    const raw = res.data?.data || res.data;
    return Array.isArray(raw) ? raw : raw?.shifts || [];
  },

  /**
   * 2. Lấy chi tiết thông tin một ca làm việc theo ID
   */
  async getShiftById(id: string): Promise<ShiftItem> {
    const res = await apiClient.get<any>(`/shifts/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * 3. Thêm mới ca làm việc (Chỉ Admin & BGH)
   */
  async createShift(payload: CreateShiftPayload): Promise<ShiftItem> {
    const res = await apiClient.post<any>('/shifts', payload);
    return res.data?.data || res.data;
  },

  /**
   * 4. Cập nhật thông tin ca làm việc (Chỉ Admin & BGH)
   */
  async updateShift(id: string, payload: UpdateShiftPayload): Promise<ShiftItem> {
    const res = await apiClient.put<any>(`/shifts/${id}`, payload);
    return res.data?.data || res.data;
  },

  /**
   * 5. Xóa ca làm việc (Chặn nếu có lịch đang sử dụng)
   */
  async deleteShift(id: string): Promise<any> {
    const res = await apiClient.delete<any>(`/shifts/${id}`);
    return res.data?.data || res.data;
  },
};
