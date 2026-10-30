import { apiClient, ApiResponse, extractArray } from './apiClient';
import {
  ScheduleItem,
  ScheduleQueryParams,
  CreateSchedulePayload,
  ShiftItem,
  SubjectItem,
  UserProfile,
} from '../types';

export interface ScheduleListResponse {
  schedules: ScheduleItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const scheduleApi = {
  /**
   * Lấy danh sách lịch trình / thời khóa biểu
   */
  getSchedules: async (params?: ScheduleQueryParams): Promise<ApiResponse<ScheduleListResponse>> => {
    const res = await apiClient.get<any>('/schedules', {
      params,
    });
    const raw = res.data?.data ?? res.data;
    if (raw && typeof raw === 'object' && Array.isArray(raw.schedules)) {
      return res.data;
    }
    const list = extractArray<ScheduleItem>(raw);
    return {
      ...res.data,
      data: {
        schedules: list,
        pagination: raw?.pagination || { total: list.length, page: 1, limit: list.length || 20, totalPages: 1 },
      },
    };
  },

  /**
   * Lấy lịch làm việc / giảng dạy hôm nay
   */
  getTodaySchedules: async (params?: { date?: string; userId?: string }): Promise<ApiResponse<ScheduleItem[]>> => {
    const res = await apiClient.get<any>('/schedules/today', {
      params,
    });
    const list = extractArray<ScheduleItem>(res.data?.data ?? res.data);
    return { ...res.data, data: list };
  },

  /**
   * Lấy chi tiết lịch giảng dạy theo ID
   */
  getScheduleById: async (id: string): Promise<ApiResponse<ScheduleItem>> => {
    const res = await apiClient.get<ApiResponse<ScheduleItem>>(`/schedules/${id}`);
    return res.data;
  },

  /**
   * Tạo mới lịch phân công giảng dạy / công tác (Admin / Trưởng khoa)
   */
  createSchedule: async (payload: CreateSchedulePayload): Promise<ApiResponse<ScheduleItem>> => {
    const res = await apiClient.post<ApiResponse<ScheduleItem>>('/schedules', payload);
    return res.data;
  },

  /**
   * Cập nhật lịch giảng dạy
   */
  updateSchedule: async (
    id: string,
    payload: Partial<CreateSchedulePayload>
  ): Promise<ApiResponse<ScheduleItem>> => {
    const res = await apiClient.put<ApiResponse<ScheduleItem>>(`/schedules/${id}`, payload);
    return res.data;
  },

  /**
   * Xóa lịch giảng dạy
   */
  deleteSchedule: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await apiClient.delete<ApiResponse<{ message: string }>>(`/schedules/${id}`);
    return res.data;
  },

  /**
   * Ghi nhận ngoại lệ buổi học (Nghỉ, Hủy, Dạy bù)
   */
  addException: async (
    id: string,
    payload: {
      date: string;
      reason?: string;
      status?: 'nghi' | 'huy' | 'day_bu';
      makeupDate?: string;
    }
  ): Promise<ApiResponse<ScheduleItem>> => {
    const res = await apiClient.post<ApiResponse<ScheduleItem>>(`/schedules/${id}/exceptions`, payload);
    return res.data;
  },

  /**
   * Lấy danh sách ca làm việc phục vụ chọn ca
   */
  getShifts: async (): Promise<ApiResponse<ShiftItem[]>> => {
    const res = await apiClient.get<any>('/shifts');
    const list = extractArray<ShiftItem>(res.data?.data ?? res.data);
    return { ...res.data, data: list };
  },

  /**
   * Lấy danh mục môn học
   */
  getSubjects: async (): Promise<ApiResponse<SubjectItem[]>> => {
    const res = await apiClient.get<any>('/subjects');
    const list = extractArray<SubjectItem>(res.data?.data ?? res.data);
    return { ...res.data, data: list };
  },

  /**
   * Lấy danh sách cán bộ / giảng viên
   */
  getUsers: async (params?: { role?: string; limit?: number }): Promise<ApiResponse<UserProfile[]>> => {
    const res = await apiClient.get<any>('/users', { params });
    const list = extractArray<UserProfile>(res.data?.data ?? res.data);
    return { ...res.data, data: list };
  },
};
