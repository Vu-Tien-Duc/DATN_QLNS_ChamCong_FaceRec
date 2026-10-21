import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  LogIn,
  LogOut,
  Zap,
  User,
  ShieldCheck,
  Building,
  Clock,
  Award,
  Calendar,
  Eye,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

interface FaceAttendanceScannerModalProps {
  isOpen: boolean;
  mode: 'check-in' | 'check-out';
  onClose: () => void;
  onSuccess: () => void;
}

interface AttendanceSuccessInfo {
  action: 'check-in' | 'check-out';
  snapshotUrl?: string;
  user: {
    fullName: string;
    email?: string;
    avatar?: string;
    department?: string;
    role: string;
  };
  timeStr: string;
  dateStr: string;
  similarity?: number;
  status?: string;
  message: string;
}

// Helper format URL avatar
const getAvatarUrl = (avatar?: string) => {
  if (!avatar) return '';
  if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) return avatar;
  if (avatar.startsWith('/')) return avatar;
  if (/^[0-9a-fA-F]{24}$/.test(avatar)) return `/api/images/${avatar}`;
  return `/uploads/${avatar}`;
};

// Helper dịch phòng ban
const DEPT_MAP: Record<string, string> = {
  sales: 'Kinh doanh',
  training: 'Đào tạo',
  accounting: 'Kế toán',
  marketing: 'Marketing',
  operation: 'Vận hành',
  'boad of director': 'Ban giám đốc',
  'board of director': 'Ban giám đốc',
  'board of directors': 'Ban giám đốc',
  teacher: 'Giảng viên',
  parent: 'Phụ huynh'
};

// Helper trích xuất tên vai trò hiển thị
const extractRoleName = (roleRaw: any): string => {
  if (!roleRaw) return 'Nhân viên';
  if (typeof roleRaw === 'string') {
    const lower = roleRaw.toLowerCase();
    if (lower === 'admin') return 'Quản trị viên (Admin)';
    if (lower === 'academic') return 'Quản lý đào tạo (Academic)';
    if (lower === 'teacher') return 'Giảng viên (Teacher)';
    if (lower === 'receptionist') return 'Lễ tân (Receptionist)';
    if (lower === 'counselor') return 'Tư vấn viên (Counselor)';
    if (lower === 'accountant') return 'Kế toán (Accountant)';
    if (lower === 'investor') return 'Nhà đầu tư (Investor)';
    return roleRaw;
  }
  if (typeof roleRaw === 'object') {
    return roleRaw.name || roleRaw.description || 'Nhân viên';
  }
  return 'Nhân viên';
};

