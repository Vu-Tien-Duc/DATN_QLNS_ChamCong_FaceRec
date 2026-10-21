/**
 * Face Biometrics API Client (src/api/face.api.ts)
 * Kết nối các API sinh trắc học khuôn mặt chuẩn CSDL v2.5 & Nghị định 13/2023/NĐ-CP:
 * - detectPose: Phát hiện tư thế đầu 3D (Euler Yaw, Pitch, Roll) realtime.
 * - enrollMultiAngle: Đăng ký 5 góc khuôn mặt (Chính diện, Trái, Phải, Ngước, Cúi).
 * - getRegistrationStatus: Tra cứu trạng thái Face ID của bản thân hoặc nhân sự.
 * - deleteFaceData: Xóa sạch dữ liệu sinh trắc học (Quyền được xóa dữ liệu cá nhân).
 * - getHealth: Kiểm tra tình trạng kết nối Python FastAPI InsightFace Microservice.
 */
import { apiClient } from './apiClient';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HeadPose {
  pose: 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_UP' | 'LOOK_DOWN' | 'NONE' | string;
  yaw_deg: number;
  pitch_deg: number;
  roll_deg: number;
}

export interface FaceLandmarks {
  right_eye: { x: number; y: number };
  left_eye: { x: number; y: number };
  nose_tip: { x: number; y: number };
  mouth_right: { x: number; y: number };
  mouth_left: { x: number; y: number };
}

export interface DetectPoseResponse {
  face_detected: boolean;
  faceCount?: number;
  bbox?: BoundingBox | null;
  pose?: HeadPose;
  landmarks?: FaceLandmarks | null;
  liveness?: number | null;
  quality?: number | null;
  offline?: boolean;
  message?: string;
}

export interface RegistrationStatusResponse {
  success: boolean;
  data: {
    userId: string;
    fullName: string;
    email: string;
    isRegistered: boolean;
    isFaceRegistered: boolean;
    faceRegisteredAt?: string | null;
    facePhoto?: string | null;
    sampleAngles?: string[];
    sampleCount?: number;
    embeddingModel?: string;
  };
}

export interface EnrollResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    fullName: string;
    anglesRegistered: string[];
    sampleCount: number;
    facePhoto?: string;
    templateId?: string;
  };
}

export const faceApi = {
  /**
   * Phát hiện góc tư thế đầu 3D realtime từ frame webcam
   */
  async detectPose(imageBlob: Blob): Promise<DetectPoseResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');

    const res = await apiClient.post<DetectPoseResponse>('/face/detect-pose', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Đăng ký 5 góc khuôn mặt (Gửi multipart form gồm các góc ảnh và sự đồng thuận NĐ 13/2023)
   */
  async enrollMultiAngle(formData: FormData): Promise<EnrollResponse> {
    const res = await apiClient.post<EnrollResponse>('/face/enroll-multi-angle', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Kiểm tra trạng thái đăng ký Face ID của người dùng hiện tại hoặc nhân viên cụ thể
   */
  async getRegistrationStatus(userId?: string): Promise<RegistrationStatusResponse> {
    const endpoint = userId
      ? `/face/registration-status/${userId}`
      : '/face/registration-status';
    const res = await apiClient.get<RegistrationStatusResponse>(endpoint);
    return res.data;
  },

  /**
   * Xóa toàn bộ dữ liệu mẫu khuôn mặt (Nghị định 13/2023/NĐ-CP)
   */
  async deleteFaceData(userId?: string): Promise<{ success: boolean; message: string }> {
    const endpoint = userId ? `/face/faces/${userId}` : '/face/my-template';
    try {
      const res = await apiClient.delete<{ success: boolean; message: string }>(endpoint);
      return res.data;
    } catch (err: any) {
      if (err.response?.status === 404 && userId) {
        // Fallback sang endpoint /api/users/:id/face nếu /api/face/faces/:id không tìm thấy
        const fallbackRes = await apiClient.delete<{ success: boolean; message: string }>(`/users/${userId}/face`);
        return fallbackRes.data;
      }
      throw err;
    }
  },

  /**
   * Kiểm tra tình trạng kết nối máy chủ AI Microservice
   */
  async getHealth(): Promise<{ status: string; face_service?: any }> {
    const res = await apiClient.get<{ status: string; face_service?: any }>('/face/health');
    return res.data;
  },

  /**
   * Kiểm thử nhận diện khuôn mặt Realtime (Chỉ kiểm tra AI 1:N FAISS, không chấm công, không geofence)
   */
  async testRecognition(imageBlob: Blob): Promise<{
    success: boolean;
    matched: boolean;
    message: string;
    similarity?: number;
    confidence?: number;
    userId?: string;
    user?: {
      _id: string;
      fullName: string;
      email: string;
      role: string;
      avatar?: string;
      staffCode?: string;
      department?: string;
    };
    errorCode?: string;
  }> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'test_frame.jpg');

    const res = await apiClient.post<any>('/face/test-recognition', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

