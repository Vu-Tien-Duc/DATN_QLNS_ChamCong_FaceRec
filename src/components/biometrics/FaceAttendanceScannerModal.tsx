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
  ShieldCheck,
  Building,
  Clock,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { attendanceApi } from '../../api/attendance.api';
import { faceApi, DetectPoseResponse } from '../../api/face.api';
import { audioFeedback } from '../../utils/audioFeedback';
import { useAuthStore } from '../../store/useAuthStore';
import { getRoleLabel, isSuperAdmin } from '../../utils/rbac';
import { cameraManager } from '../../utils/cameraManager';
import { Portal } from '../ui/Portal';

export interface FaceAttendanceScannerModalProps {
  isOpen: boolean;
  mode?: 'check-in' | 'check-out';
  onClose: () => void;
  onSuccess?: () => void;
}

export interface AttendanceSuccessInfo {
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

const getRoleBadgeStyle = (roleName: string) => {
  const name = String(roleName || '').toLowerCase();
  if (name.includes('admin') || name.includes('quản trị')) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (name.includes('bgh') || name.includes('giám hiệu')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (name.includes('trưởng khoa') || name.includes('truong_khoa')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (name.includes('phó khoa') || name.includes('pho_khoa')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  if (name.includes('giảng viên') || name.includes('giang_vien')) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  if (name.includes('kế toán') || name.includes('ke_toan')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
};

const extractRoleName = (roleRaw: any): string => {
  return getRoleLabel(roleRaw);
};

export const FaceAttendanceScannerModal: React.FC<FaceAttendanceScannerModalProps> = ({
  isOpen,
  mode: initialMode = 'check-in',
  onClose,
  onSuccess,
}) => {
  const { user: authUser } = useAuthStore();
  const [activeMode, setActiveMode] = useState<'check-in' | 'check-out'>(initialMode);

  // Video, Stream & Canvases
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // LERP Box & Laser Scan
  const targetBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const targetLandmarksRef = useRef<any>(null);
  const currentLandmarksRef = useRef<any>(null);
  const lastPoseInfoRef = useRef<{ icon: string; text: string }>({ icon: '👤', text: 'Chờ camera...' });

  const scanLineYRef = useRef<number>(0);
  const scanDirectionRef = useRef<number>(1);

  // States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [faceDetected, setFaceDetected] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('Đang khởi động camera...');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showMesh, setShowMesh] = useState<boolean>(true);

  // Mismatch & Registration status
  const [checkingRegistration, setCheckingRegistration] = useState<boolean>(false);
  const [isNotRegistered, setIsNotRegistered] = useState<boolean>(false);
  const [isFaceMismatch, setIsFaceMismatch] = useState<boolean>(false);
  const [mismatchMessage, setMismatchMessage] = useState<string>('');

  // Confirmation popup
  const [successInfo, setSuccessInfo] = useState<AttendanceSuccessInfo | null>(null);
  const [countdown, setCountdown] = useState<number>(15);
  const [confirming, setConfirming] = useState<boolean>(false);
  const pendingBlobRef = useRef<Blob | null>(null);

  const stableFaceCountRef = useRef<number>(0);
  const isExecutingRef = useRef<boolean>(false);
  const cooldownUntilRef = useRef<number>(0);

  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 320;
    pCanvas.height = 240;
    processCanvasRef.current = pCanvas;
  }, []);

  // Đếm ngược 15 giây tự động hủy popup nếu không xác nhận
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

  // Mở / Đóng modal
  useEffect(() => {
    let isCancelled = false;

    const initScanner = async () => {
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

      // 1. Kiểm tra trạng thái đăng ký Face ID
      setCheckingRegistration(true);
      try {
        const res = await faceApi.getRegistrationStatus();
        if (isCancelled) return;

        if (res.success) {
          if (res.data.isFaceRegistered === false) {
            setIsNotRegistered(true);
            setErrorMsg('Tài khoản của bạn chưa được đăng ký mẫu khuôn mặt trong hệ thống.');
            setCheckingRegistration(false);
            return;
          } else if (authUser && !authUser.isFaceRegistered) {
            // Tự động đồng bộ cờ isFaceRegistered vào Zustand Store
            useAuthStore.getState().setUser({
              ...authUser,
              isFaceRegistered: true,
            });
          }
        }
      } catch (err: any) {
        if (isCancelled) return;
        if (!authUser?.isFaceRegistered) {
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
      setStatusText(`Đang quét khuôn mặt để ${activeMode === 'check-in' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}...`);
      startCamera();
    };

    initScanner();

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen, activeMode, authUser?._id, authUser?.isFaceRegistered]);

  // Khởi động Camera
  const startCamera = async () => {
    setCameraLoading(true);
    setErrorMsg('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Webcam');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });

      cameraManager.registerStream(stream);

      // Nếu modal đã bị đóng trong lúc chờ cấp quyền camera
      if (!isOpen) {
        stream.getTracks().forEach((t) => t.stop());
        cameraManager.unregisterStream(stream);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
      startBiometricLoop();
    } catch (err: any) {
      setErrorMsg('Không thể mở Camera: ' + (err.message || 'Vui lòng cấp quyền webcam.'));
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Dừng Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
          t.enabled = false;
        } catch (_) {}
      });
      cameraManager.unregisterStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
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

  // Đóng / Hủy popup xác nhận mà KHÔNG tính công
  const handleCancelPopup = () => {
    stopCamera();
    setIsFaceMismatch(false);
    setMismatchMessage('');
    setSuccessInfo(null);
    pendingBlobRef.current = null;
    setConfirming(false);
    onClose();
  };

  // Bấm XÁC NHẬN trên popup -> Gửi lệnh chấm công chính thức
  const handleConfirmAttendance = async () => {
    if (confirming) return;
    setConfirming(true);

    try {
      const blob = pendingBlobRef.current || (await captureHighQualityBlob());
      if (!blob) throw new Error('Không tìm thấy dữ liệu ảnh để hoàn tất.');

      const coords = { lat: 21.028511, lng: 105.854167 };
      const isCheckIn = activeMode === 'check-in';

      let res: any;
      if (isCheckIn) {
        res = await attendanceApi.checkInWithFace(blob, {
          location: coords,
          deviceId: 'MODAL_SCANNER_01',
        });
      } else {
        res = await attendanceApi.checkOutWithFace(blob, {
          location: coords,
          deviceId: 'MODAL_SCANNER_01',
        });
      }

      if (res && res.success) {
        audioFeedback.playSuccessChime();
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        toast.success(res.message || `${isCheckIn ? 'Check-in' : 'Check-out'} thành công!`);

        setSuccessInfo(null);
        pendingBlobRef.current = null;
        if (onSuccess) onSuccess();
        onClose();
      } else {
        throw new Error(res?.message || 'Ghi nhận chấm công thất bại.');
      }
    } catch (err: any) {
      audioFeedback.playWarningBeep();
      const errMsg = err?.response?.data?.message || err?.message || 'Xác nhận chấm công thất bại.';
      toast.error(errMsg);
    } finally {
      setConfirming(false);
    }
  };

  // Thử lại quét sau khi mismatch
  const handleRetryScan = () => {
    setIsFaceMismatch(false);
    setMismatchMessage('');
    setErrorMsg('');
    setStatusText(`Đang quét khuôn mặt để ${activeMode === 'check-in' ? 'Check-in (Vào ca)' : 'Check-out (Tan ca)'}...`);
    cooldownUntilRef.current = Date.now() + 600;
    stableFaceCountRef.current = 0;
  };

  // Vòng lặp nhận diện 60 FPS
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

        // Gửi frame nhỏ (320x240) sang backend phát hiện khuôn mặt mỗi ~350ms
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
            pCanvas.toBlob(
              async (blob) => {
                if (blob) {
                  try {
                    const data = await faceApi.detectPose(blob);
                    handleDetectionResult(data, overlay.width, overlay.height);
                  } catch (_) {
                    // Frame drop
                  } finally {
                    isDetecting = false;
                  }
                } else {
                  isDetecting = false;
                }
              },
              'image/jpeg',
              0.5
            );
          } else {
            isDetecting = false;
          }
        }

