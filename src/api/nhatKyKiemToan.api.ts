import { apiClient } from './apiClient';

export interface AuditLogItem {
  _id: string;
  actor?: {
    _id: string;
    fullName: string;
    email: string;
    role: string;
  } | string | null;
  actorType?: 'user' | 'system';
  action: string;
  targetId: string;
  targetType: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status: 'success' | 'failed';
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

export const mapAuditLogItem = (item: any): AuditLogItem => {
  if (!item || typeof item !== 'object') return item;
  const actorRaw = item.actor || item.nguoi_thuc_hien_id;
  let actorObj: any = null;

  if (actorRaw && typeof actorRaw === 'object') {
    actorObj = {
      _id: actorRaw._id || '',
      fullName: actorRaw.fullName || actorRaw.ho_ten || 'Quản trị viên Hệ thống',
      ho_ten: actorRaw.ho_ten || actorRaw.fullName || 'Quản trị viên Hệ thống',
      email: actorRaw.email || '',
      role: actorRaw.role || actorRaw.vai_tro_chinh || 'admin',
      vai_tro_chinh: actorRaw.vai_tro_chinh || actorRaw.role || 'admin',
    };
  } else if (typeof actorRaw === 'string') {
    actorObj = actorRaw;
  }

  const rawStatus = (item.status || item.ket_qua || 'success').toString().toLowerCase();
  const normalizedStatus = rawStatus === 'success' || rawStatus === 'thanh_cong' ? 'success' : 'failed';
  const rawTimestamp = item.timestamp || item.thoi_diem || item.tao_luc || item.createdAt || new Date().toISOString();

  return {
    ...item,
    _id: item._id,
    actor: actorObj,
    actorType: item.actorType || item.loai_chu_the || (actorObj ? 'user' : 'system'),
    action: item.action || item.hanh_dong || 'THAO TÁC',
    targetId: item.targetId || item.doi_tuong_id || '',
    targetType: item.targetType || item.loai_doi_tuong || 'he_thong',
    ipAddress: item.ipAddress || item.dia_chi_ip || '127.0.0.1',
    userAgent: item.userAgent !== undefined ? item.userAgent : item.thong_tin_trinh_duyet,
    status: normalizedStatus,
    timestamp: rawTimestamp,
    details: item.details !== undefined ? item.details : item.chi_tiet,
    previousHash: item.previousHash || item.ma_bam_truoc || null,
    currentHash: item.currentHash || item.ma_bam_hien_tai || null,
  };
};

export const auditLogApi = {
  /**
   * 1. Truy vấn danh sách nhật ký kiểm toán với bộ lọc và phân trang
   */
  async getAuditLogs(params?: AuditLogQueryParams): Promise<AuditLogResponse> {
    const mappedParams = params
      ? {
          nguoi_thuc_hien_id: params.actor,
          hanh_dong: params.action,
          loai_doi_tuong: params.targetType,
          ket_qua: params.status,
          tim_kiem: params.keyword || params.search,
          tu_ngay: params.startDate,
          den_ngay: params.endDate,
          trang: params.page,
          gioi_han: params.limit,
        }
      : undefined;
    const res = await apiClient.get<any>('/nhat-ky-kiem-toan', { params: mappedParams });
    const raw = res.data?.data || res.data;
    const rawLogs = Array.isArray(raw?.logs) ? raw.logs : Array.isArray(raw) ? raw : [];
    return {
      totalRecords: raw?.totalRecords || rawLogs.length,
      logs: rawLogs.map(mapAuditLogItem),
      pagination: raw?.pagination || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        totalPages: 1,
        totalDocs: raw?.totalRecords || rawLogs.length,
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
    return res.data?.data || res.data;
  },
};
