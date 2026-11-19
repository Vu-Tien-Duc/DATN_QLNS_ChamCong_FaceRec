import { apiClient } from './apiClient';

export interface SystemConfigItem {
  id: string;
  khoa_cau_hinh: string;
  gia_tri: any;
  nhom?: string;
  mo_ta?: string | null;
  nguoi_cap_nhat_id?: {
    id: string;
    ho_ten?: string;
    email?: string;
    vai_tro_chinh?: string;
  } | string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
}

export interface UpdateConfigPayload {
  khoa_cau_hinh: string;
  gia_tri: any;
}

export interface BulkUpdateConfigsPayload {
  danh_sach_cau_hinh: Array<{ khoa_cau_hinh: string; gia_tri: any }>;
}

export const systemConfigApi = {
  /**
   * 1. Lấy toàn bộ danh sách cấu hình hệ thống (19 tham số)
   */
  async getConfigs(): Promise<SystemConfigItem[]> {
    const res = await apiClient.get<any>('/he-thong/cau-hinh');
    const raw = res.data?.data || res.data;
    return Array.isArray(raw) ? raw : raw?.configs || [];
  },

  /**
   * 2. Cập nhật một giá trị cấu hình đơn lẻ theo khóa
   */
  async updateConfig(khoa_cau_hinh: string, gia_tri: any): Promise<SystemConfigItem> {
    const res = await apiClient.put<any>('/he-thong/cau-hinh', { khoa_cau_hinh, gia_tri });
    return res.data?.data || res.data;
  },

  /**
   * 3. Cập nhật nhiều cấu hình hàng loạt
   */
  async bulkUpdateConfigs(danh_sach_cau_hinh: Array<{ khoa_cau_hinh: string; gia_tri: any }>): Promise<any> {
    const res = await apiClient.put<any>('/he-thong/cau-hinh', { danh_sach_cau_hinh });
    return res.data?.data || res.data;
  },
};
