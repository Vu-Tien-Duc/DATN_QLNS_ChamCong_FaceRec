import { apiClient } from './apiClient';

export interface FaceDetectPoseResponse {
  face_detected: boolean;
  faceCount?: number;
  bbox?: number[] | null;
  landmarks?: number[][] | null;
  pose?: {
    pose?: string;
    pose_en?: string;
    pose_vi?: string;
    yaw_deg?: number;
    pitch_deg?: number;
    roll_deg?: number;
  } | null;
  liveness?: {
    is_live?: boolean;
    liveness_score?: number;
    score?: number;
    reasons?: string[];
  } | null;
  quality?: Record<string, any> | null;
  message?: string;
}

export interface AttendancePunchResult {
  success: boolean;
  action: 'check_in' | 'check_out';
  message: string;
  user: {
    id?: string;
    ho_ten?: string;
    ma_can_bo?: string;
    vai_tro_chinh?: string;
    anh_dai_dien?: string | null;
    /** @deprecated Dùng id */
    _id?: string;
    /** @deprecated Dùng ho_ten */
    fullName?: string;
    /** @deprecated Dùng ma_can_bo */
    staffCode?: string;
    /** @deprecated Dùng vai_tro_chinh */
    role?: string;
    /** @deprecated Dùng anh_dai_dien */
    avatar?: string;
    department?: string;
  };
  diem_tin_cay?: number;
  diem_nguoi_that?: number;
  co_gian_lan?: boolean;
  ly_do_gian_lan?: string | null;
  /** @deprecated Dùng diem_tin_cay */
  similarity?: number;
  confidence?: number;
  /** @deprecated Dùng diem_nguoi_that */
  livenessScore?: number;
  /** @deprecated Dùng co_gian_lan */
  isFraud?: boolean;
  /** @deprecated Dùng ly_do_gian_lan */
  fraudReason?: string;
  record?: {
    id?: string;
    ngay_cong?: string;
    thoi_gian_vao?: string;
    thoi_gian_ra?: string;
    trang_thai?: 'on_time' | 'late' | 'early_leave' | 'absent' | string;
    di_muon_phut?: number;
    ve_som_phut?: number;
    /** @deprecated Dùng id */
    _id?: string;
    /** @deprecated Dùng ngay_cong */
    workDate?: string;
    /** @deprecated Dùng thoi_gian_vao */
    checkInTime?: string;
    /** @deprecated Dùng thoi_gian_ra */
    checkOutTime?: string;
    /** @deprecated Dùng trang_thai */
    status?: 'on_time' | 'late' | 'early_leave' | 'absent';
    /** @deprecated Dùng di_muon_phut */
    lateMinutes?: number;
    /** @deprecated Dùng ve_som_phut */
    earlyExitMinutes?: number;
    shiftName?: string;
  };
}

export interface AttendancePunchLogItem {
  id?: string;
  thoi_gian_quet?: string;
  loai_quet?: 'check_in' | 'check_out' | 'unknown' | string;
  phuong_thuc?: string;
  do_tin_cay_ai?: number;
  diem_mat_that?: number;
  goc_mat_nhan_dien?: string;
  hop_le?: boolean;
  ly_do_khong_hop_le?: string;
  ma_thiet_bi?: string;
  vi_do?: number;
  kinh_do?: number;
  do_chinh_xac_gps?: number;
  vi_tri_gia_lap?: boolean;
  khoang_cach_met?: number;
  anh_minh_chung?: string;
  /** @deprecated Dùng id */
  _id?: string;
  /** @deprecated Dùng thoi_gian_quet */
  punchTime?: string;
  /** @deprecated Dùng loai_quet */
  punchType: 'check_in' | 'check_out' | string;
  /** @deprecated Dùng phuong_thuc */
  method?: string;
  /** @deprecated Dùng do_tin_cay_ai */
  confidenceScore?: number;
  /** @deprecated Dùng diem_mat_that */
  livenessScore?: number;
  /** @deprecated Dùng goc_mat_nhan_dien */
  faceAngle?: string;
  /** @deprecated Dùng goc_mat_nhan_dien */
  recognizedAngle?: string;
  /** @deprecated Dùng hop_le */
  isValid?: boolean;
  /** @deprecated Dùng ly_do_khong_hop_le */
  invalidReason?: string;
  /** @deprecated Dùng !hop_le */
  isFraud?: boolean;
  /** @deprecated Dùng ly_do_khong_hop_le */
  fraudReason?: string;
  /** @deprecated Dùng ma_thiet_bi */
  deviceId?: string;
  clientIp?: string;
  /** @deprecated Dùng vi_do */
  latitude?: number;
  /** @deprecated Dùng kinh_do */
  longitude?: number;
  location?: {
    lat?: number;
    lng?: number;
  };
  /** @deprecated Dùng anh_minh_chung */
  evidencePhoto?: string;
  /** @deprecated Dùng anh_minh_chung */
  evidenceImage?: string;
}

