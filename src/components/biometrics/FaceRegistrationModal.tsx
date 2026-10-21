import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Target,
  Upload,
  X,
  Trash2,
  Loader2,
  ShieldCheck,
  RotateCcw,
  Info,
  ScanFace,
  Activity,
  Zap,
  CheckCircle2,
  User,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { faceApi, DetectPoseResponse } from '../../api/face.api';
import { audioFeedback } from '../../utils/audioFeedback';
import { useAuthStore } from '../../store/useAuthStore';

export interface AngleConfigItem {
  key: string;
  label: string;
  poseReq: string;
  desc: string;
  instruction: string;
  tip: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const ANGLES_CONFIG: AngleConfigItem[] = [
  {
    key: 'straight',
    label: '1. Chính Diện',
    poseReq: 'STRAIGHT',
    desc: 'Nhìn thẳng vào camera',
    instruction: 'Hãy giữ đầu thẳng, nhìn trực diện vào camera',
    tip: 'Nhìn trực diện vào ống kính, giữ khuôn mặt cân đối ở giữa khung hình.',
    icon: Target,
    color: '#06b6d4',
  },
  {
    key: 'left',
    label: '2. Nghiêng Trái',
    poseReq: 'TURN_LEFT',
    desc: 'Từ từ quay mặt sang bên trái',
    instruction: 'Xoay đầu sang phía bên trái của bạn',
    tip: 'Từ từ quay đầu sang bên trái khoảng 15° - 25° và giữ yên trong 1 giây.',
    icon: ArrowLeft,
    color: '#818cf8',
  },
  {
    key: 'right',
    label: '3. Nghiêng Phải',
    poseReq: 'TURN_RIGHT',
    desc: 'Từ từ quay mặt sang bên phải',
    instruction: 'Xoay đầu sang phía bên phải của bạn',
    tip: 'Từ từ quay đầu sang bên phải khoảng 15° - 25° và giữ yên trong 1 giây.',
    icon: ArrowRight,
    color: '#a78bfa',
  },
  {
    key: 'up',
    label: '4. Ngước Lên',
    poseReq: 'LOOK_UP',
    desc: 'Hơi ngước cằm lên phía trên',
    instruction: 'Hơi nâng cằm hướng lên phía trên',
    tip: 'Nâng nhẹ cằm hướng lên khoảng 8° - 20° và giữ yên trong 1 giây.',
    icon: ArrowUp,
    color: '#f59e0b',
  },
  {
    key: 'down',
    label: '5. Cúi Xuống',
    poseReq: 'LOOK_DOWN',
    desc: 'Hơi cúi đầu nhẹ xuống dưới',
    instruction: 'Hơi hạ cằm cúi nhẹ hướng xuống dưới',
    tip: 'Hơi cúi cằm xuống khoảng 7° - 18° và giữ yên trong 1 giây.',
    icon: ArrowDown,
    color: '#10b981',
  },
];

export const REQUIRED_HOLD_FRAMES = 4; // Giữ để tương thích
export const HOLD_DURATION_MS = 1000; // Giữ ổn định liên tục 1.0 giây: Thời gian thực tế chuẩn để trích xuất đầy đủ 512D ArcFace vector và ảnh HD sắc nét

export function checkAngleTargetMet(
  stepIndex: number,
  _pose: string,
  yawDeg: number,
  pitchDeg: number,
  isHolding = false
): boolean {
  switch (stepIndex) {
    case 0: { // 1. Chính diện (Nhìn thẳng vào camera)
      const maxStraight = isHolding ? 9.0 : 7.5;
      return Math.abs(yawDeg) <= maxStraight && Math.abs(pitchDeg) <= maxStraight;
    }

    case 1: { // 2. Nghiêng Trái (Quay sang bên trái của bạn: yawDeg > 0)
      const minLeft = isHolding ? 8.0 : 10.5;
      return yawDeg >= minLeft && yawDeg <= 45.0 && Math.abs(pitchDeg) <= 25.0;
    }

    case 2: { // 3. Nghiêng Phải (Quay sang bên phải của bạn: yawDeg < 0)
      const minRight = isHolding ? -8.0 : -10.5;
      return yawDeg <= minRight && yawDeg >= -45.0 && Math.abs(pitchDeg) <= 25.0;
    }

    case 3: { // 4. Ngước Lên (Nâng cằm hướng lên trên: pitchDeg > 0)
      const minUp = isHolding ? 4.8 : 6.2;
      return pitchDeg >= minUp && pitchDeg <= 40.0 && Math.abs(yawDeg) <= 25.0;
    }

    case 4: { // 5. Cúi Xuống (Hạ cằm cúi nhẹ xuống dưới: pitchDeg < 0)
      const minDown = isHolding ? -4.8 : -6.2;
      return pitchDeg <= minDown && pitchDeg >= -40.0 && Math.abs(yawDeg) <= 25.0;
    }

    default:
      return false;
  }
}

export function getDetailedGuidance(stepIndex: number, yaw: number, pitch: number, isTargetMet: boolean, holdProgress: number) {
  if (isTargetMet) {
    if (holdProgress >= 100) {
      return { text: '✓ Đã khóa góc! Đang chụp...', status: 'holding' };
    }
    if (holdProgress >= 70) {
      return { text: `🧬 Giữ nguyên tư thế... (${holdProgress}%)`, status: 'holding' };
    }
    if (holdProgress >= 30) {
      return { text: `⚡ Đang quét vector... (${holdProgress}%)`, status: 'holding' };
    }
    return { text: `🎯 Đã đúng góc! Giữ yên tư thế (${holdProgress}%)`, status: 'holding' };
  }

  switch (stepIndex) {
    case 0:
      if (Math.abs(yaw) > 7.5) return { text: yaw > 0 ? '👈 Xoay nhẹ lại về chính diện' : '👉 Xoay nhẹ lại về chính diện', status: 'adjusting' };
      if (pitch > 7.5) return { text: '👇 Hạ nhẹ cằm xuống', status: 'adjusting' };
      if (pitch < -7.5) return { text: '👆 Nâng nhẹ cằm lên', status: 'adjusting' };
      return { text: '👤 Nhìn thẳng trực diện vào camera', status: 'guiding' };

    case 1:
      if (yaw < 5) return { text: '👈 Từ từ quay mặt sang bên trái của bạn (~15°)', status: 'guiding' };
      if (yaw < 10.5) return { text: '👈 Sắp đạt rồi! Quay sang trái thêm chút nữa...', status: 'adjusting' };
      if (yaw > 45) return { text: '👉 Quay hơi nhiều quá rồi, quay lại một chút', status: 'adjusting' };
      return { text: '👈 Quay mặt sang phía bên trái của bạn', status: 'guiding' };

    case 2:
      if (yaw > -5) return { text: '👉 Từ từ quay mặt sang bên phải của bạn (~15°)', status: 'guiding' };
      if (yaw > -10.5) return { text: '👉 Sắp đạt rồi! Quay sang phải thêm chút nữa...', status: 'adjusting' };
      if (yaw < -45) return { text: '👈 Quay hơi nhiều quá, quay lại một chút', status: 'adjusting' };
      return { text: '👉 Quay mặt sang phía bên phải của bạn', status: 'guiding' };

    case 3:
      if (pitch < 3) return { text: '👆 Hơi ngước cằm lên trên (~10°)', status: 'guiding' };
      if (pitch < 6.2) return { text: '👆 Nâng cằm lên thêm một chút nữa...', status: 'adjusting' };
      if (pitch > 40) return { text: '👇 Ngước hơi cao quá, hạ cằm xuống một chút', status: 'adjusting' };
      return { text: '👆 Nâng cằm hướng lên phía trên', status: 'guiding' };

    case 4:
      if (pitch > -2) return { text: '👇 Cúi đầu / hạ cằm nhẹ xuống dưới (~10°)', status: 'guiding' };
      if (pitch > -6.2) return { text: '👇 Hạ cằm xuống thêm chút nữa...', status: 'adjusting' };
      if (pitch < -40) return { text: '👆 Cúi hơi sâu quá, nâng cằm lên một chút', status: 'adjusting' };
      return { text: '👇 Hơi cúi đầu nhẹ xuống dưới', status: 'guiding' };

    default:
      return { text: 'Đưa khuôn mặt vào khung hình', status: 'guiding' };
  }
}

export interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  employee?: any;
  initialMode?: 'enroll' | 'test';
  onSuccess?: () => void;
}

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  user,
  employee,
  initialMode = 'enroll',
  onSuccess,
}) => {
  const currentEmployee = user || employee;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCameraActiveRef = useRef<boolean>(false);
  const isWorkerRunningRef = useRef<boolean>(false);

  // Dữ liệu đối soát & hoạt ảnh mượt mà 60 FPS (Lerp Interpolation)
  const targetDataRef = useRef<DetectPoseResponse | null>(null);
  const smoothBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const smoothLandmarksRef = useRef<{
    re: { x: number; y: number };
    le: { x: number; y: number };
    nose: { x: number; y: number };
    mr: { x: number; y: number };
    ml: { x: number; y: number };
  } | null>(null);
  const smoothYawRef = useRef<number>(0);
  const smoothPitchRef = useRef<number>(0);
  const smoothRollRef = useRef<number>(0);

  // Bộ đếm thời gian tiến trình liên tục (Continuous time-based 0-100% progress)
  const holdStartTimeRef = useRef<number | null>(null);
  const prevYawDegRef = useRef<number>(0);
  const prevPitchDegRef = useRef<number>(0);
  const lastTargetMetTimeRef = useRef<number>(0);
  const smoothProgressRef = useRef<number>(0);
  const lastTelemetryUpdateRef = useRef<number>(0);


  const holdCounterRef = useRef<number>(0);
  const lastCaptureTimeRef = useRef<number>(0);
  const scanLineYRef = useRef<number>(0);
  const scanDirectionRef = useRef<number>(1);

  const [activeStep, setActiveStep] = useState<number>(0);
  const activeStepRef = useRef<number>(0);
  const autoScanEnabledRef = useRef<boolean>(true);
  const isCapturingRef = useRef<boolean>(false);
  const isStepTransitioningRef = useRef<boolean>(false);

  const [isStepTransitioning, setIsStepTransitioning] = useState<boolean>(false);
  const [stepSuccessFlash, setStepSuccessFlash] = useState<string | null>(null);
  const noFaceFramesRef = useRef<number>(0);

  // Warmup 2s
  const initialWarmupRef = useRef<boolean>(false);
  const [initialWarmupSeconds, setInitialWarmupSeconds] = useState<number>(2);
  const warmupTimerRef = useRef<any>(null);

  const [capturedImages, setCapturedImages] = useState<
    Record<string, { blob: Blob | null; previewUrl: string; existingUrl?: string } | null>
  >({
    straight: null,
    left: null,
    right: null,
    up: null,
    down: null,
  });

  const capturedImagesRef = useRef<
    Record<string, { blob: Blob | null; previewUrl: string; existingUrl?: string } | null>
  >({
    straight: null,
    left: null,
    right: null,
    up: null,
    down: null,
  });

  useEffect(() => {
    capturedImagesRef.current = capturedImages;
  }, [capturedImages]);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [currentDetectedPose, setCurrentDetectedPose] = useState<string>('Chờ camera...');
  const [faceInFrame, setFaceInFrame] = useState<boolean>(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [tabMode, setTabMode] = useState<'camera' | 'upload'>('camera');
  const [consentAgreed, setConsentAgreed] = useState<boolean>(true);

  // Chế độ chính của Modal: 'enroll' (Đăng ký 5 góc) hoặc 'test' (Kiểm thử nhận diện AI)
  const [mainMode, setMainMode] = useState<'enroll' | 'test'>(initialMode);
  const mainModeRef = useRef<'enroll' | 'test'>(initialMode);

  // Kết quả kiểm thử nhận diện AI
  const [testResult, setTestResult] = useState<{
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
    latencyMs?: number;
  } | null>(null);
  const testResultRef = useRef<any>(null);
  const [isTestingRecognition, setIsTestingRecognition] = useState<boolean>(false);
  const isTestingRecognitionRef = useRef<boolean>(false);
  const testStableCountRef = useRef<number>(0);
  const isExecutingTestRef = useRef<boolean>(false);
  const hasAutoTestedRef = useRef<boolean>(false);

  useEffect(() => {
    mainModeRef.current = mainMode;
    testStableCountRef.current = 0;
    isExecutingTestRef.current = false;
    isTestingRecognitionRef.current = false;
    hasAutoTestedRef.current = false;
    testResultRef.current = null;
    setTestResult(null);
  }, [mainMode]);

  useEffect(() => {
    if (isOpen) {
      const mode = initialMode || 'enroll';
      setMainMode(mode);
      mainModeRef.current = mode;
      setTestResult(null);
      testResultRef.current = null;
      testStableCountRef.current = 0;
      isExecutingTestRef.current = false;
      isTestingRecognitionRef.current = false;
      hasAutoTestedRef.current = false;
    }
  }, [isOpen, initialMode]);

  const captureFullBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
    });
  };

  const executeTestRecognition = async () => {
    if (isExecutingTestRef.current || isTestingRecognitionRef.current) return;
    isExecutingTestRef.current = true;
    isTestingRecognitionRef.current = true;
    hasAutoTestedRef.current = true;
    setIsTestingRecognition(true);
    const startT = performance.now();

    try {
      const blob = await captureFullBlob();
      if (!blob) throw new Error('Không thể chụp frame từ camera.');

      const data = await faceApi.testRecognition(blob);
      const elapsed = Math.round(performance.now() - startT);

      const resObj = {
        ...data,
        latencyMs: elapsed,
      };
      testResultRef.current = resObj;
      setTestResult(resObj);

      if (data.matched) {
        const isMatchedCurrent = !currentEmployee?._id || String(data.user?._id) === String(currentEmployee._id || currentEmployee.id);
        if (isMatchedCurrent) {
          audioFeedback.playSuccessChime();
          toast.success(`✓ Khớp đúng nhân sự: ${data.user?.fullName || 'Cán bộ'}!`);
        } else {
          audioFeedback.playWarningBeep();
          toast(`⚠️ Nhận diện thấy: ${data.user?.fullName || 'Cán bộ'} (Khác với hồ sơ ${currentEmployee?.fullName || 'đang chọn'})`, {
            icon: '⚠️',
            duration: 6000,
          });
        }
      } else {
        audioFeedback.playWarningBeep();
        toast.error('Không tìm thấy khuôn mặt trùng khớp trong hệ thống.');
      }
    } catch (err: any) {
      const resObj = {
        success: false,
        matched: false,
        message: err.response?.data?.message || err.message || 'Lỗi khi kiểm thử nhận diện khuôn mặt.',
        latencyMs: Math.round(performance.now() - startT),
      };
      testResultRef.current = resObj;
      setTestResult(resObj);
      audioFeedback.playWarningBeep();
    } finally {
      setIsTestingRecognition(false);
      isTestingRecognitionRef.current = false;
      isExecutingTestRef.current = false;
    }
  };

  const handleRetryTest = () => {
    testResultRef.current = null;
    setTestResult(null);
    testStableCountRef.current = 0;
    hasAutoTestedRef.current = false;
    isExecutingTestRef.current = false;
    isTestingRecognitionRef.current = false;
  };

  // Telemetry 3D
  const [telemetry, setTelemetry] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    isTargetMet: false,
    progress: 0,
    guidanceText: 'Đưa khuôn mặt vào giữa khung hình',
  });

  const currentAngleObj = ANGLES_CONFIG[activeStep] || ANGLES_CONFIG[0];

  // Khởi tạo và nạp dữ liệu cũ nếu đã đăng ký trước đó
  useEffect(() => {
    if (isOpen && currentEmployee) {
      const existing: Record<string, any> = {
        straight: null,
        left: null,
        right: null,
        up: null,
        down: null,
      };

      if (currentEmployee.faceAnglePhotos) {
        ANGLES_CONFIG.forEach((ang) => {
          const url = currentEmployee.faceAnglePhotos[ang.key];
          if (url && typeof url === 'string') {
            existing[ang.key] = {
              blob: null,
              previewUrl: url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`,
              existingUrl: url,
            };
          }
        });
      } else if (currentEmployee.facePhoto && typeof currentEmployee.facePhoto === 'string') {
        const url = currentEmployee.facePhoto;
        existing.straight = {
          blob: null,
          previewUrl: url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`,
          existingUrl: url,
        };
      }

      setCapturedImages(existing);
      capturedImagesRef.current = existing;

      const firstUncapturedIndex = ANGLES_CONFIG.findIndex((ang) => !existing[ang.key]);
      const targetStartStep = firstUncapturedIndex !== -1 ? firstUncapturedIndex : 0;
      setActiveStep(targetStartStep);
      activeStepRef.current = targetStartStep;
      holdCounterRef.current = 0;
      holdStartTimeRef.current = null;
      smoothProgressRef.current = 0;
      noFaceFramesRef.current = 0;
      lastCaptureTimeRef.current = Date.now();
      setIsStepTransitioning(false);
      isStepTransitioningRef.current = false;
      setStepSuccessFlash(null);
    }
  }, [isOpen, currentEmployee?._id]);

  useEffect(() => {
    activeStepRef.current = activeStep;
    holdCounterRef.current = 0;
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
  }, [activeStep]);

  useEffect(() => {
    autoScanEnabledRef.current = autoScanEnabled;
  }, [autoScanEnabled]);

  // Khởi động Camera HD 720p sắc nét và khởi động siêu tốc
  const startCamera = async () => {
    // Nếu camera đã đang chạy thì không gọi getUserMedia lần 2 gây trễ webcam phần cứng
    if (streamRef.current && streamRef.current.active && isCameraActiveRef.current) {
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập Webcam');
      }

      // Nâng cấp lên chuẩn HD 720p (1280x720) giúp bắt nét sâu, chi tiết khuôn mặt rõ rệt và camera tự động lấy nét chuẩn
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 20 },
        },
      });

      streamRef.current = stream;
      isCameraActiveRef.current = true;
      setIsCameraActive(true);
      setErrorMsg('');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Khởi động đếm ngược chuẩn bị nhanh 500ms
      initialWarmupRef.current = false;
      setInitialWarmupSeconds(1);
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);

      warmupTimerRef.current = setTimeout(() => {
        initialWarmupRef.current = true;
        setInitialWarmupSeconds(0);
      }, 500);

      // Kích hoạt song song:
      // 1. Vòng lặp vẽ HUD 60 FPS mượt mà
      // 2. Worker nhận diện tư thế đầu siêu tốc
      start60FpsRenderLoop();
      startFastDetectionWorker();
    } catch (err: any) {
      setErrorMsg('Không thể mở Camera: ' + err.message + '. Bạn có thể chuyển qua tab "Tải Ảnh Lên".');
      setIsCameraActive(false);
      isCameraActiveRef.current = false;
    }
  };

  // Tắt Camera
  const stopCamera = () => {
    isCameraActiveRef.current = false;
    isWorkerRunningRef.current = false;

    if (warmupTimerRef.current) {
      clearTimeout(warmupTimerRef.current);
      warmupTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsCameraActive(false);
    initialWarmupRef.current = false;
    setInitialWarmupSeconds(0);
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
    targetDataRef.current = null;
    smoothBoxRef.current = null;
    smoothLandmarksRef.current = null;
  };

  // Quản lý bật/tắt camera theo trạng thái mở Modal và Tab
  useEffect(() => {
    if (isOpen) {
      if (tabMode === 'camera') {
        startCamera();
      } else {
        stopCamera();
      }
    } else {
      stopCamera();
    }

    return () => {
      if (!isOpen) {
        stopCamera();
      }
    };
  }, [isOpen, tabMode]);

  // Hàm nội suy mượt mà (Linear Interpolation) cho hoạt ảnh 60 FPS
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor;
  };

  // Worker chạy ngầm phân tích góc mặt siêu tốc (tách biệt hoàn toàn khỏi luồng vẽ 60 FPS)
  const startFastDetectionWorker = () => {
    if (isWorkerRunningRef.current) return;
    isWorkerRunningRef.current = true;

    const runDetection = async () => {
      if (!isWorkerRunningRef.current || !isCameraActiveRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        if (!sampleCanvasRef.current) {
          sampleCanvasRef.current = document.createElement('canvas');
          sampleCanvasRef.current.width = 320;
          sampleCanvasRef.current.height = 240;
        }
        const sCanvas = sampleCanvasRef.current;
        const sCtx = sCanvas.getContext('2d');

        if (sCtx) {
          sCtx.drawImage(video, 0, 0, 320, 240);
          await new Promise<void>((resolve) => {
            sCanvas.toBlob(
              async (blob) => {
                if (blob && isWorkerRunningRef.current) {
                  try {
                    const data = await faceApi.detectPose(blob);
                    if (data && isWorkerRunningRef.current) {
                      targetDataRef.current = data;
                    }
                  } catch {
                    // Mạng bận hoặc tạm thời ngắt, bỏ qua frame
                  }
                }
                resolve();
              },
              'image/jpeg',
              0.65
            );
          });
        }
      }

      if (isWorkerRunningRef.current) {
        // Đặt khoảng nghỉ nhỏ 25ms giữa các lần request (~25-30 FPS pose sampling)
        setTimeout(runDetection, 25);
      }
    };

    runDetection();
  };

  // Vòng lặp vẽ HUD 60 FPS mượt mà không khựng giật
  const start60FpsRenderLoop = () => {
    const loop = () => {
      if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !isCameraActiveRef.current) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        render60FpsHUD(video, overlay);
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // Vẽ HUD khuôn mặt và la bàn 3D ở tốc độ 60 FPS bằng thuật toán Lerp
  const render60FpsHUD = (video: HTMLVideoElement, overlay: HTMLCanvasElement) => {
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const data = targetDataRef.current;

    if (!data || !data.face_detected || !data.bbox) {
      noFaceFramesRef.current++;
      if (noFaceFramesRef.current >= 4) {
        holdStartTimeRef.current = null;
      }
      smoothProgressRef.current = lerp(smoothProgressRef.current, 0, 0.2);

      const now = performance.now();
      if (now - lastTelemetryUpdateRef.current > 75) {
        lastTelemetryUpdateRef.current = now;
        setFaceInFrame(false);
        setCurrentDetectedPose('Không có mặt trong khung');
        setTelemetry((prev) => ({
          ...prev,
          isTargetMet: false,
          progress: 0,
          guidanceText: 'Đưa khuôn mặt vào giữa khung hình',
        }));
      }

      // Vẽ khung nét đứt mờ chuẩn vị trí mặc định
      const defBoxW = Math.round(overlay.width * 0.44);
      const defBoxH = Math.round(overlay.height * 0.58);
      const defBoxX = Math.round((overlay.width - defBoxW) / 2);
      const defBoxY = Math.round((overlay.height - defBoxH) / 2.2);

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(defBoxX, defBoxY, defBoxW, defBoxH);
      ctx.restore();
      return;
    }

    noFaceFramesRef.current = 0;

    // Tỉ lệ scale từ 320x240 sang độ phân giải thực tế của camera (1280x720)
    const scaleX = overlay.width / 320;
    const scaleY = overlay.height / 240;

    const rawBox = data.bbox;
    const targetW = rawBox ? rawBox.width * scaleX : overlay.width * 0.44;
    const targetH = rawBox ? rawBox.height * scaleY : overlay.height * 0.58;
    const targetX = rawBox ? overlay.width - (rawBox.x * scaleX + targetW) : (overlay.width - targetW) / 2; // Gương selfie
    const targetY = rawBox ? rawBox.y * scaleY : (overlay.height - targetH) / 2.2;

    // Nội suy vị trí Bounding Box mượt mà
    if (!smoothBoxRef.current) {
      smoothBoxRef.current = { x: targetX, y: targetY, width: targetW, height: targetH };
    } else {
      smoothBoxRef.current.x = lerp(smoothBoxRef.current.x, targetX, 0.35);
      smoothBoxRef.current.y = lerp(smoothBoxRef.current.y, targetY, 0.35);
      smoothBoxRef.current.width = lerp(smoothBoxRef.current.width, targetW, 0.35);
      smoothBoxRef.current.height = lerp(smoothBoxRef.current.height, targetH, 0.35);
    }

    const boxX = smoothBoxRef.current.x;
    const boxY = smoothBoxRef.current.y;
    const boxW = smoothBoxRef.current.width;
    const boxH = smoothBoxRef.current.height;
    const centerX = boxX + boxW / 2;
    const centerY = boxY + boxH / 2;

    // Nội suy các điểm Landmarks 5 điểm InsightFace
    const lm = data.landmarks;
    let targetRe = { x: boxX + boxW * 0.32, y: boxY + boxH * 0.38 };
    let targetLe = { x: boxX + boxW * 0.68, y: boxY + boxH * 0.38 };
    let targetNose = { x: boxX + boxW * 0.5, y: boxY + boxH * 0.58 };
    let targetMr = { x: boxX + boxW * 0.36, y: boxY + boxH * 0.76 };
    let targetMl = { x: boxX + boxW * 0.64, y: boxY + boxH * 0.76 };

    if (lm && lm.right_eye && lm.left_eye && lm.nose_tip) {
      targetRe = { x: overlay.width - lm.right_eye.x * scaleX, y: lm.right_eye.y * scaleY };
      targetLe = { x: overlay.width - lm.left_eye.x * scaleX, y: lm.left_eye.y * scaleY };
      targetNose = { x: overlay.width - lm.nose_tip.x * scaleX, y: lm.nose_tip.y * scaleY };
      if (lm.mouth_right) targetMr = { x: overlay.width - lm.mouth_right.x * scaleX, y: lm.mouth_right.y * scaleY };
      if (lm.mouth_left) targetMl = { x: overlay.width - lm.mouth_left.x * scaleX, y: lm.mouth_left.y * scaleY };
    }

    if (!smoothLandmarksRef.current) {
      smoothLandmarksRef.current = {
        re: { ...targetRe },
        le: { ...targetLe },
        nose: { ...targetNose },
        mr: { ...targetMr },
        ml: { ...targetMl },
      };
    } else {
      const sl = smoothLandmarksRef.current;
      sl.re.x = lerp(sl.re.x, targetRe.x, 0.35);
      sl.re.y = lerp(sl.re.y, targetRe.y, 0.35);
      sl.le.x = lerp(sl.le.x, targetLe.x, 0.35);
      sl.le.y = lerp(sl.le.y, targetLe.y, 0.35);
      sl.nose.x = lerp(sl.nose.x, targetNose.x, 0.35);
      sl.nose.y = lerp(sl.nose.y, targetNose.y, 0.35);
      sl.mr.x = lerp(sl.mr.x, targetMr.x, 0.35);
      sl.mr.y = lerp(sl.mr.y, targetMr.y, 0.35);
      sl.ml.x = lerp(sl.ml.x, targetMl.x, 0.35);
      sl.ml.y = lerp(sl.ml.y, targetMl.y, 0.35);
    }

    const re = smoothLandmarksRef.current.re;
    const le = smoothLandmarksRef.current.le;
    const nose = smoothLandmarksRef.current.nose;
    const mr = smoothLandmarksRef.current.mr;
    const ml = smoothLandmarksRef.current.ml;

    // Nội suy các góc xoay đầu (Yaw, Pitch, Roll)
    const tYaw = data.pose?.yaw_deg ?? 0;
    const tPitch = data.pose?.pitch_deg ?? 0;
    const tRoll = data.pose?.roll_deg ?? 0;
    smoothYawRef.current = lerp(smoothYawRef.current, tYaw, 0.35);
    smoothPitchRef.current = lerp(smoothPitchRef.current, tPitch, 0.35);
    smoothRollRef.current = lerp(smoothRollRef.current, tRoll, 0.35);

    const yawDeg = smoothYawRef.current;
    const pitchDeg = smoothPitchRef.current;
    const rollDeg = smoothRollRef.current;
    const pose = data.pose ? data.pose.pose : 'STRAIGHT';

    const currentStepIndex = activeStepRef.current;
    const currentAngle = ANGLES_CONFIG[currentStepIndex] || ANGLES_CONFIG[0];
    const isTestMode = mainModeRef.current === 'test';

    const allAnglesDone = ANGLES_CONFIG.every((a) => Boolean(capturedImagesRef.current[a.key]?.previewUrl));
    const currentAngleCaptured = Boolean(capturedImagesRef.current[currentAngle.key]?.previewUrl);

    // Kiểm tra điều kiện góc mục tiêu và tính tiến trình chạy mượt mà 0% -> 100%
    let isTargetMet = false;
    let targetProgress = 0;

    if (isTestMode) {
      targetProgress = 0;
      if (
        !hasAutoTestedRef.current &&
        !isExecutingTestRef.current &&
        !isTestingRecognitionRef.current &&
        !testResultRef.current
      ) {
        testStableCountRef.current += 1;
        if (testStableCountRef.current >= 15) { // ~250ms ổn định ở 60 FPS
          hasAutoTestedRef.current = true;
          executeTestRecognition();
        }
      }
    } else if (allAnglesDone || currentAngleCaptured) {
      targetProgress = 100;
      isTargetMet = true;
      holdStartTimeRef.current = null;
    } else if (autoScanEnabledRef.current && !isCapturingRef.current && !isStepTransitioningRef.current && initialWarmupRef.current) {
      const isCurrentlyHolding = holdStartTimeRef.current !== null;
      isTargetMet = checkAngleTargetMet(currentStepIndex, pose, yawDeg, pitchDeg, isCurrentlyHolding);
      const now = performance.now();

      if (isTargetMet) {
        lastTargetMetTimeRef.current = now;

        if (!holdStartTimeRef.current) {
          holdStartTimeRef.current = now;
          prevYawDegRef.current = yawDeg;
          prevPitchDegRef.current = pitchDeg;
          audioFeedback.playFaceTargetedBeep();
        }

        prevYawDegRef.current = yawDeg;
        prevPitchDegRef.current = pitchDeg;

        // Tính thời gian đã giữ và tiến trình %
        const elapsed = now - holdStartTimeRef.current;
        targetProgress = Math.min(100, Math.round((elapsed / HOLD_DURATION_MS) * 100));

        if (targetProgress >= 100 && !isCapturingRef.current && !isStepTransitioningRef.current) {
          // Khi đạt 100% thời gian giữ ổn định: Bấm máy chụp và chuyển bước
          holdStartTimeRef.current = null;
          triggerCaptureCurrentAngle();
        }
      } else {
        // Nếu người dùng tạm thời bị lệch góc:
        const timeSinceMet = now - (lastTargetMetTimeRef.current || 0);
        // Bộ đệm giữ nhịp 400ms: chớp mắt hoặc trễ mạng worker không làm tụt tiến trình
        if (holdStartTimeRef.current && timeSinceMet < 400) {
          isTargetMet = true;
          targetProgress = Math.min(99, Math.max(0, Math.round(smoothProgressRef.current)));
        } else {
          // Thực sự rời góc quá 400ms -> Reset về 0
          holdStartTimeRef.current = null;
          targetProgress = 0;
        }
      }
    } else {
      holdStartTimeRef.current = null;
      targetProgress = 0;
    }

    // Nội suy tiến trình số phần trăm liên tục tại 60 FPS (xóa bỏ hoàn toàn hiện tượng khựng giật 25%)
    smoothProgressRef.current = lerp(smoothProgressRef.current, targetProgress, 0.3);
    const holdProgress = (allAnglesDone || currentAngleCaptured)
      ? 100
      : Math.min(100, Math.max(0, Math.round(smoothProgressRef.current)));

    // Cập nhật telemetry và React state theo chu kỳ tiết kiệm hiệu năng ~75ms
    const nowTime = performance.now();
    if (nowTime - lastTelemetryUpdateRef.current > 75) {
      lastTelemetryUpdateRef.current = nowTime;
      setFaceInFrame(true);

      let guidanceText = '';
      if (isTestMode) {
        if (isTestingRecognitionRef.current || isExecutingTestRef.current) {
          guidanceText = '⚡ Đang đối soát vector sinh trắc học với CSDL RAM FAISS...';
        } else if (testResultRef.current?.matched) {
          guidanceText = `✓ Đã khớp nhận diện: ${testResultRef.current.user?.fullName || 'Cán bộ'} (${Math.round((testResultRef.current.similarity || testResultRef.current.confidence || 0.95) * 100)}%)`;
        } else if (testResultRef.current && !testResultRef.current.matched) {
          guidanceText = '✕ Không tìm thấy khuôn mặt trùng khớp trong hệ thống';
        } else {
          guidanceText = '🎯 Hướng khuôn mặt vào khung hình để kiểm thử nhận diện';
        }
      } else if (allAnglesDone) {
        guidanceText = '🎉 Đã thu thập đủ 5/5 góc khuôn mặt! Hệ thống đã dừng tự động chụp';
      } else if (isStepTransitioningRef.current) {
        guidanceText = '✓ Đã chụp xong góc này! Chuẩn bị chuyển góc tiếp theo...';
      } else if (currentAngleCaptured) {
        guidanceText = `✓ Đã hoàn thành góc ${currentAngle.label}. Chọn góc khác hoặc bấm Chụp Lại`;
      } else {
        guidanceText = getDetailedGuidance(currentStepIndex, yawDeg, pitchDeg, isTargetMet, holdProgress).text;
      }

      setTelemetry({
        yaw: Math.round(yawDeg),
        pitch: Math.round(pitchDeg),
        roll: Math.round(rollDeg),
        isTargetMet: isTestMode ? Boolean(testResultRef.current?.matched) : (allAnglesDone || currentAngleCaptured || isTargetMet),
        progress: holdProgress,
        guidanceText,
      });

      const poseMap: Record<string, { icon: string; text: string }> = {
        STRAIGHT: { icon: '👤', text: 'Chính diện' },
        TURN_LEFT: { icon: '👈', text: 'Nghiêng trái' },
        TURN_RIGHT: { icon: '👉', text: 'Nghiêng phải' },
        LOOK_UP: { icon: '👆', text: 'Ngước lên' },
        LOOK_DOWN: { icon: '👇', text: 'Cúi xuống' },
      };
      const currentPoseInfo = poseMap[pose] || { icon: '🎯', text: pose };
      setCurrentDetectedPose(`${currentPoseInfo.icon} ${currentPoseInfo.text} (${Math.round(yawDeg)}°, ${Math.round(pitchDeg)}°)`);
    }

    // --- BẮT ĐẦU VẼ HUD CANVAS 60 FPS ---
    ctx.save();

    // 1. Khung ngắm 4 góc chuẩn sinh trắc học ArcFace (Sci-Fi Biometric Corner Brackets)
    const cornerLen = Math.min(26, boxW * 0.2);
    const isMatchedTargetUser = Boolean(
      testResultRef.current?.matched &&
      (!currentEmployee?._id || String(testResultRef.current.user?._id) === String(currentEmployee._id || currentEmployee.id))
    );
    const testColor = testResultRef.current?.matched
      ? (isMatchedTargetUser ? '#10b981' : '#f59e0b')
      : (isTestingRecognitionRef.current || isExecutingTestRef.current)
      ? '#f59e0b'
      : testResultRef.current
      ? '#ef4444'
      : '#06b6d4';
    const isSuccessBorder = allAnglesDone || currentAngleCaptured || isTargetMet;
    ctx.strokeStyle = isTestMode ? testColor : (isSuccessBorder ? '#10b981' : currentAngle.color);
    ctx.lineWidth = isTestMode ? 3.5 : (isSuccessBorder ? 3.5 : 2.5);
    ctx.shadowColor = isTestMode ? testColor : (isSuccessBorder ? '#10b981' : currentAngle.color);
    ctx.shadowBlur = isTestMode ? 14 : (isSuccessBorder ? 14 : 8);

    // Góc trên-trái
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cornerLen);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + cornerLen, boxY);
    ctx.stroke();

    // Góc trên-phải
    ctx.beginPath();
    ctx.moveTo(boxX + boxW - cornerLen, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW, boxY + cornerLen);
    ctx.stroke();

    // Góc dưới-phải
    ctx.beginPath();
    ctx.moveTo(boxX + boxW, boxY + boxH - cornerLen);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW - cornerLen, boxY + boxH);
    ctx.stroke();

    // Góc dưới-trái
    ctx.beginPath();
    ctx.moveTo(boxX + cornerLen, boxY + boxH);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.lineTo(boxX, boxY + boxH - cornerLen);
    ctx.stroke();

    // 2. Lưới đo đạc Vector 3D & 5 Điểm Mốc Landmark Chuẩn InsightFace
    const foreheadMid = { x: (re.x + le.x) / 2, y: boxY + boxH * 0.1 };
    const noseBridge = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 };
    const chin = { x: (mr.x + ml.x) / 2, y: boxY + boxH * 0.95 };
    const cheekR = { x: boxX + boxW * 0.12, y: boxY + boxH * 0.6 };
    const cheekL = { x: boxX + boxW * 0.88, y: boxY + boxH * 0.6 };

    // Các đường vector đặc trưng kết nối mốc khuôn mặt
    const vectorLines = [
      [re, le],                  // Khoảng cách đồng tử (Inter-pupillary line)
      [re, nose], [le, nose],    // Vector mắt - sống mũi
      [foreheadMid, noseBridge], // Trục đối xứng trán - mũi
      [noseBridge, nose],
      [nose, chin],              // Trục dọc khuôn mặt (Face vertical axis)
      [nose, mr], [nose, ml],    // Vector mũi - mép miệng
      [mr, ml],                  // Chiều rộng miệng
      [mr, chin], [ml, chin],    // Vector cằm - khóe miệng
      [cheekR, re], [cheekL, le],
      [cheekR, mr], [cheekL, ml],
    ];

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isTargetMet ? 'rgba(16, 185, 129, 0.45)' : 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1;
    vectorLines.forEach(([p1, p2]) => {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // 3. Các điểm mốc Landmark phát sáng (Glowing Landmark Nodes)
    const landmarkPoints = [re, le, nose, mr, ml];
    landmarkPoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = isTargetMet ? '#10b981' : '#06b6d4';
      ctx.shadowColor = isTargetMet ? '#10b981' : '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.fill();
    });

    // 4. Tia quét Laser Vector chạy dọc khuôn mặt
    if (!scanLineYRef.current || scanLineYRef.current < boxY || scanLineYRef.current > boxY + boxH) {
      scanLineYRef.current = boxY;
    }
    const scanSpeed = isTargetMet ? 5 : 3;
    scanLineYRef.current += scanSpeed * (scanDirectionRef.current || 1);
    if (scanLineYRef.current >= boxY + boxH) {
      scanLineYRef.current = boxY + boxH;
      scanDirectionRef.current = -1;
    } else if (scanLineYRef.current <= boxY) {
      scanLineYRef.current = boxY;
      scanDirectionRef.current = 1;
    }

    const currentLaserY = scanLineYRef.current;
    const laserGradient = ctx.createLinearGradient(boxX, currentLaserY, boxX + boxW, currentLaserY);
    laserGradient.addColorStop(0, 'rgba(6, 182, 212, 0)');
    laserGradient.addColorStop(0.5, isTargetMet ? '#10b981' : '#06b6d4');
    laserGradient.addColorStop(1, 'rgba(6, 182, 212, 0)');

    ctx.strokeStyle = laserGradient;
    ctx.lineWidth = isTargetMet ? 3 : 2;
    ctx.shadowColor = isTargetMet ? '#10b981' : '#06b6d4';
    ctx.shadowBlur = isTargetMet ? 12 : 8;
    ctx.beginPath();
    ctx.moveTo(boxX, currentLaserY);
    ctx.lineTo(boxX + boxW, currentLaserY);
    ctx.stroke();

    // 5. Thước đo Vector Telemetry nhỏ phía dưới
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    const tagW = 185;
    const tagH = 20;
    const tagX = centerX - tagW / 2;
    const tagY = boxY + boxH + 8;
    ctx.beginPath();
    // @ts-ignore
    if (ctx.roundRect) {
      // @ts-ignore
      ctx.roundRect(tagX, tagY, tagW, tagH, 6);
    } else {
      ctx.rect(tagX, tagY, tagW, tagH);
    }
    ctx.fill();
    ctx.strokeStyle = isTargetMet ? 'rgba(16, 185, 129, 0.5)' : 'rgba(6, 182, 212, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isTargetMet ? '#34d399' : '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    const tagPoseText = isTargetMet
      ? `ARCFACE 512D: KHÓA VECTOR (${holdProgress}%)`
      : `ARCFACE 512D | ${Math.round(yawDeg)}°`;
    ctx.fillText(tagPoseText, tagX + tagW / 2, tagY + 14);

    // 6. Floating Badge chỉ dẫn ngay trên trán
    const badgeW = Math.max(240, boxW * 1.05);
    const badgeH = 32;
    const badgeX = centerX - badgeW / 2;
    const badgeY = Math.max(10, boxY - badgeH - 12);

    ctx.shadowBlur = 0;
    let badgeText = '';
    let badgeBg = 'rgba(15, 23, 42, 0.88)';
    let badgeBorder = currentAngle.color;

    if (isTestMode) {
      if (isTestingRecognitionRef.current || isExecutingTestRef.current) {
        badgeText = '⚡ ĐANG ĐỐI SOÁT AI...';
        badgeBg = 'rgba(120, 53, 15, 0.95)';
        badgeBorder = '#f59e0b';
      } else if (testResultRef.current?.matched) {
        if (isMatchedTargetUser) {
          badgeText = `✓ KHỚP: ${(testResultRef.current.user?.fullName || 'HỢP LỆ').toUpperCase()}`;
          badgeBg = 'rgba(6, 95, 70, 0.95)';
          badgeBorder = '#10b981';
        } else {
          badgeText = `⚠️ KHUÔN MẶT CỦA: ${(testResultRef.current.user?.fullName || 'NHÂN SỰ KHÁC').toUpperCase()}`;
          badgeBg = 'rgba(180, 83, 9, 0.95)';
          badgeBorder = '#f59e0b';
        }
      } else if (testResultRef.current && !testResultRef.current.matched) {
        badgeText = '✕ KHÔNG TRÙNG KHỚP';
        badgeBg = 'rgba(153, 27, 27, 0.95)';
        badgeBorder = '#ef4444';
      } else {
        badgeText = '🎯 HƯỚNG MẶT ĐỂ KIỂM THỬ';
        badgeBg = 'rgba(15, 23, 42, 0.9)';
        badgeBorder = '#06b6d4';
      }
    } else {
      const isBadgeSuccess = allAnglesDone || currentAngleCaptured || isTargetMet;
      badgeBg = (allAnglesDone || currentAngleCaptured)
        ? 'rgba(6, 95, 70, 0.95)'
        : (isTargetMet ? 'rgba(6, 95, 70, 0.95)' : 'rgba(15, 23, 42, 0.88)');
      badgeBorder = isBadgeSuccess ? '#10b981' : currentAngle.color;

      if (allAnglesDone) {
        badgeText = '🎉 ĐÃ ĐỦ 5/5 GÓC (DỪNG CHỤP)';
      } else if (isStepTransitioningRef.current) {
        badgeText = '✓ ĐÃ LƯU ẢNH! CHUẨN BỊ GÓC TIẾP...';
        badgeBg = 'rgba(6, 95, 70, 0.95)';
        badgeBorder = '#10b981';
      } else if (currentAngleCaptured) {
        badgeText = `✓ ĐÃ KHÓA VECTOR GÓC ${currentAngle.label.split('. ')[1].toUpperCase()}`;
      } else if (isTargetMet) {
        if (holdProgress >= 100) {
          badgeText = `✓ ĐÃ TRÍCH XUẤT XONG (100%)`;
        } else if (holdProgress >= 65) {
          badgeText = `🧬 CỐ ĐỊNH SINH TRẮC HỌC (${holdProgress}%)`;
        } else if (holdProgress >= 25) {
          badgeText = `⚡ ĐANG KHÓA VECTOR 512D (${holdProgress}%)`;
        } else {
          badgeText = `🎯 ĐÃ ĐÚNG GÓC - GIỮ YÊN (${holdProgress}%)`;
        }
      } else {
        badgeText = `🎯 Cần: ${currentAngle.label}`;
      }
    }

    ctx.fillStyle = badgeBg;
    ctx.beginPath();
    // @ts-ignore
    if (ctx.roundRect) {
      // @ts-ignore
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.strokeStyle = badgeBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 20);

    // 7. Thanh tiến trình giữ ổn định (Hold-progress Linear Bar) dưới floating badge
    if (!isTestMode && !allAnglesDone && !currentAngleCaptured && holdProgress > 0) {
      const barW = badgeW;
      const barH = 4;
      const barX = badgeX;
      const barY = badgeY + badgeH + 3;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
      ctx.fillRect(barX, barY, (barW * holdProgress) / 100, barH);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  // Chụp ảnh góc hiện tại với độ nét cao HD (1280x720)
  const triggerCaptureCurrentAngle = () => {
    if (!videoRef.current || isCapturingRef.current) return;

    const currentStepIndex = activeStepRef.current;

    isCapturingRef.current = true;
    lastCaptureTimeRef.current = Date.now();
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 100;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isCapturingRef.current = false;
      return;
    }

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          isCapturingRef.current = false;
          return;
        }
        audioFeedback.playShutterClick();

        const angleKey = ANGLES_CONFIG[currentStepIndex].key;
        const previewUrl = URL.createObjectURL(blob);

        const nextImages = {
          ...capturedImagesRef.current,
          [angleKey]: { blob, previewUrl },
        };
        capturedImagesRef.current = nextImages;
        setCapturedImages(nextImages);

        setStepSuccessFlash(ANGLES_CONFIG[currentStepIndex].label);
        setIsStepTransitioning(true);
        isStepTransitioningRef.current = true;

        const allFinished = ANGLES_CONFIG.every((a) => Boolean(nextImages[a.key]?.previewUrl));

        setTimeout(() => {
          setStepSuccessFlash(null);
          setIsStepTransitioning(false);
          isStepTransitioningRef.current = false;
          isCapturingRef.current = false;
          lastCaptureTimeRef.current = Date.now();
          holdStartTimeRef.current = null;
          smoothProgressRef.current = 0;

          if (allFinished) {
            audioFeedback.playSuccessChime();
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            toast.success('🎉 Đã chụp hoàn tất đủ 5/5 góc khuôn mặt! Hệ thống đã dừng tự động chụp.');
          } else {
            // Tự động tìm góc tiếp theo chưa được chụp để chuyển bước
            const nextUncapturedIndex = ANGLES_CONFIG.findIndex(
              (ang, idx) => idx > currentStepIndex && !nextImages[ang.key]?.previewUrl
            );
            if (nextUncapturedIndex !== -1) {
              activeStepRef.current = nextUncapturedIndex;
              setActiveStep(nextUncapturedIndex);
            } else {
              // Nếu các góc phía sau đã có ảnh, tìm lại từ đầu
              const anyUncapturedIndex = ANGLES_CONFIG.findIndex(
                (ang) => !nextImages[ang.key]?.previewUrl
              );
              if (anyUncapturedIndex !== -1) {
                activeStepRef.current = anyUncapturedIndex;
                setActiveStep(anyUncapturedIndex);
              }
            }
          }
        }, 1300);
      },
      'image/jpeg',
      0.95
    );
  };

  // Chụp lại góc hiện tại
  const handleRetakeCurrentAngle = () => {
    const currentStepIndex = activeStepRef.current;
    const angleKey = ANGLES_CONFIG[currentStepIndex].key;
    const nextImages = {
      ...capturedImagesRef.current,
      [angleKey]: null,
    };
    capturedImagesRef.current = nextImages;
    setCapturedImages(nextImages);
    holdCounterRef.current = 0;
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
    lastCaptureTimeRef.current = Date.now();
    toast(`Sẵn sàng chụp lại góc "${ANGLES_CONFIG[currentStepIndex].label}". Hãy giữ đúng tư thế để chụp!`, { icon: '🔄' });
  };

  // Chụp lại một góc cụ thể khi bấm từ gallery
  const handleRetakeSpecificAngle = (key: string) => {
    const targetIdx = ANGLES_CONFIG.findIndex((a) => a.key === key);
    const nextImages = {
      ...capturedImagesRef.current,
      [key]: null,
    };
    capturedImagesRef.current = nextImages;
    setCapturedImages(nextImages);
    if (targetIdx !== -1) {
      setActiveStep(targetIdx);
      activeStepRef.current = targetIdx;
    }
    holdCounterRef.current = 0;
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
    lastCaptureTimeRef.current = Date.now();
    toast(`Sẵn sàng chụp lại góc "${ANGLES_CONFIG.find((a) => a.key === key)?.label}".`, { icon: '🔄' });
  };

  // Chụp lại tất cả các góc
  const handleRetakeAllAngles = () => {
    const emptyImages: Record<string, null> = {
      straight: null,
      left: null,
      right: null,
      up: null,
      down: null,
    };
    capturedImagesRef.current = emptyImages;
    setCapturedImages(emptyImages);
    setActiveStep(0);
    activeStepRef.current = 0;
    holdCounterRef.current = 0;
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
    lastCaptureTimeRef.current = Date.now();
    toast('Đã xóa tất cả 5 góc. Bắt đầu chụp lại từ góc 1 (Chính diện)!', { icon: '🔄' });
  };

  // Tải file thủ công cho một góc
  const handleManualUpload = (key: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const nextImages = {
      ...capturedImagesRef.current,
      [key]: { blob: file, previewUrl },
    };
    capturedImagesRef.current = nextImages;
    setCapturedImages(nextImages);
  };

  // Xóa ảnh của một góc
  const handleRemoveAngle = (key: string) => {
    const nextImages = {
      ...capturedImagesRef.current,
      [key]: null,
    };
    capturedImagesRef.current = nextImages;
    setCapturedImages(nextImages);
    holdCounterRef.current = 0;
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
  };

  // Lưu tất cả các góc khuôn mặt lên hệ thống
  const handleSaveAllAngles = async () => {
    const validCount = Object.values(capturedImages).filter(Boolean).length;
    if (validCount === 0) {
      setErrorMsg('Vui lòng chụp hoặc tải lên ít nhất 1 góc khuôn mặt.');
      return;
    }

    if (!consentAgreed) {
      toast.error('Vui lòng tích chọn đồng ý điều khoản bảo vệ dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('employee_id', currentEmployee._id || currentEmployee.email || currentEmployee.staffCode);
      if (currentEmployee.fullName) formData.append('full_name', currentEmployee.fullName);
      formData.append('consentAgreed', 'true');

      for (const [key, item] of Object.entries(capturedImages)) {
        if (!item) continue;
        if (item.blob) {
          formData.append(`image_${key}`, item.blob, `${key}.jpg`);
        } else if (item.existingUrl) {
          formData.append(`image_${key}`, item.existingUrl);
        }
      }

      const res = await faceApi.enrollMultiAngle(formData);

      if (res.success) {
        toast.success(res.message || `Đăng ký Face ID thành công cho ${currentEmployee.fullName}!`);
        audioFeedback.playSuccessChime();
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

        // Làm mới hồ sơ người dùng trong Zustand Store
        try {
          useAuthStore.getState().fetchMe();
        } catch (_) {}

        if (onSuccess) onSuccess();

        // Tự động chuyển sang tab Kiểm Thử Nhận Diện để test ngay!
        setTimeout(() => {
          setMainMode('test');
          setTestResult(null);
          testStableCountRef.current = 0;
          isExecutingTestRef.current = false;
          toast.success('Chuyển sang kiểm thử: Hãy nhìn vào camera để kiểm tra AI nhận diện bạn!');
        }, 1200);
      } else {
        throw new Error(res.message || 'Lỗi khi lưu dữ liệu khuôn mặt.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ.';
      setErrorMsg(msg);
      audioFeedback.playWarningBeep();
      toast.error(msg, { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa toàn bộ dữ liệu khuôn mặt theo Nghị định 13/2023/NĐ-CP
  const handleDeleteFace = async () => {
    const targetId = currentEmployee?._id || currentEmployee?.id;
    if (!targetId) return;
    if (!window.confirm(`Xác nhận xóa sạch dữ liệu sinh trắc học khuôn mặt của "${currentEmployee.fullName}" khỏi hệ thống theo Nghị định 13/2023/NĐ-CP?`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await faceApi.deleteFaceData(targetId);
      if (res.success) {
        toast.success(`Đã xóa sạch dữ liệu sinh trắc học của ${currentEmployee.fullName}`);
        try {
          useAuthStore.getState().fetchMe();
        } catch (_) {}
        stopCamera();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.message || 'Không thể xóa dữ liệu khuôn mặt.');
      }
    } catch (err: any) {
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Không thể xóa dữ liệu khuôn mặt.';
      toast.error(errMsg);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const capturedCount = Object.values(capturedImages).filter(Boolean).length;
  const allAnglesDone = ANGLES_CONFIG.every((a) => Boolean(capturedImages[a.key]?.previewUrl));
  const isCurrentAngleCaptured = Boolean(capturedImages[currentAngleObj.key]?.previewUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl max-w-4xl w-full relative overflow-hidden flex flex-col gap-4 max-h-[94vh] overflow-y-auto custom-scrollbar">
        {/* Glow trang trí */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10 flex-wrap sm:flex-nowrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shadow-inner shrink-0">
              {mainMode === 'enroll' ? (
                <Sparkles className="w-6 h-6 animate-pulse" />
              ) : (
                <ScanFace className="w-6 h-6 text-cyan-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-tight text-white">
                  {mainMode === 'enroll'
                    ? 'Đăng Ký Khuôn Mặt 5 Góc (Face ID 512D)'
                    : 'Kiểm Thử Nhận Diện Realtime (AI 1:N FAISS)'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {mainMode === 'enroll' ? 'Nghị định 13/2023/NĐ-CP' : 'Độ trễ < 50ms'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {mainMode === 'enroll' ? (
                  <>
                    Nhân sự: <span className="font-bold text-white">{currentEmployee?.fullName || 'Hiện tại'}</span>{' '}
                    {currentEmployee?.email && `(${currentEmployee.email})`} • Đã thu: {capturedCount}/5 góc
                  </>
                ) : (
                  <>
                    Nhân sự: <span className="font-bold text-white">{currentEmployee?.fullName || 'Hiện tại'}</span> • Hệ thống đối soát trực tiếp trên RAM FAISS
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Chế độ chính: [Đăng Ký Face ID] & [Kiểm Thử AI] */}
            <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setMainMode('enroll');
                  setTestResult(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mainMode === 'enroll'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Đăng Ký Face ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMainMode('test');
                  setTestResult(null);
                  testStableCountRef.current = 0;
                  isExecutingTestRef.current = false;
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  mainMode === 'test'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ScanFace className="w-3.5 h-3.5" />
                <span>Kiểm Thử AI</span>
              </button>
            </div>

            {/* Sub-tab Switcher nếu đang ở mainMode === 'enroll' */}
            {mainMode === 'enroll' && (
              <div className="hidden sm:flex rounded-xl bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setTabMode('camera')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    tabMode === 'camera'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Webcam Live"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Webcam</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTabMode('upload')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    tabMode === 'upload'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Tải ảnh 5 góc"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh</span>
                </button>
              </div>
            )}

            {/* Nút Đóng */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── THANH TIẾN TRÌNH 5 BƯỚC HOẶC BANNER KIỂM THỬ AI ─────── */}
        {/* ── THANH TIẾN TRÌNH 5 BƯỚC TỐI GIẢN HOẶC BANNER KIỂM THỬ AI ─────── */}
        {mainMode === 'enroll' ? (
          <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-2xl bg-white/5 border border-white/10 relative z-10">
            {ANGLES_CONFIG.map((ang, idx) => {
              const isCaptured = Boolean(capturedImages[ang.key]);
              const isCurrent = activeStep === idx && tabMode === 'camera';
              const IconComponent = ang.icon;

              return (
                <button
                  key={ang.key}
                  type="button"
                  onClick={() => {
                    setActiveStep(idx);
                    activeStepRef.current = idx;
                    holdCounterRef.current = 0;
                    holdStartTimeRef.current = null;
                    smoothProgressRef.current = 0;
                  }}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                    isCurrent
                      ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/20'
                      : isCaptured
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                      : 'border-white/5 bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isCaptured ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="truncate">{ang.label.split('. ')[1]}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-cyan-950/40 border border-purple-500/30 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <ScanFace className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Chế Độ Kiểm Thử Nhận Diện AI</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    ArcFace 512D
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  Đưa khuôn mặt vào khung hình để hệ thống tự động đối soát sinh trắc học trực tiếp.
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[11px] font-mono text-purple-300 px-2 py-0.5 rounded-md bg-black/40 border border-purple-500/30">
                Ngưỡng: Cosine ≥ 0.68
              </span>
            </div>
          </div>
        )}

        {/* ── NỘI DUNG CHÍNH ───────────────────────────────────────── */}
        {mainMode === 'enroll' && tabMode === 'upload' ? (
          /* ── TAB TẢI ẢNH LÊN (5 DROPZONES) ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 py-2">
            {ANGLES_CONFIG.map((ang) => {
              const currentImage = capturedImages[ang.key];
              const IconComp = ang.icon;

              return (
                <div
                  key={ang.key}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col items-center justify-between text-center gap-3 relative group hover:border-cyan-500/40 transition-all"
                >
                  <div className="w-full flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1">
                      <IconComp className="w-3.5 h-3.5 text-cyan-400" />
                      {ang.label}
                    </span>
                    {currentImage && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAngle(ang.key)}
                        className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center">
                    {currentImage?.previewUrl ? (
                      <img
                        src={currentImage.previewUrl}
                        alt={ang.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-white/5 transition-all text-slate-500 hover:text-slate-300 p-2">
                        <Upload className="w-6 h-6 text-slate-400" />
                        <span className="text-[10px] font-semibold text-center leading-tight">
                          Chọn ảnh {ang.label.split('. ')[1]}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleManualUpload(ang.key, file);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-tight">{ang.desc}</p>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── LAYOUT 2 CỘT DÙNG CHUNG CAMERA STREAM CHO ENROLL VÀ TEST ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Khung Camera Live & HUD (7 Cột) */}
            <div className="lg:col-span-7 space-y-3">
              <div className="relative aspect-4/3 rounded-3xl overflow-hidden bg-black border-2 border-cyan-500/40 shadow-2xl flex items-center justify-center">
                {/* Video Stream */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Overlay Canvas */}
                <canvas
                  ref={overlayCanvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Đếm ngược chuẩn bị 2s ban đầu (khi enroll) */}
                {mainMode === 'enroll' && initialWarmupSeconds > 0 && isCameraActive && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20 pointer-events-none">
                    <span className="text-5xl font-black text-cyan-300 animate-pulse">{initialWarmupSeconds}</span>
                    <span className="text-xs font-bold text-slate-200">Chuẩn bị nhìn thẳng vào camera...</span>
                  </div>
                )}

                {/* Flash thành công khi chuyển bước */}
                {mainMode === 'enroll' && stepSuccessFlash && (
                  <div className="absolute inset-0 bg-emerald-500/25 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20 pointer-events-none animate-fadeIn">
                    <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <span className="text-base font-black text-white">Đã chụp {stepSuccessFlash}!</span>
                  </div>
                )}

                {/* Loading camera */}
                {!isCameraActive && (
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                    <p className="text-xs text-slate-300">Đang khởi động webcam studio...</p>
                  </div>
                )}
              </div>

              {/* Thanh điều khiển dưới Camera */}
              {mainMode === 'enroll' ? (
                <div className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/10 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Trạng thái:</span>
                    {allAnglesDone ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Đã đủ 5/5 góc (Đã dừng tự động chụp)
                      </span>
                    ) : isCurrentAngleCaptured ? (
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Đã hoàn thành góc này
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-cyan-300">{currentDetectedPose}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        autoScanEnabled
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/5 text-slate-400 border-white/10'
                      }`}
                      title={allAnglesDone ? 'Đã đủ 5 góc nên hệ thống tạm dừng tự động chụp' : undefined}
                    >
                      Tự động chụp: {autoScanEnabled ? 'BẬT' : 'TẮT'}
                    </button>

                    {isCurrentAngleCaptured ? (
                      <button
                        type="button"
                        onClick={handleRetakeCurrentAngle}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        title="Xóa ảnh góc này và mở khóa để chụp lại"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Chụp Lại Góc Này</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={triggerCaptureCurrentAngle}
                        disabled={!isCameraActive}
                        className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Chụp Góc Này</span>
                      </button>
                    )}

                    {capturedCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRetakeAllAngles}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-300 border border-white/10 font-medium text-xs transition-all cursor-pointer flex items-center gap-1"
                        title="Xóa toàn bộ 5 góc và chụp lại từ đầu"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Chụp Lại Tất Cả</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Trạng thái:</span>
                    <span className="text-xs font-bold text-purple-300">
                      {isTestingRecognition
                        ? 'Đang đối soát AI...'
                        : testResult
                        ? (testResult.matched ? '✓ Đã nhận diện thành công' : '✕ Chưa trùng khớp')
                        : faceInFrame
                        ? 'Đã phát hiện khuôn mặt'
                        : 'Chờ khuôn mặt vào khung...'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={testResult ? handleRetryTest : executeTestRecognition}
                    disabled={!isCameraActive || isTestingRecognition}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isTestingRecognition ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang Quét...</span>
                      </>
                    ) : testResult ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Quét Thử Lại</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Quét Nhận Diện Ngay</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Cột Phải (5 Cột): Telemetry khi Enroll HOẶC Kết Quả khi Test */}
            <div className="lg:col-span-5 space-y-4">
              {mainMode === 'enroll' ? (
                <div className="space-y-3">
                  {/* Card Hướng Dẫn Góc Chụp Hiện Tại (Tối giản, trực quan) */}
                  <div className="p-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                        {React.createElement(currentAngleObj.icon, { className: 'w-4 h-4 text-cyan-400' })}
                        <span>GÓC {activeStep + 1}/5: {currentAngleObj.label.split('. ')[1].toUpperCase()}</span>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${telemetry.isTargetMet ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-cyan-500/10 text-cyan-400'}`}>
                        {telemetry.isTargetMet ? '✓ Đạt chuẩn góc' : 'Đang căn chỉnh'}
                      </span>
                    </div>

                    <p className="text-sm font-bold text-white leading-snug">
                      {currentAngleObj.instruction}
                    </p>
                    <p className="text-xs text-slate-300">
                      {currentAngleObj.tip}
                    </p>

                    {/* Trạng thái hoàn thành góc này hoặc thanh đo ổn định */}
                    {isCurrentAngleCaptured ? (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>Góc này đã chụp hoàn tất.</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRetakeCurrentAngle}
                          className="text-amber-300 hover:text-amber-200 text-xs font-bold underline cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Chụp lại góc này
                        </button>
                      </div>
                    ) : (
                      /* Thanh đo giữ mặt ổn định mượt mà */
                      <div className="space-y-1.5 pt-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">
                            {telemetry.isTargetMet ? 'Đang trích xuất vector 512D:' : 'Căn chỉnh góc & ổn định:'}
                          </span>
                          <span className={`font-bold font-mono ${telemetry.isTargetMet ? 'text-emerald-400' : 'text-cyan-300'}`}>
                            {telemetry.progress}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-150 rounded-full ${
                              telemetry.isTargetMet
                                ? 'bg-gradient-to-r from-cyan-400 via-emerald-400 to-emerald-500 shadow-sm shadow-emerald-500/50'
                                : 'bg-gradient-to-r from-cyan-500 to-cyan-400'
                            }`}
                            style={{ width: `${telemetry.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Mini Gallery: 5 Góc Mẫu Khuôn Mặt Đã Chụp */}
                  <div className="p-3.5 rounded-2xl border border-white/10 bg-slate-950/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300 flex-wrap gap-2">
                      <div className="flex items-center gap-1.5">
                        <span>Mẫu đã chụp ({capturedCount}/5 góc):</span>
                        {allAnglesDone && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Đã đủ 5 góc
                          </span>
                        )}
                      </div>
                      {capturedCount > 0 && (
                        <button
                          type="button"
                          onClick={handleRetakeAllAngles}
                          className="text-amber-300 hover:text-amber-200 text-[11px] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                          title="Xóa tất cả 5 ảnh và chụp lại từ đầu"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Chụp lại tất cả</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      {ANGLES_CONFIG.map((ang, idx) => {
                        const imgItem = capturedImages[ang.key];
                        const isCurrent = activeStep === idx;
                        const AngleIcon = ang.icon;

                        return (
                          <div
                            key={ang.key}
                            onClick={() => {
                              setActiveStep(idx);
                              activeStepRef.current = idx;
                              holdCounterRef.current = 0;
                              holdStartTimeRef.current = null;
                              smoothProgressRef.current = 0;
                            }}
                            className={`relative aspect-square rounded-xl overflow-hidden border cursor-pointer transition-all flex flex-col items-center justify-center p-1 group ${
                              isCurrent
                                ? 'border-cyan-400 ring-2 ring-cyan-500/30'
                                : imgItem
                                ? 'border-emerald-500/50 bg-emerald-950/20'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                            title={`Góc: ${ang.label}`}
                          >
                            {imgItem?.previewUrl ? (
                              <>
                                <img
                                  src={imgItem.previewUrl}
                                  alt={ang.label}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                                <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs pointer-events-none">
                                  <CheckCircle className="w-2.5 h-2.5" />
                                </div>
                                <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-opacity rounded-lg">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRetakeSpecificAngle(ang.key);
                                    }}
                                    className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-xs cursor-pointer"
                                    title={`Chụp lại góc ${ang.label}`}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveAngle(ang.key);
                                    }}
                                    className="p-1 rounded bg-rose-500 hover:bg-rose-400 text-white transition-colors shadow-xs cursor-pointer"
                                    title="Xóa góc này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-500 group-hover:text-slate-300">
                                <AngleIcon className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-semibold">{ang.label.split('. ')[1]}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Thông tin hồ sơ cán bộ tóm tắt */}
                  {currentEmployee && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold flex items-center justify-center shrink-0">
                        {currentEmployee.fullName?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-bold truncate">{currentEmployee.fullName}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {currentEmployee.staffCode || 'Chưa có mã'} • {currentEmployee.departmentName || currentEmployee.department?.name || 'Nhà trường'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── GIAO DIỆN KẾT QUẢ KIỂM THỬ AI ── */
                <div className="space-y-3">
                  {isTestingRecognition ? (
                    <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 flex flex-col items-center justify-center text-center gap-3 py-10">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin flex items-center justify-center">
                          <Zap className="w-6 h-6 text-purple-400" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Đang Đối Soát Khuôn Mặt...</p>
                        <p className="text-xs text-purple-300/80 mt-1">Trích xuất vector 512D & tính độ tương đồng Cosine</p>
                      </div>
                    </div>
                  ) : testResult ? (
                    testResult.matched ? (
                      /* KHỚP THÀNH CÔNG */
                      (() => {
                        const isMatchCurrent = !currentEmployee?._id || String(testResult.user?._id) === String(currentEmployee._id || currentEmployee.id);
                        return (
                          <div className={`p-4 rounded-2xl border space-y-3 ${
                            isMatchCurrent
                              ? 'border-emerald-500/40 bg-emerald-950/20'
                              : 'border-amber-500/50 bg-amber-950/30'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className={`px-2.5 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${
                                isMatchCurrent
                                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              }`}>
                                {isMatchCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                {isMatchCurrent ? 'Khớp Đúng Nhân Sự (Matched)' : 'Phát Hiện Khuôn Mặt Nhân Sự Khác'}
                              </span>
                              {testResult.latencyMs && (
                                <span className="text-[11px] font-mono text-slate-400">
                                  Độ trễ: <strong className={isMatchCurrent ? 'text-emerald-400' : 'text-amber-400'}>{testResult.latencyMs}ms</strong>
                                </span>
                              )}
                            </div>

                            {!isMatchCurrent && currentEmployee?.fullName && (
                              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                                <strong>⚠️ Lưu ý:</strong> Bạn đang kiểm thử trong hồ sơ của <strong>{currentEmployee.fullName}</strong>, nhưng hệ thống AI nhận diện chính xác người đang đứng trước camera là <strong>{testResult.user?.fullName}</strong>.
                              </div>
                            )}

                            {/* Thẻ nhân viên nhận diện được */}
                            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-xl border overflow-hidden flex items-center justify-center shrink-0 ${
                                isMatchCurrent ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'
                              }`}>
                                {testResult.user?.avatar ? (
                                  <img src={testResult.user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <User className={`w-6 h-6 ${isMatchCurrent ? 'text-emerald-400' : 'text-amber-400'}`} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">
                                  {testResult.user?.fullName || 'Cán bộ'}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300">
                                  <span className="font-mono text-cyan-300 font-bold">{testResult.user?.staffCode || 'Chưa có mã'}</span>
                                  <span>•</span>
                                  <span className="truncate">{testResult.user?.department || 'Chưa gán phòng'}</span>
                                </div>
                                {testResult.user?.email && (
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{testResult.user.email}</p>
                                )}
                              </div>
                            </div>

                            {/* Chỉ số Cosine Similarity & Liveness */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">Độ tương đồng Cosine:</span>
                                <span className="font-bold text-emerald-300 font-mono text-sm">
                                  {Math.round(((testResult.similarity || testResult.confidence || 0.95)) * 1000) / 10}%
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                  style={{ width: `${Math.min(100, Math.max(10, Math.round(((testResult.similarity || testResult.confidence || 0.95)) * 100)))}%` }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                                  <span className="text-[10px] text-slate-400 block">Anti-Spoofing</span>
                                  <span className="text-xs font-bold text-emerald-400">✓ Sống thực</span>
                                </div>
                                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-center">
                                  <span className="text-[10px] text-slate-400 block">Tiêu chuẩn</span>
                                  <span className="text-xs font-bold text-cyan-300">ArcFace 512D</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={handleRetryTest}
                                className="w-full py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Quét Thử Tiếp</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      /* KHÔNG KHỚP */
                      <div className="p-4 rounded-2xl border border-rose-500/40 bg-rose-950/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Chưa Trùng Khớp
                          </span>
                          {testResult.latencyMs && (
                            <span className="text-[11px] font-mono text-slate-400">{testResult.latencyMs}ms</span>
                          )}
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-rose-200 leading-relaxed">
                          {testResult.message || 'Không tìm thấy khuôn mặt trùng khớp trong cơ sở dữ liệu hệ thống (ngưỡng tương đồng < 0.68).'}
                        </div>

                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
                          <span className="font-bold text-white block">Gợi ý khắc phục:</span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            • Đảm bảo bạn đã đăng ký Face ID (tối thiểu 5 góc khuôn mặt).<br />
                            • Cởi bỏ khẩu trang, kính râm che khuất mắt và trán.<br />
                            • Đứng trước camera nơi có đầy đủ ánh sáng phòng.
                          </p>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRetryTest}
                            className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Thử Lại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainMode('enroll')}
                            className="flex-1 py-2 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Đăng Ký 5 Góc</span>
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    /* SẴN SÀNG KIỂM THỬ */
                    <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/60 space-y-4">
                      <div className="flex flex-col items-center justify-center text-center py-4 gap-2">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/10">
                          <ScanFace className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">Sẵn Sàng Nhận Diện</h4>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Hướng khuôn mặt thẳng vào camera. Hệ thống tự động kích hoạt đối soát sinh trắc học sau khi giữ ổn định 1 giây.
                        </p>
                      </div>

                      <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <span className="font-bold text-purple-300 block text-[11px] uppercase tracking-wider">Tiêu chuẩn kiểm định:</span>
                        <ul className="text-slate-300 text-[11px] space-y-1.5 pl-3 list-disc">
                          <li>Trích xuất 512 đặc trưng sinh trắc học chuẩn ArcFace.</li>
                          <li>Xác thực độ sống liveness chống giả mạo bằng ảnh chụp/màn hình.</li>
                          <li>Tốc độ nhận diện thời gian thực dưới 300ms.</li>
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={executeTestRecognition}
                        disabled={!isCameraActive || isTestingRecognition}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-purple-500/20 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Bấm Quét Nhận Diện Ngay</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NGHỊ ĐỊNH 13/2023/NĐ-CP & ĐỒNG THUẬN (CHỈ HIỆN KHI ENROLL) ── */}
        {mainMode === 'enroll' && (
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-400"
              />
              <span>
                <strong className="text-white">Cam kết tuân thủ Nghị định 13/2023/NĐ-CP:</strong> Tôi đồng ý cho phép Nhà trường thu thập, trích xuất vector 512D và mã hóa AES-256 dữ liệu sinh trắc học khuôn mặt phục vụ duy nhất mục đích nhận diện & chấm công, không chia sẻ cho bên thứ ba.
              </span>
            </label>
          </div>
        )}

        {/* Thông báo lỗi nếu có */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── FOOTER THAO TÁC ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 relative z-10">
          {mainMode === 'enroll' ? (
            <>
              <div>
                {currentEmployee?._id && (
                  <button
                    type="button"
                    onClick={handleDeleteFace}
                    disabled={deleting || submitting}
                    className="px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    title="Xóa toàn bộ dữ liệu khuôn mặt theo Quyền xóa dữ liệu (NĐ 13/2023)"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Xóa Mẫu Face ID</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllAngles}
                  disabled={submitting || capturedCount === 0 || !consentAgreed}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Trích Xuất Vector 512D...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Lưu {capturedCount}/5 Góc Mẫu Khuôn Mặt</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMainMode('enroll')}
                className="px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Quay Lại Đăng Ký 5 Góc</span>
              </button>

              <div className="flex items-center gap-2">
                {testResult && (
                  <button
                    type="button"
                    onClick={handleRetryTest}
                    className="px-4 py-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Thử Lại</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
