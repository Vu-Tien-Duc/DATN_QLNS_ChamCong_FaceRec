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
  action: 'CHECK_IN' | 'CHECK_OUT';
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
    status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT';
    lateMinutes?: number;
    earlyExitMinutes?: number;
    shiftName?: string;
  };
}

export interface AttendanceHistoryItem {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    staffCode?: string;
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
  workDate: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' | 'EXCUSED_ABSENCE';
  lateMinutes?: number;
  earlyExitMinutes?: number;
  isEarlyLeave?: boolean;
  method?: string;
  capturedImage?: string;
}

export const attendanceApi = {
  /**
   * Gửi frame ảnh kiểm tra tư thế đầu (detect-pose)
   */
  async detectPose(imageBlob: Blob): Promise<FaceDetectPoseResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');

    const res = await apiClient.post<FaceDetectPoseResponse>('/face/detect-pose', formData, {
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
      verifyOnly?: boolean;
      useQueue?: boolean;
      location?: { lat: number; lng: number; accuracy?: number } | null;
      deviceId?: string;
    }
  ): Promise<AttendancePunchResult> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'attendance.jpg');

    if (options?.location) {
      formData.append('latitude', String(options.location.lat));
      formData.append('longitude', String(options.location.lng));
      if (options.location.accuracy) {
        formData.append('accuracy', String(options.location.accuracy));
      }
    }

    if (options?.deviceId) {
      formData.append('deviceId', options.deviceId);
    }

    if (options?.verifyOnly) {
      formData.append('verifyOnly', 'true');
    }

    const queryParams = new URLSearchParams();
    if (options?.useQueue) queryParams.append('async', 'true');

    const url = `/face/checkin${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
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
      location?: { lat: number; lng: number; accuracy?: number } | null;
      deviceId?: string;
    }
  ): Promise<AttendancePunchResult> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'attendance.jpg');

    if (options?.location) {
      formData.append('latitude', String(options.location.lat));
      formData.append('longitude', String(options.location.lng));
    }
    if (options?.deviceId) {
      formData.append('deviceId', options.deviceId);
    }

    const res = await apiClient.post<any>('/face/checkout', formData, {
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
    const res = await apiClient.get('/face/health');
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
      }>(`/attendance/history?limit=${limit}`);

      if (Array.isArray(res.data?.data)) {
        return res.data.data;
      }
      if (res.data?.data && Array.isArray((res.data.data as any).logs)) {
        return (res.data.data as any).logs;
      }
      return [];
    } catch {
      return [];
    }
  },

  /**
   * Kiểm tra người dùng đã đăng ký FaceID hay chưa
   */
  async checkRegistrationStatus(userId?: string): Promise<{ isRegistered: boolean }> {
    try {
      const url = userId ? `/face/registration-status/${userId}` : '/face/registration-status';
      const res = await apiClient.get(url);
      return { isRegistered: res.data?.isRegistered ?? res.data?.data?.isRegistered ?? true };
    } catch {
      return { isRegistered: true }; // Giả định true nếu server không yêu cầu bắt buộc
    }
  },
};
