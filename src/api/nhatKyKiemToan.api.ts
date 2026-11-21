import { apiClient } from './apiClient';

export interface AuditLogItem {
  id: string;
  nguoi_thuc_hien?: {
    id: string;
    ho_ten: string;
    ma_can_bo?: string;
    email: string;
    vai_tro_chinh: string;
    anh_dai_dien?: string | null;
  } | null;
  nguoi_thuc_hien_id?: string | null;
  loai_chu_the?: 'user' | 'system' | string;
  hanh_dong: string;
  doi_tuong_id: string;
  loai_doi_tuong: string;
  dia_chi_ip?: string | null;
  thong_tin_trinh_duyet?: string | null;
  ket_qua: 'success' | 'failed';
  ly_do_that_bai?: string | null;
  thoi_diem: string;
  chi_tiet?: any;
  ma_bam_truoc?: string | null;
  ma_bam_hien_tai?: string | null;
  tao_luc?: string;
}

export interface AuditLogQueryParams {
  nguoi_thuc_hien_id?: string;
  hanh_dong?: string;
  loai_doi_tuong?: string;
  ket_qua?: 'success' | 'failed';
  tim_kiem?: string;
  tu_ngay?: string;
  den_ngay?: string;
  trang?: number;
  gioi_han?: number;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  totalPages: number;
  totalDocs: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuditLogSummary {
  totalRecords: number;
  successCount: number;
  failedCount: number;
}

export interface AuditLogResponse {
  totalRecords: number;
  logs: AuditLogItem[];
  summary?: AuditLogSummary;
  pagination: AuditLogPagination;
}

export interface TamperedLogInfo {
  id: string;
  action: string;
  timestamp: string;
  storedHash?: string;
  expectedHash?: string;
  reason?: string;
}

export interface IntegrityCheckResponse {
  isValid: boolean;
  totalChecked: number;
  validCount: number;
  tamperedCount: number;
  brokenChainCount: number;
  tamperedLogs: TamperedLogInfo[];
  genesisHash: string;
  latestHash?: string;
  checkedAt: string;
}

export const auditLogApi = {
  /**
   * 1. Truy vấn danh sách nhật ký kiểm toán với bộ lọc và phân trang
   */
  async getAuditLogs(params?: AuditLogQueryParams): Promise<AuditLogResponse> {
    const res = await apiClient.get<any>('/nhat-ky-kiem-toan', { params });
    const raw = res.data?.data || res.data;
    const rawLogs = Array.isArray(raw?.logs) ? raw.logs : Array.isArray(raw) ? raw : [];
    return {
      totalRecords: raw?.totalRecords ?? rawLogs.length,
      logs: rawLogs,
      summary: raw?.summary,
      pagination: raw?.pagination || {
        page: params?.trang || 1,
        limit: params?.gioi_han || 20,
        totalPages: 1,
        totalDocs: raw?.totalRecords ?? rawLogs.length,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  },

  /**
   * 2. Đối soát toàn vẹn chuỗi Hash (SHA-256 Hash Chaining)
   */
  async verifyIntegrity(limit: number = 1000): Promise<IntegrityCheckResponse> {
    const res = await apiClient.get<any>('/nhat-ky-kiem-toan/xac-minh-toan-ven', {
      params: { gioi_han: limit },
    });
    const raw = res.data?.data || res.data || {};
    const isValid = Boolean(raw.isValid ?? raw.hopLe);
    const totalChecked = Number(raw.totalChecked ?? raw.checkedCount ?? 0);
    const tamperedCount = Number(raw.tamperedCount ?? (isValid ? 0 : raw.loiTaiId ? 1 : 0));
    const validCount = Number(raw.validCount ?? Math.max(0, totalChecked - tamperedCount));
    const brokenChainCount = Number(raw.brokenChainCount ?? (isValid ? 0 : raw.loiTaiId ? 1 : 0));
    const tamperedLogs: TamperedLogInfo[] = Array.isArray(raw.tamperedLogs)
      ? raw.tamperedLogs
      : raw.loiTaiId
      ? [
          {
            id: String(raw.loiTaiId),
            action: 'HASH_MISMATCH',
            timestamp: new Date().toISOString(),
            reason: 'Chuỗi băm SHA-256 không khớp hoặc dữ liệu nhật ký đã bị thay đổi',
          },
        ]
      : [];

    return {
      isValid,
      totalChecked,
      validCount,
      tamperedCount,
      brokenChainCount,
      tamperedLogs,
      genesisHash: raw.genesisHash || 'SHA-256 Chain',
      latestHash: raw.latestHash,
      checkedAt: raw.checkedAt || new Date().toISOString(),
    };
  },
};
