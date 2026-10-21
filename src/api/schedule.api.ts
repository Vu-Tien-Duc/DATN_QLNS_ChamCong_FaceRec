import { apiClient, ApiResponse } from './apiClient';
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
  getSchedules: async (params?: ScheduleQueryParams): Promise<ApiResponse<ScheduleListResponse | ScheduleItem[]>> => {
    const res = await apiClient.get<ApiResponse<ScheduleListResponse | ScheduleItem[]>>('/schedules', {
      params,
    });
    return res.data;
  },

  /**
   * Lấy lịch làm việc / giảng dạy hôm nay
   */
  getTodaySchedules: async (params?: { date?: string; userId?: string }): Promise<ApiResponse<ScheduleItem[]>> => {
    const res = await apiClient.get<ApiResponse<ScheduleItem[]>>('/schedules/today', {
      params,
    });
    return res.data;
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
      status?: 'NGHI' | 'HUY' | 'DAY_BU';
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
    const res = await apiClient.get<ApiResponse<ShiftItem[]>>('/shifts');
    return res.data;
  },

  /**
   * Lấy danh mục môn học
   */
  getSubjects: async (): Promise<ApiResponse<SubjectItem[]>> => {
    const res = await apiClient.get<ApiResponse<SubjectItem[]>>('/subjects');
    return res.data;
  },

  /**
   * Lấy danh sách cán bộ / giảng viên
   */
  getUsers: async (params?: { role?: string; limit?: number }): Promise<ApiResponse<UserProfile[]>> => {
    const res = await apiClient.get<ApiResponse<UserProfile[]>>('/users', { params });
    return res.data;
  },
};