        // Vẽ Overlay HUD 60 FPS
        drawSmoothHUD(overlay);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Xử lý kết quả nhận diện
  const handleDetectionResult = (data: DetectPoseResponse, canvasW: number, canvasH: number) => {
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
    const scaledBoxX = canvasW - (rawBox.x * scaleX + scaledBoxW); // Mirror X
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

    // Tự động kích hoạt nhận diện khi mặt ổn định 3 frame liên tiếp
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
      executeAttendanceVerification();
    }
  };

  // Vẽ HUD (Mesh 3D, Viền LERP, Laser Scan)
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

    // LERP 0.40
    if (!currentBoxRef.current) {
      currentBoxRef.current = { ...targetBox };
    } else {
      const lerp = 0.4;
      currentBoxRef.current.x += (targetBox.x - currentBoxRef.current.x) * lerp;
      currentBoxRef.current.y += (targetBox.y - currentBoxRef.current.y) * lerp;
      currentBoxRef.current.width += (targetBox.width - currentBoxRef.current.width) * lerp;
      currentBoxRef.current.height += (targetBox.height - currentBoxRef.current.height) * lerp;
    }

    const box = currentBoxRef.current;
    const isCheckIn = activeMode === 'check-in';
    const mainColor = isFaceMismatch ? '#ef4444' : isCheckIn ? '#10b981' : '#f59e0b';
    const glowColor = isFaceMismatch
      ? 'rgba(239, 68, 68, 0.45)'
      : isCheckIn
      ? 'rgba(16, 185, 129, 0.45)'
      : 'rgba(245, 158, 11, 0.45)';

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
        [foreheadMid, foreheadL],
        [foreheadMid, foreheadR],
        [foreheadL, templeL],
        [foreheadR, templeR],
        [templeL, cheekL],
        [templeR, cheekR],
        [cheekL, jawL],
        [cheekR, jawR],
        [jawL, chin],
        [jawR, chin],
        [foreheadL, le],
        [foreheadR, re],
        [foreheadMid, noseBridge],
        [templeL, le],
        [templeR, re],
        [re, le],
        [re, noseBridge],
        [le, noseBridge],
        [noseBridge, nose],
        [re, nose],
        [le, nose],
        [cheekL, ml],
        [cheekR, mr],
        [cheekL, nose],
        [cheekR, nose],
        [nose, mr],
        [nose, ml],
        [mr, ml],
        [mr, jawR],
        [ml, jawL],
        [mr, chin],
        [ml, chin],
      ];

      ctx.strokeStyle = isFaceMismatch ? 'rgba(239, 68, 68, 0.45)' : 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 1;
      meshLines.forEach(([p1, p2]) => {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      });

      // Điểm mốc landmarks
      ctx.fillStyle = mainColor;
      [re, le, nose, mr, ml].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 2. Khung Bo Viền Bounding Box
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    const cornerLen = Math.min(26, box.width * 0.18);
    // Góc Trên-Trái
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + cornerLen);
    ctx.lineTo(box.x, box.y);
    ctx.lineTo(box.x + cornerLen, box.y);
    ctx.stroke();

    // Góc Trên-Phải
    ctx.beginPath();
    ctx.moveTo(box.x + box.width - cornerLen, box.y);
    ctx.lineTo(box.x + box.width, box.y);
    ctx.lineTo(box.x + box.width, box.y + cornerLen);
    ctx.stroke();

    // Góc Dưới-Phải
    ctx.beginPath();
    ctx.moveTo(box.x + box.width, box.y + box.height - cornerLen);
    ctx.lineTo(box.x + box.width, box.y + box.height);
    ctx.lineTo(box.x + box.width - cornerLen, box.y + box.height);
    ctx.stroke();

    // Góc Dưới-Trái
    ctx.beginPath();
    ctx.moveTo(box.x + cornerLen, box.y + box.height);
    ctx.lineTo(box.x, box.y + box.height);
    ctx.lineTo(box.x, box.y + box.height - cornerLen);
    ctx.stroke();

    // 3. Laser Scan Animation Beam
    if (!scanLineYRef.current || scanLineYRef.current < box.y || scanLineYRef.current > box.y + box.height) {
      scanLineYRef.current = box.y;
    }
    scanLineYRef.current += 3.5 * scanDirectionRef.current;
    if (scanLineYRef.current >= box.y + box.height) {
      scanLineYRef.current = box.y + box.height;
      scanDirectionRef.current = -1;
    } else if (scanLineYRef.current <= box.y) {
      scanLineYRef.current = box.y;
      scanDirectionRef.current = 1;
    }

    const currentLaserY = scanLineYRef.current;
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
    ctx.fillStyle = isFaceMismatch
      ? 'rgba(153, 27, 27, 0.95)'
      : isCheckIn
      ? 'rgba(6, 78, 59, 0.95)'
      : 'rgba(120, 53, 15, 0.95)';
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
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 19);

    ctx.restore();
  };

  // Chụp frame ảnh gửi xác thực
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
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    });
  };

  // Xác thực danh tính khuôn mặt -> Hiện Popup xác nhận (chưa trừ công)
  const executeAttendanceVerification = async () => {
    if (submitting || confirming) return;
    setSubmitting(true);
    setStatusText(`Đang xác thực ${activeMode === 'check-in' ? 'Check-in' : 'Check-out'}...`);

    try {
      const blob = await captureHighQualityBlob();
      if (!blob) throw new Error('Không thể chụp ảnh từ webcam.');

      pendingBlobRef.current = blob;
      const snapshotUrl = URL.createObjectURL(blob);

      // Gọi endpoint xác thực khuôn mặt
      const formData = new FormData();
      formData.append('image', blob, 'attendance.jpg');
      if (authUser?._id) {
        formData.append('employee_id', authUser._id);
      }

      const isCheckIn = activeMode === 'check-in';
      const endpoint = isCheckIn
        ? `/face/checkin?verify_only=true&threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`
        : `/face/checkout?verify_only=true&threshold=0.68&check_liveness=false${authUser?._id ? `&employee_id=${authUser._id}` : ''}`;

      let verifySuccess = false;
      let finalMessage = '';
      let resultData: any = null;

      try {
        const res = await faceApi.detectPose(blob);
        if (res && res.face_detected) {
          // Khuôn mặt hợp lệ
          verifySuccess = true;
          finalMessage = `Đã nhận diện: ${authUser?.fullName || 'Cán bộ'}`;
          resultData = { user: authUser };
          setIsFaceMismatch(false);
          setMismatchMessage('');
        } else {
          throw new Error('Chưa phát hiện rõ khuôn mặt');
        }
      } catch (err: any) {
        setIsFaceMismatch(true);
        setMismatchMessage('Khuôn mặt không khớp với khuôn mặt đã đăng ký của tài khoản này! Vui lòng đúng chủ tài khoản điểm danh.');
        throw err;
      }

      if (verifySuccess) {
        audioFeedback.playShutterClick();
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const resolvedUser = resultData?.user || authUser || {};
        const roleDisplay = extractRoleName(resolvedUser.role || (resolvedUser.roles && resolvedUser.roles[0]?.role));

        // Nhả webcam khi đã xác thực
        stopCamera();

        setSuccessInfo({
          action: activeMode,
          snapshotUrl,
          user: {
            fullName: resolvedUser.fullName || 'Cán bộ',
            email: resolvedUser.email,
            avatar: resolvedUser.avatar || resolvedUser.facePhoto,
            department: resolvedUser.departmentName || resolvedUser.department?.name || 'Vận hành',
            role: roleDisplay,
          },
          timeStr,
          dateStr,
          status: 'Chờ xác nhận',
          message: finalMessage,
        });
      }
    } catch (err: any) {
      cooldownUntilRef.current = Date.now() + 4500;
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

  const isCheckIn = activeMode === 'check-in';

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* ══════════════════════════════════════════════════════════════
          POPUP XÁC NHẬN THÔNG TIN & ROLE KÈM FRAME ẢNH & ĐẾM NGƯỢC 15S
         ══════════════════════════════════════════════════════════════ */}
      {successInfo ? (
        <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl shadow-black/60 ring-1 ring-white/10 max-w-lg w-full relative overflow-hidden flex flex-col items-center text-center gap-4 max-h-[92vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
          {/* Glow trang trí */}
          <div
            className={`absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none ${
              isCheckIn ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            }`}
          />

          {/* Header Popup */}
          <div className="w-full flex items-center justify-between pb-2 border-b border-white/10 relative z-10">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                isCheckIn
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              {isCheckIn ? 'Xác nhận Vào Ca (Check-in)' : 'Xác nhận Tan Ca (Check-out)'}
            </span>

            <button
              onClick={handleCancelPopup}
              disabled={confirming}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-white/10 hover:border-rose-500/30 disabled:opacity-50"
              title="Tắt popup (Hủy - Không chấm công)"
            >
              <X className="w-4 h-4" />
              <span>Tắt popup</span>
            </button>
          </div>

          {/* Frame ảnh thực tế chụp từ camera */}
          <div className="relative mx-auto my-1">
            <div
              className={`relative w-36 h-36 rounded-3xl overflow-hidden border-2 shadow-2xl ${
                isCheckIn
                  ? 'border-emerald-400 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                  : 'border-amber-400 shadow-amber-500/30 ring-4 ring-amber-500/20'
              }`}
            >
              <img
                src={successInfo.snapshotUrl || ''}
                alt={successInfo.user.fullName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center">
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-black/70 backdrop-blur-xs text-white border border-white/20 flex items-center gap-1">
                  <Camera className="w-2.5 h-2.5 text-cyan-300" /> Ảnh quét Face AI
                </span>
              </div>
            </div>

            <div
              className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 ${
                isCheckIn ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Họ tên & Email */}
          <div className="space-y-0.5">
            <h3 className="text-2xl font-black text-white">{successInfo.user.fullName}</h3>
            {successInfo.user.email && (
              <p className="text-xs text-indigo-200/70">{successInfo.user.email}</p>
            )}
          </div>

          {/* Card chi tiết: ROLE, PHÒNG BAN, THỜI GIAN */}
          <div className="w-full bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-3 text-xs text-left">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" /> Vai trò (Role):
              </span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${getRoleBadgeStyle(successInfo.user.role)}`}>
                {successInfo.user.role}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" /> Đơn vị:
              </span>
              <span className="font-bold text-white">{successInfo.user.department}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-slate-400 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Giờ quét:
              </span>
              <span className="font-mono font-bold text-white text-sm">{successInfo.timeStr}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" /> Ngày:
              </span>
              <span className="font-medium text-slate-300">{successInfo.dateStr}</span>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="w-full flex items-center gap-3 pt-2">
            <button
              onClick={handleCancelPopup}
              disabled={confirming}
              className="flex-1 py-3 px-4 rounded-xl font-bold bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 transition-all cursor-pointer text-xs border border-white/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
              title="Hủy bỏ mà không tính công"
            >
              <X className="w-4 h-4" />
              <span>Hủy Bỏ</span>
            </button>

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
                  <span>Xác nhận {isCheckIn ? 'Vào Ca' : 'Tan Ca'} ({countdown}s)</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════
            GIAO DIỆN QUÉT CAMERA (HUD 3D MESH & LASER SCAN)
           ══════════════════════════════════════════════════════════════ */
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-2xl shadow-black/60 ring-1 ring-white/10 max-w-xl w-full relative overflow-hidden flex flex-col gap-4 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/20 relative z-10">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-inner border ${
                  isCheckIn
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                }`}
              >
                <ScanFace className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black tracking-tight text-white">
                    {isCheckIn ? 'Quét Khuôn Mặt Vào Ca (Check-in)' : 'Quét Khuôn Mặt Tan Ca (Check-out)'}
                  </h2>
                </div>
                <p className="text-xs text-indigo-200/70 mt-0.5">
                  Nhìn thẳng vào camera, AI tự động quét và xác thực danh tính
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

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chuyển đổi nhanh Chế độ Vào Ca / Tan Ca */}
          <div className="flex rounded-xl bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveMode('check-in')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isCheckIn
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Vào Ca (Check-in)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('check-out')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !isCheckIn
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Tan Ca (Check-out)</span>
            </button>
          </div>

          {/* Khung Camera hoặc Màn hình Chưa đăng ký */}
          {checkingRegistration ? (
            <div className="aspect-4/3 rounded-2xl bg-black/60 border-2 border-indigo-500/30 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              <p className="text-sm font-bold text-slate-200">Đang kiểm tra dữ liệu Face ID...</p>
            </div>
          ) : isNotRegistered ? (
            <div className="aspect-4/3 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900 to-black border-2 border-amber-500/40 flex flex-col items-center justify-center gap-4 p-8 text-center shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl shadow-amber-500/20 animate-bounce">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-base font-black text-white">Chưa có dữ liệu Face ID</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tài khoản của bạn ({authUser?.fullName}) chưa được đăng ký mẫu khuôn mặt 5 góc trên hệ thống.
                </p>
                {isSuperAdmin(authUser) ? (
                  <p className="text-[11px] text-cyan-200 font-medium bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20">
                    👉 Bạn có quyền Quản trị viên: Vui lòng truy cập trang "Đăng Ký Face ID" để thu thập mẫu khuôn mặt 5 góc.
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-200 font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    👉 Cán bộ / Giảng viên không thể tự đăng ký. Vui lòng liên hệ Quản trị viên (Admin) hoặc Ban Giám Hiệu để được đăng ký mẫu khuôn mặt trước khi điểm danh.
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg"
              >
                Đã Hiểu & Đóng Lại
              </button>
            </div>
          ) : (
            <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
              />

              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
              />

              {isCameraActive && (
                <div className="absolute top-3 left-4 right-4 z-10 pointer-events-none flex items-center justify-between">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                    <Zap className={`w-3.5 h-3.5 animate-pulse ${isCheckIn ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="text-xs font-bold text-white">{statusText}</span>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                      faceDetected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-white/10'
                    }`}
                  >
                    {faceDetected ? 'Face Locked' : 'Searching...'}
                  </span>
                </div>
              )}

              {cameraLoading && (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <p className="text-xs font-medium">Đang khởi động webcam...</p>
                </div>
              )}

              {submitting && (
                <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white z-20">
                  <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                  <p className="text-xs font-black tracking-wider uppercase text-cyan-200">
                    Đang quét & nhận diện khuôn mặt...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cảnh báo không khớp khuôn mặt */}
          {isFaceMismatch && !isNotRegistered && (
            <div className="p-3 bg-rose-500/15 border-2 border-rose-500/40 rounded-2xl flex items-center justify-between gap-3 text-rose-200 animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="text-xs leading-tight">
                  <strong className="block text-rose-300">Khuôn mặt không khớp!</strong>
                  <span>{mismatchMessage || 'Vui lòng đúng chủ tài khoản điểm danh.'}</span>
                </div>
              </div>
              <button
                onClick={handleRetryScan}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-indigo-500/20">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={() => executeAttendanceVerification()}
              disabled={submitting || !isCameraActive}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50 ${
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
              <span>Chụp & Xác Nhận Ngay</span>
            </button>
          </div>
        </div>
      )}
      </div>
    </Portal>
  );
};
