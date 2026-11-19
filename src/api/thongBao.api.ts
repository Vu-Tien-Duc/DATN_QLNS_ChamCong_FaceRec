import { apiClient, ApiResponse } from './apiClient';

export interface ThongBaoItem {
  id: string;
  loai: 'cham_cong' | 'don_tu' | 'lich_trinh' | 'he_thong' | string;
  tieu_de: string;
  noi_dung: string;
  trang_thai?: string;
  thoi_gian: string;
  duong_dan?: string;
}

export interface ThongBaoListResponse {
  tong_so: number;
  so_chua_doc: number;
  danh_sach_thong_bao: ThongBaoItem[];
}

export const thongBaoApi = {
  /**
   * Lấy danh sách thông báo của người dùng đang đăng nhập (GET /api/thong-bao)
   */
  async getNotifications(thoi_diem_doc_gan_nhat?: string): Promise<ThongBaoListResponse> {
    const res = await apiClient.get<ApiResponse<any>>('/thong-bao', {
      params: thoi_diem_doc_gan_nhat ? { thoi_diem_doc_gan_nhat } : undefined,
    });
    const raw = res.data?.data;
    const rawList = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.danh_sach_thong_bao)
      ? raw.danh_sach_thong_bao
      : [];

    const danh_sach_thong_bao: ThongBaoItem[] = rawList.map((item: any, idx: number) => ({
      id: String(item.id || `tb-${idx}`),
      loai: item.loai || 'he_thong',
      tieu_de: item.tieu_de || 'Thông báo hệ thống',
      noi_dung: item.noi_dung || '',
      trang_thai: item.trang_thai,
      thoi_gian: item.thoi_gian || '',
      duong_dan: item.duong_dan,
    }));

    return {
      tong_so: Number(raw?.tong_so ?? danh_sach_thong_bao.length),
      so_chua_doc: Number(raw?.so_chua_doc ?? danh_sach_thong_bao.length),
      danh_sach_thong_bao,
    };
  },
};