// Helper màu sắc role
const getRoleBadgeStyle = (roleName: string) => {
  const name = String(roleName || '').toLowerCase();
  if (name.includes('admin') || name.includes('quản trị')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (name.includes('investor') || name.includes('cổ đông')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (name.includes('teacher') || name.includes('giảng viên')) return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
  if (name.includes('academic') || name.includes('đào tạo')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (name.includes('receptionist') || name.includes('lễ tân')) return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
  if (name.includes('counselor') || name.includes('tư vấn')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (name.includes('accountant') || name.includes('kế toán')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
};

export function FaceAttendanceScannerModal({
  isOpen,
  mode,
  onClose,
  onSuccess
}: FaceAttendanceScannerModalProps) {
  const { user: authUser } = useAuthStore();

  // Video, Stream & Canvases
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trạng thái theo dõi khuôn mặt mượt mà 60 FPS (LERP)
  const targetBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const targetLandmarksRef = useRef<any>(null);
  const currentLandmarksRef = useRef<any>(null);
  const lastPoseInfoRef = useRef<{ icon: string; text: string }>({ icon: '👤', text: 'Chờ camera...' });

  // Scan Laser Animation Ref
  const scanLineYRef = useRef<number>(0);
  const scanDirectionRef = useRef<number>(1);

  // Controls & States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [statusText, setStatusText] = useState('Đang khởi động camera...');
  const [errorMsg, setErrorMsg] = useState('');
  const [showMesh, setShowMesh] = useState(true);

  // Trạng thái kiểm tra đăng ký khuôn mặt
  const [checkingRegistration, setCheckingRegistration] = useState(false);
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  // Trạng thái không khớp khuôn mặt với tài khoản
  const [isFaceMismatch, setIsFaceMismatch] = useState(false);
  const [mismatchMessage, setMismatchMessage] = useState('');

  // Popup thông tin nhân sự & Role sau khi nhận diện
  const [successInfo, setSuccessInfo] = useState<AttendanceSuccessInfo | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const [confirming, setConfirming] = useState<boolean>(false);
  const pendingBlobRef = useRef<Blob | null>(null);

  const stableFaceCountRef = useRef(0);
  const isExecutingRef = useRef(false);
  const cooldownUntilRef = useRef(0);

  // Khởi tạo process canvas nhỏ (320x240 để gửi API nhanh 10x)
  useEffect(() => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 320;
    pCanvas.height = 240;
    processCanvasRef.current = pCanvas;
  }, []);

  // Đếm ngược tự động đóng popup thông tin nếu không bấm xác nhận (15 GIÂY)
  useEffect(() => {
    if (!successInfo) return;

    setCountdown(15);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleCancelPopup();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [successInfo]);

  // Bật/tắt camera khi mở/đóng modal - Có kiểm tra đăng ký khuôn mặt
  useEffect(() => {
    let isCancelled = false;

    const initAttendanceScanner = async () => {
      if (!isOpen) {
        stopCamera();
        setIsNotRegistered(false);
        setIsFaceMismatch(false);
        setMismatchMessage('');
        setCheckingRegistration(false);
        return;
      }

      setSuccessInfo(null);
      setErrorMsg('');
      setIsFaceMismatch(false);
      setMismatchMessage('');
      setFaceDetected(false);
      stableFaceCountRef.current = 0;
      isExecutingRef.current = false;
      cooldownUntilRef.current = Date.now() + 600;

      // 1. Kiểm tra tài khoản đã đăng ký khuôn mặt hay chưa
      setCheckingRegistration(true);
      try {
        const empId = authUser?._id;
        const res = await apiClient.get(`/face/registration-status${empId ? `/${empId}` : ''}`);
        if (isCancelled) return;

        if (res.data?.success && res.data.isRegistered === false) {
          setIsNotRegistered(true);
          setErrorMsg('Tài khoản của bạn chưa đăng ký khuôn mặt trong hệ thống.');
          setCheckingRegistration(false);
          return;
        }
      } catch (err: any) {
        if (isCancelled) return;
        // Nếu API có lỗi và trong store tài khoản cũng không có thông tin khuôn mặt
        if (!authUser?.isFaceRegistered && !authUser?.facePhoto) {
          setIsNotRegistered(true);
          setErrorMsg('Tài khoản của bạn chưa đăng ký khuôn mặt trong hệ thống.');
          setCheckingRegistration(false);
          return;
        }
      } finally {
        if (!isCancelled) {
          setCheckingRegistration(false);
        }
      }

      if (isCancelled) return;
      setIsNotRegistered(false);
      setStatusText(`Đang quét khuôn mặt để ${mode === 'check-in' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}...`);
      startCamera();
    };

    initAttendanceScanner();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen, mode, authUser?._id, authUser?.isFaceRegistered, authUser?.facePhoto]);

  // Bật camera
  const startCamera = async () => {
    setCameraLoading(true);
    setErrorMsg('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Webcam');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
      startBiometricLoop();
    } catch (err: any) {
      setErrorMsg('Không thể mở Camera: ' + (err.message || 'Vui lòng cấp quyền truy cập webcam.'));
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Dừng camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
    setIsCameraActive(false);
    setFaceDetected(false);
    targetBoxRef.current = null;
    currentBoxRef.current = null;
    targetLandmarksRef.current = null;
    currentLandmarksRef.current = null;
    stableFaceCountRef.current = 0;
    isExecutingRef.current = false;
  };

  // Đóng / Hủy popup xác nhận mà KHÔNG thực hiện check in/out (không ảnh hưởng dữ liệu)
  const handleCancelPopup = () => {
    stopCamera();
    setIsFaceMismatch(false);
    setMismatchMessage('');
    setSuccessInfo(null);
    pendingBlobRef.current = null;
    setConfirming(false);
    onClose();
  };

  // Đóng hoàn tất khi đã điểm danh thành công
  const handleFinishAndClose = () => {
    stopCamera();
    setIsFaceMismatch(false);
    setMismatchMessage('');
    setSuccessInfo(null);
    pendingBlobRef.current = null;
    setConfirming(false);
    onSuccess();
    onClose();
  };

  // Khi người dùng bấm XÁC NHẬN trên popup mới BẮT ĐẦU TÍNH VÀ GHI NHẬN Check-in / Check-out
  const handleConfirmAttendance = async () => {
    if (confirming) return;
    setConfirming(true);

    try {
      const blob = pendingBlobRef.current || await captureHighQualityBlob();
      if (!blob) throw new Error('Không tìm thấy dữ liệu ảnh để hoàn tất.');

      const formData = new FormData();
      formData.append('image', blob, 'attendance.jpg');
      if (authUser?._id) {
        formData.append('employee_id', authUser._id);
      }

      const isCheckIn = mode === 'check-in';
      const endpoint = isCheckIn
        ? `/face/checkin?threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`
        : `/face/checkout?threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`;

      const res = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const finalMessage = res.data.message || `${isCheckIn ? 'Check-in' : 'Check-out'} thành công!`;
        toast.success(finalMessage);
        setSuccessInfo(null);
        pendingBlobRef.current = null;
        onSuccess();
        onClose();
      } else {
        throw new Error(res.data?.message || 'Ghi nhận điểm danh thất bại.');
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Xác nhận chấm công thất bại.';
      toast.error(errMsg);
    } finally {
      setConfirming(false);
    }
  };

  // Nút thử lại quét khuôn mặt khi bị mismatch
  const handleRetryScan = () => {
    setIsFaceMismatch(false);
    setMismatchMessage('');
    setErrorMsg('');
    setStatusText(`Đang quét khuôn mặt để ${mode === 'check-in' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}...`);
    cooldownUntilRef.current = Date.now() + 600;
    stableFaceCountRef.current = 0;
  };

  // Vòng lặp nhận diện & vẽ HUD 60 FPS
  const startBiometricLoop = () => {
    let isDetecting = false;
    let lastDetectTime = 0;

    const renderLoop = async () => {
      if (!videoRef.current || !overlayCanvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }

        const now = performance.now();

        // 1. Gửi frame nhỏ (320x240) sang backend detect pose mỗi ~350ms (tiết kiệm 75% CPU)
        if (!isDetecting && now - lastDetectTime >= 350) {
          isDetecting = true;
          lastDetectTime = now;

          if (!processCanvasRef.current) {
            processCanvasRef.current = document.createElement('canvas');
            processCanvasRef.current.width = 320;
            processCanvasRef.current.height = 240;
          }
          const pCanvas = processCanvasRef.current;
          const pCtx = pCanvas.getContext('2d');

          if (pCtx) {
            pCtx.drawImage(video, 0, 0, 320, 240);
            pCanvas.toBlob(async (blob) => {
              if (blob) {
                try {
                  const formData = new FormData();
                  formData.append('image', blob, 'frame.jpg');

                  const res = await fetch('/api/face/detect-pose', {
                    method: 'POST',
                    body: formData,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    handleDetectionResult(data, overlay.width, overlay.height);
                  }
                } catch (_) {
                  // drop frame
                } finally {
                  isDetecting = false;
                }
              } else {
                isDetecting = false;
              }
            }, 'image/jpeg', 0.5);
          } else {
            isDetecting = false;
          }
        }

        // 2. Vẽ Overlay HUD 60 FPS
        drawSmoothHUD(overlay);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Xử lý kết quả phát hiện khuôn mặt
  const handleDetectionResult = (data: any, canvasW: number, canvasH: number) => {
    if (!data || !data.face_detected || !data.bbox) {
      setFaceDetected(false);
      targetBoxRef.current = null;
      targetLandmarksRef.current = null;
      stableFaceCountRef.current = 0;
      return;
    }

    setFaceDetected(true);
    const scaleX = canvasW / 320;
    const scaleY = canvasH / 240;

    const rawBox = data.bbox;
    const scaledBoxW = rawBox.width * scaleX;
    const scaledBoxH = rawBox.height * scaleY;
    const scaledBoxX = canvasW - (rawBox.x * scaleX + scaledBoxW); // Mirror X do lật camera
    const scaledBoxY = rawBox.y * scaleY;

    targetBoxRef.current = {
      x: scaledBoxX,
      y: scaledBoxY,
      width: scaledBoxW,
      height: scaledBoxH,
    };

    if (data.landmarks) {
      const lm = data.landmarks;
      targetLandmarksRef.current = {
        right_eye: { x: canvasW - lm.right_eye.x * scaleX, y: lm.right_eye.y * scaleY },
        left_eye: { x: canvasW - lm.left_eye.x * scaleX, y: lm.left_eye.y * scaleY },
        nose_tip: { x: canvasW - lm.nose_tip.x * scaleX, y: lm.nose_tip.y * scaleY },
        mouth_right: { x: canvasW - lm.mouth_right.x * scaleX, y: lm.mouth_right.y * scaleY },
        mouth_left: { x: canvasW - lm.mouth_left.x * scaleX, y: lm.mouth_left.y * scaleY },
      };
    }

    const pose = data.pose ? data.pose.pose : 'STRAIGHT';
    const poseMap: Record<string, { icon: string; text: string }> = {
      STRAIGHT: { icon: '👤', text: 'Nhìn thẳng' },
      TURN_LEFT: { icon: '👈', text: 'Quay trái' },
      TURN_RIGHT: { icon: '👉', text: 'Quay phải' },
      LOOK_UP: { icon: '👆', text: 'Ngước lên' },
      LOOK_DOWN: { icon: '👇', text: 'Cúi xuống' },
    };
    lastPoseInfoRef.current = poseMap[pose] || { icon: '🎯', text: pose };

    // Tự động kích hoạt chấm công khi khuôn mặt ổn định và không trong trạng thái mismatch
    stableFaceCountRef.current += 1;
    if (
      stableFaceCountRef.current >= 3 &&
      Date.now() > cooldownUntilRef.current &&
      !isExecutingRef.current &&
      !successInfo &&
      !isNotRegistered &&
      !isFaceMismatch
    ) {
      isExecutingRef.current = true;
      executeAttendance();
    }
  };

  // Vẽ HUD (Mesh 3D, BoundingBox viền góc, Badge, Laser Scan)
  const drawSmoothHUD = (overlay: HTMLCanvasElement) => {
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const targetBox = targetBoxRef.current;
    if (!targetBox) {
      currentBoxRef.current = null;
      currentLandmarksRef.current = null;
      return;
    }

    // Nội suy LERP mượt mà 0.40
    if (!currentBoxRef.current) {
      currentBoxRef.current = { ...targetBox };
    } else {
      const lerp = 0.40;
      currentBoxRef.current.x += (targetBox.x - currentBoxRef.current.x) * lerp;
      currentBoxRef.current.y += (targetBox.y - currentBoxRef.current.y) * lerp;
      currentBoxRef.current.width += (targetBox.width - currentBoxRef.current.width) * lerp;
      currentBoxRef.current.height += (targetBox.height - currentBoxRef.current.height) * lerp;
    }

    const box = currentBoxRef.current;
    const isCheckIn = mode === 'check-in';
    const mainColor = isFaceMismatch ? '#ef4444' : (isCheckIn ? '#10b981' : '#f59e0b');
    const glowColor = isFaceMismatch ? 'rgba(239, 68, 68, 0.45)' : (isCheckIn ? 'rgba(16, 185, 129, 0.45)' : 'rgba(245, 158, 11, 0.45)');

    ctx.save();

    // 1. 3D Wireframe Mesh & Landmarks
    if (showMesh && targetLandmarksRef.current) {
      const tLm = targetLandmarksRef.current;
      if (!currentLandmarksRef.current) {
        currentLandmarksRef.current = {
          right_eye: { ...tLm.right_eye },
          left_eye: { ...tLm.left_eye },
          nose_tip: { ...tLm.nose_tip },
          mouth_right: { ...tLm.mouth_right },
          mouth_left: { ...tLm.mouth_left },
        };
      } else {
        const cLm = currentLandmarksRef.current;
        const lLerp = 0.45;
        ['right_eye', 'left_eye', 'nose_tip', 'mouth_right', 'mouth_left'].forEach((k) => {
          cLm[k].x += (tLm[k].x - cLm[k].x) * lLerp;
          cLm[k].y += (tLm[k].y - cLm[k].y) * lLerp;
        });
      }

      const lm = currentLandmarksRef.current;
      const re = lm.right_eye;
      const le = lm.left_eye;
      const nose = lm.nose_tip;
      const mr = lm.mouth_right;
      const ml = lm.mouth_left;

      const foreheadL = { x: box.x + box.width * 0.7, y: box.y + box.height * 0.1 };
      const foreheadR = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.1 };
      const foreheadMid = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.05 };
      const templeL = { x: box.x + box.width * 0.92, y: box.y + box.height * 0.28 };
      const templeR = { x: box.x + box.width * 0.08, y: box.y + box.height * 0.28 };
      const cheekL = { x: box.x + box.width * 0.88, y: box.y + box.height * 0.62 };
      const cheekR = { x: box.x + box.width * 0.12, y: box.y + box.height * 0.62 };
      const jawL = { x: box.x + box.width * 0.75, y: box.y + box.height * 0.9 };
      const jawR = { x: box.x + box.width * 0.25, y: box.y + box.height * 0.9 };
      const chin = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.98 };
      const noseBridge = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 - box.height * 0.05 };

      const meshLines = [
        [foreheadMid, foreheadL], [foreheadMid, foreheadR],
        [foreheadL, templeL], [foreheadR, templeR],
        [templeL, cheekL], [templeR, cheekR],
        [cheekL, jawL], [cheekR, jawR],
        [jawL, chin], [jawR, chin],
        [foreheadL, le], [foreheadR, re], [foreheadMid, noseBridge],
        [templeL, le], [templeR, re],
        [re, le], [re, noseBridge], [le, noseBridge],
        [noseBridge, nose], [re, nose], [le, nose],
        [cheekL, ml], [cheekR, mr],
        [cheekL, nose], [cheekR, nose],
        [nose, mr], [nose, ml],
        [mr, ml], [mr, jawR], [ml, jawL], [mr, chin], [ml, chin],
      ];

      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const [p1, p2] of meshLines) {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.stroke();

      const allNodes = [foreheadMid, foreheadL, foreheadR, templeL, templeR, re, le, noseBridge, nose, cheekL, cheekR, mr, ml, jawL, jawR, chin];
      ctx.fillStyle = mainColor;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
      for (const node of allNodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 2. Corner Brackets Bounding Box
    const cornerLength = Math.min(box.width, box.height) * 0.22;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(box.x, box.y + cornerLength); ctx.lineTo(box.x, box.y); ctx.lineTo(box.x + cornerLength, box.y);
    ctx.moveTo(box.x + box.width - cornerLength, box.y); ctx.lineTo(box.x + box.width, box.y); ctx.lineTo(box.x + box.width, box.y + cornerLength);
    ctx.moveTo(box.x + box.width, box.y + box.height - cornerLength); ctx.lineTo(box.x + box.width, box.y + box.height); ctx.lineTo(box.x + box.width - cornerLength, box.y + box.height);
    ctx.moveTo(box.x + cornerLength, box.y + box.height); ctx.lineTo(box.x, box.y + box.height); ctx.lineTo(box.x, box.y + box.height - cornerLength);
    ctx.stroke();

    // 3. Laser Scan Line chạy dọc khuôn mặt
    scanLineYRef.current += 3 * scanDirectionRef.current;
    if (scanLineYRef.current > box.height) {
      scanLineYRef.current = box.height;
      scanDirectionRef.current = -1;
    } else if (scanLineYRef.current < 0) {
      scanLineYRef.current = 0;
      scanDirectionRef.current = 1;
    }

    const currentLaserY = box.y + scanLineYRef.current;
    const laserGradient = ctx.createLinearGradient(box.x, currentLaserY, box.x + box.width, currentLaserY);
    laserGradient.addColorStop(0, 'rgba(0, 255, 200, 0)');
    laserGradient.addColorStop(0.5, mainColor);
    laserGradient.addColorStop(1, 'rgba(0, 255, 200, 0)');

    ctx.strokeStyle = laserGradient;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(box.x, currentLaserY);
    ctx.lineTo(box.x + box.width, currentLaserY);
    ctx.stroke();

    // 4. Floating Badge trên đầu
    const badgeH = 30;
    const badgeW = Math.max(210, box.width * 1.05);
    const badgeX = box.x + (box.width - badgeW) / 2;
    const badgeY = box.y - badgeH - 12;

    ctx.shadowBlur = 0;
    ctx.fillStyle = isFaceMismatch ? 'rgba(153, 27, 27, 0.95)' : (isCheckIn ? 'rgba(6, 78, 59, 0.95)' : 'rgba(120, 53, 15, 0.95)');
    ctx.beginPath();
    // @ts-ignore
    if (ctx.roundRect) {
      // @ts-ignore
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const modeText = isCheckIn ? 'CHECK-IN' : 'CHECK-OUT';
    const badgeText = isFaceMismatch
      ? `⚠️ KHÔNG KHỚP: ${authUser?.fullName ? authUser.fullName.toUpperCase() : 'CHỦ TÀI KHOẢN'}`
      : `🎯 ${modeText} • ${lastPoseInfoRef.current.text}`;
    ctx.fillText(
      badgeText,
      badgeX + badgeW / 2,
      badgeY + 19
    );

    ctx.restore();
  };

  // Chụp ảnh frame sắc nét gửi nhận diện
  const captureHighQualityBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.92);
    });
  };

  // Quét & xác thực danh tính khuôn mặt -> Hiển thị Popup xác nhận (CHƯA tính check in/out)
  const executeAttendance = async () => {
    if (submitting || confirming) return;
    setSubmitting(true);
    setStatusText(`Đang xác thực ${mode === 'check-in' ? 'Check-in' : 'Check-out'}...`);

    try {
      const blob = await captureHighQualityBlob();
      if (!blob) throw new Error('Không thể chụp ảnh từ camera.');

      // Lưu lại blob để khi người dùng bấm xác nhận sẽ dùng chính ảnh này để tính công
      pendingBlobRef.current = blob;
      const snapshotUrl = URL.createObjectURL(blob);

      const formData = new FormData();
      formData.append('image', blob, 'attendance.jpg');
      if (authUser?._id) {
        formData.append('employee_id', authUser._id);
      }

      const isCheckIn = mode === 'check-in';
      // verify_only=true: Chỉ xác thực khuôn mặt đúng chủ tài khoản, CHƯA tạo bản ghi chấm công
      const endpoint = isCheckIn
        ? `/face/checkin?verify_only=true&threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`
        : `/face/checkout?verify_only=true&threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`;

      let verifySuccess = false;
      let finalMessage = '';
      let resultData: any = null;

      try {
        const res = await apiClient.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.success) {
          verifySuccess = true;
          finalMessage = res.data.message || `Đã nhận diện: ${authUser?.fullName || ''}`;
          resultData = res.data.data;
          setIsFaceMismatch(false);
          setMismatchMessage('');
        } else {
          const errCode = res.data?.code;
          const errMsg = 'Khuôn mặt không khớp với khuôn mặt đã đăng ký của tài khoản này! Vui lòng đúng chủ tài khoản điểm danh.';
          if (errCode === 'NOT_REGISTERED') {
            setIsNotRegistered(true);
            stopCamera();
          } else if (errCode === 'FACE_MISMATCH') {
            setIsFaceMismatch(true);
            setMismatchMessage(errMsg);
          }
          throw new Error(errMsg);
        }
      } catch (faceErr: any) {
        const errCode = faceErr?.response?.data?.code;
        const serverMsg = errCode === 'NOT_REGISTERED'
          ? (faceErr?.response?.data?.message || 'Tài khoản chưa đăng ký khuôn mặt!')
          : 'Khuôn mặt không khớp với khuôn mặt đã đăng ký của tài khoản này! Vui lòng đúng chủ tài khoản điểm danh.';

        if (errCode === 'NOT_REGISTERED') {
          setIsNotRegistered(true);
          stopCamera();
        } else {
          setIsFaceMismatch(true);
          setMismatchMessage(serverMsg);
        }

        throw new Error(serverMsg);
      }

      if (verifySuccess) {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const resolvedUser = resultData?.user || authUser || {};
        const roleDisplay = extractRoleName(resolvedUser.role || (resolvedUser.roles && resolvedUser.roles[0]));

        // Tắt camera ngay sau khi xác thực danh tính để nhả tài nguyên webcam
        stopCamera();

        // Hiển thị Popup Thông tin Role, Frame Ảnh để nhân sự BẤM XÁC NHẬN MỚI TÍNH CÔNG
        setSuccessInfo({
          action: mode,
          snapshotUrl,
          user: {
            fullName: resolvedUser.fullName || resolvedUser.name || 'Nhân sự',
            email: resolvedUser.email,
            avatar: resolvedUser.avatar || resolvedUser.facePhoto,
            department: DEPT_MAP[resolvedUser.department] || resolvedUser.department || 'Vận hành',
            role: roleDisplay
          },
          timeStr,
          dateStr,
          status: 'Chờ xác nhận',
          message: finalMessage
        });
      } else {
        throw new Error('Chưa khớp khuôn mặt. Vui lòng nhìn thẳng và thử lại.');
      }
    } catch (err: any) {
      cooldownUntilRef.current = Date.now() + 5000;
      stableFaceCountRef.current = 0;
      const displayMsg = err.message || 'Thao tác thất bại, vui lòng thử lại.';
      setStatusText(displayMsg);
      setErrorMsg(displayMsg);
    } finally {
      setSubmitting(false);
      isExecutingRef.current = false;
    }
  };


  if (!isOpen) return null;

  const isCheckIn = mode === 'check-in';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* ══════════════════════════════════════════════════════════════
          POPUP HIỆN THÔNG TIN & ROLE THEO KHUÔN MẶT KÈM FRAME ẢNH & ĐẾM NGƯỢC 15S
         ══════════════════════════════════════════════════════════════ */}
      {successInfo ? (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl max-w-lg w-full relative overflow-hidden flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto custom-scrollbar">
          
          {/* Vòng sáng trang trí */}
          <div className={`absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
            isCheckIn ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`} />

          {/* ── HEADER POPUP: TIÊU ĐỀ & NÚT TẮT POPUP ──────────────── */}
          <div className="w-full flex items-center justify-between pb-2 border-b border-white/10 relative z-10">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                isCheckIn
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isCheckIn ? 'Xác nhận Check-in' : 'Xác nhận Check-out'}
              </span>
            </div>

            {/* Nút Tắt Popup ở góc trên (Hủy) */}
            <button
              onClick={handleCancelPopup}
              disabled={confirming}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-white/10 hover:border-rose-500/30 disabled:opacity-50"
              title="Tắt popup (Hủy - Không chấm công)"
            >
              <X size={15} />
              <span>Tắt popup</span>
            </button>
          </div>

          {/* ── FRAME ẢNH CHỤP THỰC TẾ SAU KHI NHẬN DIỆN ─────────────── */}
          <div className="relative mx-auto my-1">
            <div className={`relative w-36 h-36 rounded-3xl overflow-hidden border-2 shadow-2xl ${
              isCheckIn
                ? 'border-emerald-400 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                : 'border-amber-400 shadow-amber-500/30 ring-4 ring-amber-500/20'
            }`}>
              <img
                src={successInfo.snapshotUrl || getAvatarUrl(successInfo.user.avatar) || ''}
                alt={successInfo.user.fullName}
                className="w-full h-full object-cover"
              />
              {/* Lớp phủ gradient nhẹ */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />

              {/* Tag ảnh xác thực realtime */}
              <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-xs text-white border border-white/20 flex items-center gap-1">
                  <Camera className="w-2.5 h-2.5 text-cyan-300" /> Ảnh quét Face AI
                </span>
              </div>
            </div>

            {/* Badge icon góc trên */}
            <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 ${
              isCheckIn ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
            }`}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Họ tên & Email */}
          <div className="space-y-0.5">
            <h3 className="text-2xl font-black text-white">
              {successInfo.user.fullName}
            </h3>
            {successInfo.user.email && (
              <p className="text-xs text-indigo-200/70">{successInfo.user.email}</p>
            )}
          </div>

          {/* Card thông tin chi tiết: ROLE, PHÒNG BAN, THỜI GIAN, TRẠNG THÁI */}
          <div className="w-full bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-3 text-xs text-left">
            {/* VAI TRÒ / ROLE */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" /> Vai trò (Role):
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${getRoleBadgeStyle(successInfo.user.role)}`}>
                {successInfo.user.role}
              </span>
            </div>

            {/* PHÒNG BAN */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" /> Phòng ban:
              </span>
              <span className="font-bold text-slate-200">{successInfo.user.department}</span>
            </div>

            {/* THỜI GIAN GHI NHẬN */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" /> Giờ dự kiến:
              </span>
              <span className="font-mono font-bold text-cyan-300 text-sm">
                {successInfo.timeStr} • {successInfo.dateStr}
              </span>
            </div>

            {/* TRẠNG THÁI XÁC THỰC AI */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Nhận diện AI:
              </span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Đúng chủ tài khoản
              </span>
            </div>

            {/* TRẠNG THÁI */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10">
              <span className="text-slate-400">Trạng thái điểm danh:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Chờ xác nhận {isCheckIn ? 'Check-in' : 'Check-out'}
              </span>
            </div>
          </div>

          {/* ĐẾM NGƯỢC THỜI GIAN TẮT POPUP (15s) */}
          <div className="w-full space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-indigo-200/80 px-1">
              <span className="flex items-center gap-1.5 font-bold">
                <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                Tự động đóng sau:
              </span>
              <span className="font-mono font-black text-cyan-300 text-sm px-2.5 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                {countdown}s
              </span>
            </div>

            {/* Thanh Progress bar thời gian 15s */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  isCheckIn ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${(countdown / 15) * 100}%` }}
              />
            </div>
          </div>

          {/* ── CÁC NÚT THAO TÁC / TẮT POPUP ──────────────────────── */}
          <div className="w-full flex items-center gap-2.5 pt-1">
            {/* Nút Tắt popup (Hủy - Không tính check in/out) */}
            <button
              onClick={handleCancelPopup}
              disabled={confirming}
              className="flex-1 py-3 px-4 rounded-xl font-bold bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 transition-all cursor-pointer text-xs border border-white/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
              title="Đóng popup mà không ghi nhận chấm công"
            >
              <X className="w-4 h-4" />
              <span>Tắt popup (Hủy)</span>
            </button>

            {/* Nút Xác nhận BẮT ĐẦU TÍNH Check-in/out */}
            <button
              onClick={handleConfirmAttendance}
              disabled={confirming}
              className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                isCheckIn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
              }`}
            >
              {confirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tính công...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận {isCheckIn ? 'Check-in' : 'Check-out'} ({countdown}s)</span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
            GIAO DIỆN QUÉT CAMERA (CHỈ HIỆN CAM & SCAN KHUÔN MẶT)
           ══════════════════════════════════════════════════════════════ */
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl max-w-xl w-full relative overflow-hidden flex flex-col gap-4">
          
          {/* Glow trang trí */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />

          {/* ── HEADER ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20 relative z-10">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner border ${
                isCheckIn
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              }`}>
                <ScanFace className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-white">
                    {isCheckIn ? 'Quét Khuôn Mặt Check-in (Vào ca)' : 'Quét Khuôn Mặt Check-out (Tan ca)'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${
                    isCheckIn
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    Tự động 100%
                  </span>
                </div>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  Nhìn thẳng vào camera, hệ thống sẽ tự động bắt nét và chấm công tức thì
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Nút bật/tắt lưới 3D */}
              <button
                onClick={() => setShowMesh(!showMesh)}
                className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  showMesh
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                }`}
                title="Bật/Tắt lưới 3D FaceLandmarks"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              {/* Nút Đóng */}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── NỘI DUNG CHÍNH (KIỂM TRA ĐĂNG KÝ HOẶC KHUNG CAMERA) ─────────────── */}
          {checkingRegistration ? (
            <div className="aspect-4/3 rounded-2xl bg-black/60 border-2 border-indigo-500/30 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              <p className="text-sm font-bold text-slate-200">Đang kiểm tra dữ liệu khuôn mặt tài khoản...</p>
              <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
            </div>
          ) : isNotRegistered ? (
            <div className="aspect-4/3 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900 to-black border-2 border-amber-500/40 flex flex-col items-center justify-center gap-4 p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-500/20 animate-bounce">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2 max-w-sm">
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block">
                  Chưa đăng ký khuôn mặt
                </span>
                <h3 className="text-lg font-black text-white">
                  Tài khoản chưa có dữ liệu khuôn mặt
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tài khoản của bạn ({authUser?.fullName || 'Hiện tại'}) chưa đăng ký khuôn mặt. Hệ thống chỉ cho phép đối chiếu và chấm công với khuôn mặt đã đăng ký của chính tài khoản này.
                </p>
                <p className="text-[11px] text-amber-200/80 font-medium bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  👉 Vui lòng đăng ký khuôn mặt trong phần thông tin cá nhân hoặc liên hệ Quản trị viên trước khi điểm danh.
                </p>
              </div>

              <button
                onClick={onClose}
                className="mt-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                Đã hiểu & Đóng lại
              </button>
            </div>
          ) : (
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl">
              {/* Video Stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Overlaid Canvas HUD (3D Mesh + BoundingBox + Laser Scan 60FPS) */}
              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {/* Badge trạng thái realtime trên khung cam */}
              {isCameraActive && (
                <div className="absolute top-3 left-4 right-4 z-10 pointer-events-none flex items-center justify-between">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    <Zap className={`w-3.5 h-3.5 animate-pulse ${isCheckIn ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="text-xs font-bold text-white">
                      {statusText}
                    </span>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                    faceDetected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-500/20 text-slate-400 border-white/10'
                  }`}>
                    {faceDetected ? 'Face Locked' : 'Searching...'}
                  </span>
                </div>
              )}

              {/* Khi camera đang tải */}
              {cameraLoading && (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <p className="text-xs font-medium">Đang khởi động webcam...</p>
                </div>
              )}

              {/* Khi lỗi camera */}
              {!cameraLoading && !isCameraActive && errorMsg && (
                <div className="flex flex-col items-center justify-center p-6 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-rose-200 font-medium max-w-sm">{errorMsg}</p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-all"
                  >
                    Thử lại Camera
                  </button>
                </div>
              )}

              {/* Loading khi đang gửi nhận diện */}
              {submitting && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white z-20">
                  <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                  <p className="text-xs font-black tracking-wider uppercase text-cyan-200">
                    Đang quét & xác thực khuôn mặt...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* CẢNH BÁO KHUÔN MẶT KHÔNG KHỚP */}
          {isFaceMismatch && !isNotRegistered && (
            <div className="p-3.5 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl flex items-center justify-between gap-3 text-rose-200 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase text-rose-300">Khuôn mặt không khớp</div>
                  <div className="text-xs text-rose-200/90 leading-tight">
                    {mismatchMessage && !mismatchMessage.includes('LOW_SIMILARITY') && !mismatchMessage.includes('threshold') && !mismatchMessage.includes('<')
                      ? mismatchMessage
                      : 'Khuôn mặt không khớp với khuôn mặt đã đăng ký của tài khoản này! Vui lòng đúng chủ tài khoản điểm danh.'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleRetryScan}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          )}


          {/* ── FOOTER THAO TÁC ─────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-indigo-500/20">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => executeAttendance()}
                disabled={submitting || !isCameraActive}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 ${
                  isCheckIn
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCheckIn ? (
                  <LogIn className="w-4 h-4" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Chụp & Chấm công ngay</span>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
