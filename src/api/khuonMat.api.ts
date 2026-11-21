/**
 * Face Biometrics API Client (src/api/khuonMat.api.ts)
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
    nguoi_dung_id: string;
    ho_ten: string;
    email: string;
    ma_can_bo?: string;
    da_dang_ky_face: boolean;
    ngay_dang_ky?: string | null;
    anh_dai_dien?: string | null;
    cac_goc_chup?: string[];
    so_luong_mau?: number;
    mo_hinh_ai?: string;
    so_chieu_vector?: number | null;
    mac_dinh?: boolean;
    trang_thai_khuon_mat?: string | null;
  };
}

export interface EnrollResponse {
  success: boolean;
  message: string;
  errorCode?: string;
  data?: {
    nguoi_dung_id: string;
    ho_ten: string;
    email?: string;
    da_dang_ky_face?: boolean;
    cac_goc_chup: string[];
    so_luong_mau: number;
    anh_khuon_mat?: string | null;
    mau_khuon_mat_id?: string;
  };
}

export const faceApi = {
  /**
   * Phát hiện góc tư thế đầu 3D realtime từ frame webcam
   */
  async detectPose(imageBlob: Blob): Promise<DetectPoseResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'frame.jpg');

    const res = await apiClient.post<DetectPoseResponse>('/khuon-mat/phat-hien-tu-the', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Đăng ký 5 góc khuôn mặt (Gửi multipart form gồm các góc ảnh và sự đồng thuận NĐ 13/2023)
   */
  async enrollMultiAngle(formData: FormData): Promise<EnrollResponse> {
    const res = await apiClient.post<EnrollResponse>('/khuon-mat/dang-ky-da-goc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Kiểm tra trạng thái đăng ký Face ID của người dùng hiện tại hoặc nhân viên cụ thể
   */
  async getRegistrationStatus(userId?: string): Promise<RegistrationStatusResponse> {
    const endpoint = userId
      ? `/khuon-mat/trang-thai-dang-ky/${userId}`
      : '/khuon-mat/trang-thai-dang-ky';
    const res = await apiClient.get<RegistrationStatusResponse>(endpoint);
    return res.data;
  },

  /**
   * Xóa toàn bộ dữ liệu mẫu khuôn mặt (Nghị định 13/2023/NĐ-CP). Chỉ cấp trên trong phạm vi quản lý được xóa, không tự xóa.
   */
  async deleteFaceData(userId: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/khuon-mat/du-lieu/${userId}`);
    return res.data;
  },

  /**
   * Kiểm tra tình trạng kết nối máy chủ AI Microservice
   */
  async getHealth(): Promise<{ status: string; ready?: boolean; face_service?: any }> {
    const res = await apiClient.get<any>('/khuon-mat/suc-khoe');
    if (res.data && typeof res.data === 'object' && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data;
  },

  /**
   * Kiểm thử nhận diện khuôn mặt Realtime (Chỉ kiểm tra AI 1:N FAISS, không chấm công, không geofence)
   */
  async testRecognition(imageBlob: Blob): Promise<{
    success: boolean;
    khop_khuon_mat: boolean;
    message: string;
    do_tuong_dong?: number;
    do_tin_cay?: number;
    nguoi_dung_id?: string;
    nguoi_dung?: {
      id: string;
      ho_ten: string;
      email: string;
      vai_tro_chinh: string;
      anh_dai_dien?: string;
      ma_can_bo?: string;
      ten_phong_ban?: string;
    };
    errorCode?: string;
  }> {
    const formData = new FormData();
    formData.append('image', imageBlob, 'test_frame.jpg');

    const res = await apiClient.post<any>('/khuon-mat/kiem-thu-nhan-dien', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