export interface AttendanceHistoryItem {
  id?: string;
  nguoi_dung_id?: string;
  ca_id?: string;
  lich_trinh_id?: string;
  ngay_cong?: string;
  thoi_gian_vao?: string;
  thoi_gian_ra?: string;
  thoi_luong_lam_viec_phut?: number;
  di_muon_phut?: number;
  ve_som_phut?: number;
  so_tiet_thuc_day?: number;
  trang_thai?: 'on_time' | 'late' | 'early_leave' | 'absent' | 'excused_absence' | string;
  phuong_thuc?: string;
  don_tu_id?: string;
  co_gian_lan?: boolean;
  ly_do_gian_lan?: string | null;
  ghi_de_thu_cong?: boolean;
  anh_minh_chung?: string;
  da_chot?: boolean;
  nguoi_ghi_de_id?: string | null;
  ly_do_ghi_de?: string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
  don_nghi_phep?: {
    id?: string;
    loai_don?: string;
    ngay_bat_dau?: string;
    ngay_ket_thuc?: string;
    trang_thai?: string;
    ly_do?: string;
  } | null;
  nguoi_dung?: {
    id?: string;
    ho_ten?: string;
    email?: string;
    anh_dai_dien?: string | null;
    ma_can_bo?: string;
    vai_tro_chinh?: string;
    don_vi_chinh_id?: string | null;
    don_vi_chinh?: {
      id?: string;
      ten_phong_ban?: string;
      loai_don_vi?: string;
    } | null;
  } | null;
  ca?: {
    id?: string;
    ten_ca?: string;
    gio_bat_dau?: string;
    gio_ket_thuc?: string;
    nguong_di_muon_phut?: number;
  } | null;
  lich_trinh?: {
    id?: string;
    phong_hoc?: string;
    thu_trong_tuan?: number;
    tiet_bat_dau?: number;
    so_tiet?: number;
    mon_hoc?: {
      id?: string;
      ten_mon?: string;
      ma_mon?: string;
    } | null;
  } | null;
  nguoi_ghi_de?: {
    id?: string;
    ho_ten?: string;
    ma_can_bo?: string;
  } | null;
  don_tu?: {
    id?: string;
    loai_don?: string;
    ngay_bat_dau?: string;
    ngay_ket_thuc?: string;
    trang_thai?: string;
  } | null;
  luot_quet?: AttendancePunchLogItem[];
  /** @deprecated Dùng id */
  _id: string;
  /** @deprecated Dùng nguoi_dung hoặc nguoi_dung_id */
  userId: {
    id?: string;
    _id: string;
    ho_ten?: string;
    fullName: string;
    email: string;
    anh_dai_dien?: string;
    avatar?: string;
    ma_can_bo?: string;
    staffCode?: string;
    vai_tro_chinh?: string;
    role?: string;
    don_vi_chinh_id?: string;
    departmentId?: {
      _id: string;
      name: string;
    };
  };
  /** @deprecated Dùng ca hoặc ca_id */
  shiftId?: {
    _id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  /** @deprecated Dùng lich_trinh hoặc lich_trinh_id */
  scheduleId?: {
    _id: string;
    roomId?: string;
    weekday?: number;
    subjectId?: {
      _id?: string;
      name?: string;
      code?: string;
    };
  };
  /** @deprecated Dùng ngay_cong */
  workDate: string;
  /** @deprecated Dùng thoi_gian_vao */
  checkInTime?: string;
  /** @deprecated Dùng thoi_gian_ra */
  checkOutTime?: string;
  /** @deprecated Dùng thoi_luong_lam_viec_phut */
  workDurationMinutes?: number;
  /** @deprecated Dùng di_muon_phut */
  lateMinutes?: number;
  /** @deprecated Dùng ve_som_phut */
  earlyExitMinutes?: number;
  workHours?: number;
  /** @deprecated Dùng so_tiet_thuc_day */
  actualTeachingPeriods?: number;
  isMissingCheckOut?: boolean;
  /** @deprecated Dùng trang_thai */
  status: 'on_time' | 'late' | 'early_leave' | 'absent' | 'excused_absence' | string;
  method?: string;
  isManualOverride?: boolean;
  /** @deprecated Dùng co_gian_lan */
  isFraud?: boolean;
  fraudReason?: string;
  capturedImage?: string;
  evidencePhoto?: string;
  punchLogIds?: AttendancePunchLogItem[];
  /** @deprecated Dùng don_tu_id */
  leaveRequestId?: {
    _id: string;
    leaveType?: string;
    reason?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceHistoryParams {
  nguoi_dung_id?: string;
  tu_ngay?: string;
  den_ngay?: string;
  trang_thai?: string;
  phuong_thuc?: string;
  co_gian_lan?: boolean;
  don_vi_id?: string;
  trang?: number;
  gioi_han?: number;
}

export interface AttendanceHistoryResult {
  records: AttendanceHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const attendanceApi = {
  /**
   * Thực hiện nhận diện khuôn mặt điểm danh (Chế độ tự động hoặc Check-in)
   */
  async checkInWithFace(
    imageBlob: Blob,
    options?: {
      actionType?: 'check_in' | 'check_out';
      verifyOnly?: boolean;
      useQueue?: boolean;
      location?: { lat: number; lng: number; accuracy?: number } | null;
      deviceId?: string;
    }
  ): Promise<AttendancePunchResult> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'attendance.jpg');
    formData.append('loai_thao_tac', options?.actionType || 'check_in');

    if (options?.location) {
      formData.append('vi_do', String(options.location.lat));
      formData.append('kinh_do', String(options.location.lng));
      if (options.location.accuracy) {
        formData.append('do_chinh_xac', String(options.location.accuracy));
      }
    }

    if (options?.deviceId) {
      formData.append('thiet_bi_id', options.deviceId);
    }

    if (options?.verifyOnly) {
      formData.append('xac_thuc_chi_xem', 'true');
    }

    const queryParams = new URLSearchParams();
    if (options?.useQueue) queryParams.append('bat_dong_bo', 'true');

    const url = `/khuon-mat/vao-ca${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const res = await apiClient.post<any>(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const payload = res.data?.data || res.data;
    if (res.data?.success !== undefined && payload.success === undefined) {
      payload.success = res.data.success;
    }
    if (res.data?.message && !payload.message) {
      payload.message = res.data.message;
    }
    return payload as AttendancePunchResult;
  },

  /**
   * Thực hiện Check-out tan ca bằng khuôn mặt
   */
  async checkOutWithFace(
    imageBlob: Blob,
    options?: {
      actionType?: 'check_in' | 'check_out';
      location?: { lat: number; lng: number; accuracy?: number } | null;
      deviceId?: string;
    }
  ): Promise<AttendancePunchResult> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'attendance.jpg');
    formData.append('loai_thao_tac', options?.actionType || 'check_out');

    if (options?.location) {
      formData.append('vi_do', String(options.location.lat));
      formData.append('kinh_do', String(options.location.lng));
    }
    if (options?.deviceId) {
      formData.append('thiet_bi_id', options.deviceId);
    }

    const res = await apiClient.post<any>('/khuon-mat/tan-ca', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const payload = res.data?.data || res.data;
    if (res.data?.success !== undefined && payload.success === undefined) {
      payload.success = res.data.success;
    }
    if (res.data?.message && !payload.message) {
      payload.message = res.data.message;
    }
    return payload as AttendancePunchResult;
  },

  /**
   * Lấy lịch sử các lượt chấm công gần nhất
   */
  async getRecentHistory(limit: number = 8): Promise<AttendanceHistoryItem[]> {
    try {
      const res = await apiClient.get<{
        success: boolean;
        data: AttendanceHistoryItem[] | { logs: AttendanceHistoryItem[] };
      }>(`/cham-cong/lich-su?gioi_han=${limit}`);

      const rawData = res.data?.data;
      if (Array.isArray(rawData)) {
        return rawData;
      }
      if (rawData && typeof rawData === 'object') {
        if (Array.isArray((rawData as any).records)) return (rawData as any).records;
        if (Array.isArray((rawData as any).logs)) return (rawData as any).logs;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Lấy lịch sử chấm công chi tiết theo phân quyền và bộ lọc (from, to, status, method, isFraud, pagination)
   */
  async getAttendanceHistory(params?: AttendanceHistoryParams): Promise<AttendanceHistoryResult> {
    const res = await apiClient.get<any>('/cham-cong/lich-su', { params });
    const data = res.data?.data || res.data;
    const records = Array.isArray(data?.records) ? data.records : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {
      total: records.length,
      page: params?.trang || 1,
      limit: params?.gioi_han || 20,
      totalPages: Math.ceil(records.length / (params?.gioi_han || 20)) || 1,
    };
    return { records, pagination };
  },

  /**
   * Tra cứu lịch sử chấm công của chính người dùng hiện tại (bảo đảm 100% chỉ tải dữ liệu của bản thân)
   */
  async getMyAttendanceHistory(params?: {
    tu_ngay?: string;
    den_ngay?: string;
    trang_thai?: string;
    phuong_thuc?: string;
    trang?: number;
    gioi_han?: number;
  }): Promise<{ records: AttendanceHistoryItem[]; pagination: any }> {
    const res = await apiClient.get<any>('/cham-cong/lich-su-cua-toi', { params });
    const data = res.data?.data || res.data;
    const records = Array.isArray(data?.records) ? data.records : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {
      total: records.length,
      page: params?.trang || 1,
      limit: params?.gioi_han || 20,
      totalPages: Math.ceil(records.length / (params?.gioi_han || 20)) || 1,
    };
    return { records, pagination };
  },

  /**
   * Xem chi tiết một bản ghi chấm công (kèm danh sách PunchLog lượt quét thô)
   */
  async getAttendanceById(id: string): Promise<AttendanceHistoryItem> {
    const res = await apiClient.get<any>(`/cham-cong/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Điểm danh Check-in qua Web/Thủ công (hỗ trợ kèm tọa độ GPS)
   */
  async manualCheckIn(payload?: {
    shiftId?: string;
    method?: string;
    deviceId?: string;
    location?: { lat: number; lng: number };
  }): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/vao-ca', payload || { phuong_thuc: 'manual' });
    return res.data?.data || res.data;
  },

  /**
   * Điểm danh Check-out qua Web/Thủ công (hỗ trợ kèm tọa độ GPS)
   */
  async manualCheckOut(payload?: {
    shiftId?: string;
    attendanceId?: string;
    method?: string;
    deviceId?: string;
    location?: { lat: number; lng: number };
  }): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/tan-ca', payload || { phuong_thuc: 'manual' });
    return res.data?.data || res.data;
  },

  /**
   * Điểm danh bằng cách quét mã QR TOTP động
   */
  async scanQRCode(payload: {
    ma_qr: string;
    toa_do?: { vi_do: number; kinh_do: number };
    thiet_bi_id?: string;
  }): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/qr/quet-ma', payload);
    return res.data?.data || res.data;
  },

