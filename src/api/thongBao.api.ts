import { apiClient, ApiResponse } from './apiClient';

export interface ThongBaoItem {
  id: string;
  loai: 'cham_cong' | 'don_nghi_phep' | 'lich_trinh' | 'he_thong' | string;
  tieu_de: string;
  noi_dung: string;
  thoi_diem: string;
  da_doc?: boolean;
  duong_dan?: string;
}

export const thongBaoApi = {
  /**
   * Lấy danh sách thông báo của người dùng đang đăng nhập (GET /api/thong-bao)
   */
  async getNotifications(thoi_diem_doc_gan_nhat?: string): Promise<ThongBaoItem[]> {
    const res = await apiClient.get<ApiResponse<ThongBaoItem[]>>('/thong-bao', {
      params: thoi_diem_doc_gan_nhat ? { thoi_diem_doc_gan_nhat } : undefined,
    });
    const data = res.data?.data;
    return Array.isArray(data) ? data : [];
  },
};
