import { apiClient } from './apiClient';

export interface SystemConfigItem {
  _id: string;
  key: string;
  value: any;
  group: string;
  description?: string | null;
  updatedBy?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateConfigPayload {
  key: string;
  value: any;
}

export interface BulkUpdateConfigsPayload {
  configs: Array<{ key: string; value: any }>;
}

export const systemConfigApi = {
  /**
   * 1. Lấy toàn bộ danh sách cấu hình hệ thống (19 tham số)
   */
  async getConfigs(): Promise<SystemConfigItem[]> {
    const res = await apiClient.get<any>('/system/configs');
    const raw = res.data?.data || res.data;
    return Array.isArray(raw) ? raw : raw?.configs || [];
  },

  /**
   * 2. Cập nhật một giá trị cấu hình đơn lẻ theo khóa
   */
  async updateConfig(key: string, value: any): Promise<SystemConfigItem> {
    const res = await apiClient.put<any>('/system/configs', { key, value });
    return res.data?.data || res.data;
  },

  /**
   * 3. Cập nhật nhiều cấu hình hàng loạt
   */
  async bulkUpdateConfigs(configs: Array<{ key: string; value: any }>): Promise<any> {
    const res = await apiClient.put<any>('/system/configs', { configs });
    return res.data?.data || res.data;
  },
};
