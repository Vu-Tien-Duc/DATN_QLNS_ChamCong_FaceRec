import { apiClient } from './apiClient';

export interface FaceDetectPoseResponse {
  success: boolean;
  detected: boolean;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: number[][];
  pose?: {
    yaw: number;
    pitch: number;
    roll: number;
    direction: string;
    is_frontal: boolean;
  };
  liveness?: {
    is_live: boolean;
    score: number;
    reasons?: string[];
  };
  message?: string;
}

export interface AttendancePunchResult {
  success: boolean;
  action: 'check_in' | 'check_out';
  message: string;
  user: {
    _id: string;
    fullName: string;
    staffCode?: string;
    role?: string;
    avatar?: string;
    department?: string;
  };
  similarity?: number;
  confidence?: number;
  livenessScore?: number;
  isFraud?: boolean;
  fraudReason?: string;
  record?: {
    _id: string;
    workDate: string;
    checkInTime?: string;
    checkOutTime?: string;
    status: 'on_time' | 'late' | 'early_leave' | 'absent';
    lateMinutes?: number;
    earlyExitMinutes?: number;
    shiftName?: string;
  };
}

export interface AttendancePunchLogItem {
  _id?: string;
  punchTime?: string;
  punchType: 'check_in' | 'check_out' | string;
  method?: string;
  confidenceScore?: number;
  livenessScore?: number;
  faceAngle?: string;
  isFraud?: boolean;
  fraudReason?: string;
  deviceId?: string;
  clientIp?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
  evidenceImage?: string;
}

export interface AttendanceHistoryItem {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    staffCode?: string;
    role?: string;
    departmentId?: {
      _id: string;
      name: string;
    };
  };
  shiftId?: {
    _id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
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
  workDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  workDurationMinutes?: number;
  lateMinutes?: number;
  earlyExitMinutes?: number;
  workHours?: number;
  actualTeachingPeriods?: number;
  isMissingCheckOut?: boolean;
  status: 'on_time' | 'late' | 'early_leave' | 'absent' | 'excused_absence' | string;
  method?: string;
  isManualOverride?: boolean;
  isFraud?: boolean;
  fraudReason?: string;
  capturedImage?: string;
  evidencePhoto?: string;
  punchLogIds?: AttendancePunchLogItem[];
  leaveRequestId?: {
    _id: string;
    leaveType?: string;
    reason?: string;
  };
}

export interface AttendanceHistoryParams {
  userId?: string;
  from?: string;
  to?: string;
  status?: string;
  method?: string;
  isFraud?: boolean;
  departmentId?: string;
  page?: number;
  limit?: number;
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
   * Gửi frame ảnh kiểm tra tư thế đầu (detect-pose)
   */
  async detectPose(imageBlob: Blob): Promise<FaceDetectPoseResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');

    const res = await apiClient.post<FaceDetectPoseResponse>('/khuon-mat/phat-hien-tu-the', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

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
   * Kiểm tra tình trạng sức khỏe microservice Python InsightFace
   */
  async getFaceHealth(): Promise<any> {
    const res = await apiClient.get('/khuon-mat/suc-khoe');
    return res.data;
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
   * Kiểm tra người dùng đã đăng ký FaceID hay chưa
   */
  async checkRegistrationStatus(userId?: string): Promise<{ isFaceRegistered: boolean }> {
    try {
      const url = userId ? `/khuon-mat/trang-thai-dang-ky/${userId}` : '/khuon-mat/trang-thai-dang-ky';
      const res = await apiClient.get(url);
      return { isFaceRegistered: res.data?.isFaceRegistered ?? res.data?.data?.isFaceRegistered ?? true };
    } catch {
      return { isFaceRegistered: true }; // Giả định true nếu server không yêu cầu bắt buộc
    }
  },

  /**
   * Lấy lịch sử chấm công chi tiết theo phân quyền và bộ lọc (from, to, status, method, isFraud, pagination)
   */
  async getAttendanceHistory(params?: AttendanceHistoryParams): Promise<AttendanceHistoryResult> {
    const query = new URLSearchParams();
    if (params?.userId) query.append('nguoi_dung_id', params.userId);
    if (params?.from) query.append('tu_ngay', params.from);
    if (params?.to) query.append('den_ngay', params.to);
    if (params?.status) query.append('trang_thai', params.status);
    if (params?.method) query.append('phuong_thuc', params.method);
    if (params?.isFraud !== undefined) query.append('co_gian_lan', String(params.isFraud));
    if (params?.departmentId) query.append('don_vi_id', params.departmentId);
    if (params?.page) query.append('trang', String(params.page));
    if (params?.limit) query.append('gioi_han', String(params.limit));

    const qs = query.toString();
    const url = `/cham-cong/lich-su${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<any>(url);
    const data = res.data?.data || res.data;
    const records = Array.isArray(data?.records) ? data.records : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {
      total: records.length,
      page: params?.page || 1,
      limit: params?.limit || 20,
      totalPages: Math.ceil(records.length / (params?.limit || 20)) || 1,
    };
    return { records, pagination };
  },

  /**
   * Tra cứu lịch sử chấm công của chính người dùng hiện tại (bảo đảm 100% chỉ tải dữ liệu của bản thân)
   */
  async getMyAttendanceHistory(params?: {
    from?: string;
    to?: string;
    status?: string;
    method?: string;
    page?: number;
    limit?: number;
  }): Promise<{ records: AttendanceHistoryItem[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.from) query.append('tu_ngay', params.from);
    if (params?.to) query.append('den_ngay', params.to);
    if (params?.status) query.append('trang_thai', params.status);
    if (params?.method) query.append('phuong_thuc', params.method);
    if (params?.page) query.append('trang', String(params.page));
    if (params?.limit) query.append('gioi_han', String(params.limit));

    const qs = query.toString();
    const url = `/cham-cong/lich-su-cua-toi${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<any>(url);
    const data = res.data?.data || res.data;
    const records = Array.isArray(data?.records) ? data.records : (Array.isArray(data) ? data : []);
    const pagination = data?.pagination || {
      total: records.length,
      page: params?.page || 1,
      limit: params?.limit || 20,
      totalPages: Math.ceil(records.length / (params?.limit || 20)) || 1,
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
    qrToken: string;
    location?: { lat: number; lng: number };
    deviceId?: string;
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
      status?: string;
      checkInTime?: string;
      checkOutTime?: string;
      note?: string;
      isFraud?: boolean;
      fraudReason?: string;
      leaveRequestId?: string;
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

  async getAttendanceEvidence(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/cham-cong/${id}/minh-chung`);
    return res.data?.data || res.data;
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
