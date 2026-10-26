import { apiClient } from './apiClient';

export interface AuditLogItem {
  _id: string;
  actor?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | string | null;
  actorType?: 'USER' | 'SYSTEM';
  action: string;
  targetId: string;
  targetType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'SUCCESS' | 'FAILED';
  timestamp: string;
  details?: any;
  previousHash?: string | null;
  currentHash?: string | null;
  createdAt?: string;
}

export interface AuditLogQueryParams {
  actor?: string;
  action?: string;
  targetType?: string;
  status?: string;
  keyword?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogPagination {
  page: number;
  limit: number;
  totalPages: number;
  totalDocs: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuditLogResponse {
  totalRecords: number;
  logs: AuditLogItem[];
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
    const res = await apiClient.get<any>('/audit-logs', { params });
    const raw = res.data?.data || res.data;
    return {
      totalRecords: raw?.totalRecords || (Array.isArray(raw?.logs) ? raw.logs.length : 0),
      logs: Array.isArray(raw?.logs) ? raw.logs : Array.isArray(raw) ? raw : [],
      pagination: raw?.pagination || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        totalPages: 1,
        totalDocs: raw?.totalRecords || 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  },

  /**
   * 2. Đối soát toàn vẹn chuỗi Hash (SHA-256 Hash Chaining)
   */
  async verifyIntegrity(limit: number = 1000): Promise<IntegrityCheckResponse> {
    const res = await apiClient.get<any>('/audit-logs/verify-integrity', {
      params: { limit },
    });
    return res.data?.data || res.data;
  },
};
