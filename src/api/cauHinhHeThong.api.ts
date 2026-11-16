import { apiClient } from './apiClient';

export interface SystemConfigItem {
  _id: string;
  key?: string;
  value?: any;
  group?: string;
  description?: string | null;
  khoa_cau_hinh?: string;
  gia_tri?: any;
  nhom?: string;
  mo_ta?: string | null;
  updatedBy?: {
    _id: string;
    fullName?: string;
    ho_ten?: string;
    email?: string;
    role?: string;
  } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateConfigPayload {
  key?: string;
  khoa?: string;
  value?: any;
  gia_tri?: any;
}

export interface BulkUpdateConfigsPayload {
  configs: Array<{ key?: string; khoa?: string; value?: any; gia_tri?: any }>;
}

export const systemConfigApi = {
  /**
   * 1. Lấy toàn bộ danh sách cấu hình hệ thống (19 tham số)
   */
  async getConfigs(): Promise<SystemConfigItem[]> {
    const res = await apiClient.get<any>('/he-thong/cau-hinh');
    const raw = res.data?.data || res.data;
    const list = Array.isArray(raw) ? raw : raw?.configs || [];
    return list.map((c: any) => ({
      ...c,
      key: c.key || c.khoa_cau_hinh,
      value: c.value !== undefined ? c.value : c.gia_tri,
      group: c.group || c.nhom,
      description: c.description !== undefined ? c.description : c.mo_ta,
    }));
  },

  /**
   * 2. Cập nhật một giá trị cấu hình đơn lẻ theo khóa
   */
  async updateConfig(key: string, value: any): Promise<SystemConfigItem> {
    const res = await apiClient.put<any>('/he-thong/cau-hinh', { khoa_cau_hinh: key, gia_tri: value });
    const raw = res.data?.data || res.data;
    return {
      ...raw,
      key: raw.key || raw.khoa_cau_hinh,
      value: raw.value !== undefined ? raw.value : raw.gia_tri,
      group: raw.group || raw.nhom,
      description: raw.description !== undefined ? raw.description : raw.mo_ta,
    };
  },

  /**
   * 3. Cập nhật nhiều cấu hình hàng loạt
   */
  async bulkUpdateConfigs(configs: Array<{ key: string; value: any }>): Promise<any> {
    const res = await apiClient.put<any>('/he-thong/cau-hinh', {
      danh_sach_cau_hinh: configs.map((c) => ({ khoa_cau_hinh: c.key, gia_tri: c.value })),
    });
    return res.data?.data || res.data;
  },
};