  /**
   * Sinh mã QR động TOTP (hiệu lực 20s)
   */
  async generateQRCode(): Promise<any> {
    const res = await apiClient.get<any>('/cham-cong/qr/tao-ma');
    return res.data?.data || res.data;
  },

  /**
   * Lấy thử thách Liveness ngẫu nhiên (LOOK_UP / LOOK_DOWN / TURN_LEFT / TURN_RIGHT) kèm chữ ký HMAC hạn 120s
   */
  async getLivenessChallenge(): Promise<{ challenge: string; challengeToken: string; expiresInSeconds: number }> {
    const res = await apiClient.get<any>('/cham-cong/thu-thach-mat-that');
    return res.data?.data || res.data;
  },

  /**
   * Gửi ảnh thực hiện thử thách Liveness để máy chủ xác thực tư thế khuôn mặt
   */
  async verifyLivenessChallenge(
    imageBlob: Blob,
    challengeToken: string
  ): Promise<{ passed: boolean; detectedPose: string; expectedChallenge: string }> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'liveness.jpg');
    formData.append('challengeToken', challengeToken);
    const res = await apiClient.post<any>('/cham-cong/xac-thuc-mat-that', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data || res.data;
  },

  /**
   * Lấy cấu hình Geofence GPS khuôn viên trường (Campus Config)
   */
  async getCampusConfig(): Promise<any> {
    const res = await apiClient.get<any>('/cham-cong/cau-hinh-khuon-vien');
    return res.data?.data || res.data;
  },

  /**
   * Quản trị viên / Trưởng khoa hiệu chỉnh bản ghi chấm công (kèm ghi AuditLog)
   */
  async updateAttendance(
    id: string,
    payload: {
      trang_thai?: string;
      thoi_gian_vao?: string;
      thoi_gian_ra?: string;
      co_gian_lan?: boolean;
      ly_do_ghi_de?: string;
      don_tu_id?: string;
    }
  ): Promise<any> {
    const res = await apiClient.put<any>(`/cham-cong/${id}/dieu-chinh`, payload);
    return res.data?.data || res.data;
  },

  /**
   * [Admin] Kích hoạt tiến trình quét vắng mặt tự động theo ngày
   */
  async triggerAbsentCron(date?: string): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/quet-vang-mat', { ngay: date });
    return res.data?.data || res.data;
  },

  async getAttendanceEvidence(id: string): Promise<{ blob: Blob; url: string } | null> {
    const res = await apiClient.get<Blob>(`/cham-cong/${id}/minh-chung`, {
      responseType: 'blob',
    });
    const blob = res.data;
    if (!blob || blob.size === 0) return null;
    return { blob, url: URL.createObjectURL(blob) };
  },

  async getVectorIndexStats(): Promise<any> {
    const res = await apiClient.get<any>('/cham-cong/chi-so-vector/thong-ke');
    return res.data?.data || res.data;
  },

  async syncVectorIndex(): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/chi-so-vector/dong-bo');
    return res.data?.data || res.data;
  },

  async getQueueStats(): Promise<any> {
    const res = await apiClient.get<any>('/cham-cong/hang-doi/thong-ke');
    return res.data?.data || res.data;
  },

  async updateCampusConfig(payload: { vi_do: number; kinh_do: number; ban_kinh_met: number }): Promise<any> {
    const res = await apiClient.post<any>('/cham-cong/cau-hinh-khuon-vien', payload);
    return res.data?.data || res.data;
  },
};
