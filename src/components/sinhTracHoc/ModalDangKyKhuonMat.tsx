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
import { faceApi, DetectPoseResponse } from '../../api/khuonMat.api';
import { audioFeedback } from '../../utils/amThanh';
import { Portal } from '../chung/CongDichChuyen';
import { useAuthStore } from '../../stores/useXacThucStore';
import { cameraManager } from '../../utils/quanLyCamera';

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
  const isStartingCameraRef = useRef<boolean>(false);
  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;
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

      if (data.khop_khuon_mat) {
        const isMatchedCurrent = !currentEmployee?._id || String(data.nguoi_dung?.id) === String(currentEmployee._id || currentEmployee.id);
        if (isMatchedCurrent) {
          audioFeedback.playSuccessChime();
          toast.success(`✓ Khớp đúng nhân sự: ${data.nguoi_dung?.ho_ten || 'Cán bộ'}!`);
        } else {
          audioFeedback.playWarningBeep();
          toast(`⚠️ Nhận diện thấy: ${data.nguoi_dung?.ho_ten || 'Cán bộ'} (Khác với hồ sơ ${currentEmployee?.fullName || 'đang chọn'})`, {
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
        khop_khuon_mat: false,
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

  // Khởi tạo sạch toàn bộ 5 góc và trạng thái HUD mỗi khi mở modal (kể cả khi bấm Chụp lại)
  useEffect(() => {
    if (isOpen && currentEmployee) {
      const freshAngles: Record<string, any> = {
        straight: null,
        left: null,
        right: null,
        up: null,
        down: null,
      };

      setCapturedImages(freshAngles);
      capturedImagesRef.current = freshAngles;

      setActiveStep(0);
      activeStepRef.current = 0;
      holdCounterRef.current = 0;
      holdStartTimeRef.current = null;
      smoothProgressRef.current = 0;
      noFaceFramesRef.current = 0;
      lastCaptureTimeRef.current = Date.now();
      setIsStepTransitioning(false);
      isStepTransitioningRef.current = false;
      setStepSuccessFlash(null);
      setErrorMsg('');
      setTestResult(null);
      setCurrentDetectedPose('Đang khởi tạo camera...');
      setTelemetry({
        yaw: 0, pitch: 0, roll: 0,
        isTargetMet: false,
        progress: 0,
        guidanceText: 'Đưa khuôn mặt vào giữa khung hình',
      });
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
    // Nếu camera đã đang chạy thì gắn lại vào thẻ video và đồng bộ state
    if (streamRef.current && streamRef.current.active && isCameraActiveRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      return;
    }

    if (isStartingCameraRef.current) {
      return;
    }
    isStartingCameraRef.current = true;

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

      cameraManager.registerStream(stream);

      // Nếu modal đã đóng trong lúc chờ cấp quyền
      if (!isOpenRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        cameraManager.unregisterStream(stream);
        return;
      }

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
    } finally {
      isStartingCameraRef.current = false;
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
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
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
    isStartingCameraRef.current = false;
    setIsCameraActive(false);
    initialWarmupRef.current = false;
    setInitialWarmupSeconds(0);
    holdStartTimeRef.current = null;
    smoothProgressRef.current = 0;
    targetDataRef.current = null;
    smoothBoxRef.current = null;
    smoothLandmarksRef.current = null;
    setCurrentDetectedPose('Đang khởi tạo camera...');
    setTelemetry({
      yaw: 0, pitch: 0, roll: 0,
      isTargetMet: false,
      progress: 0,
      guidanceText: 'Đưa khuôn mặt vào giữa khung hình',
    });
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
                    // Mạng bận hoặc tạm thời ngắt, xóa dữ liệu cũ để tránh đơ khung hình
                    targetDataRef.current = null;
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
        setTimeout(runDetection, 120);
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
          guidanceText = `✓ Đã khớp nhận diện: ${testResultRef.current.user?.fullName || 'Cán bộ'}${(testResultRef.current.similarity ?? testResultRef.current.confidence) !== undefined ? ` (${Math.round((testResultRef.current.similarity ?? testResultRef.current.confidence) * 100)}%)` : ''}`;
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
      testResultRef.current?.khop_khuon_mat &&
      (!currentEmployee?._id || String(testResultRef.current.nguoi_dung?.id) === String(currentEmployee._id || currentEmployee.id))
    );
    const testColor = testResultRef.current?.khop_khuon_mat
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
      } else if (testResultRef.current?.khop_khuon_mat) {
        if (isMatchedTargetUser) {
          badgeText = `✓ KHỚP: ${(testResultRef.current.nguoi_dung?.ho_ten || 'HỢP LỆ').toUpperCase()}`;
          badgeBg = 'rgba(6, 95, 70, 0.95)';
          badgeBorder = '#10b981';
        } else {
          badgeText = `⚠️ KHUÔN MẶT CỦA: ${(testResultRef.current.nguoi_dung?.ho_ten || 'NHÂN SỰ KHÁC').toUpperCase()}`;
          badgeBg = 'rgba(180, 83, 9, 0.95)';
          badgeBorder = '#f59e0b';
        }
      } else if (testResultRef.current && !testResultRef.current.khop_khuon_mat) {
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
    const validCount = Object.values(capturedImages).filter((item) => Boolean(item?.blob)).length;
    if (validCount === 0) {
      setErrorMsg('Vui lòng chụp hoặc tải lên ít nhất 1 góc khuôn mặt mới.');
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
      formData.append('ma_can_bo', currentEmployee.id || currentEmployee.email || currentEmployee.ma_can_bo);
      if (currentEmployee.ho_ten) formData.append('ho_ten', currentEmployee.ho_ten);
      formData.append('dong_y_thu_thap', 'true');
      if (currentEmployee.da_dang_ky_face) {
        formData.append('ghi_de', 'true');
      }

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
        toast.success(res.message || `Đăng ký Face ID thành công cho ${currentEmployee.ho_ten}!`);
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
    const targetId = currentEmployee?.id || currentEmployee?._id;
    if (!targetId) return;
    if (!window.confirm(`Xác nhận xóa sạch dữ liệu sinh trắc học khuôn mặt của "${currentEmployee.ho_ten}" khỏi hệ thống theo Nghị định 13/2023/NĐ-CP?`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await faceApi.deleteFaceData(targetId);
      if (res.success) {
        toast.success(`Đã xóa sạch dữ liệu sinh trắc học của ${currentEmployee.ho_ten}`);
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
    <Portal>
      <div
        data-camera-modal="true"
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      >
        {/* Hidden processing canvas */}
        <canvas ref={canvasRef} className="hidden" />

        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        >
          {/* ── HEADER GỌN SÁNG ĐỒNG BỘ ─────────────────────────────────── */}
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/60 dark:border-brand-800/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
                {mainMode === 'enroll' ? (
                  <ScanFace className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                    {mainMode === 'enroll'
                      ? 'Đăng ký khuôn mặt 5 góc'
                      : 'Kiểm thử nhận diện AI'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                    {mainMode === 'enroll' ? 'ArcFace 512D' : 'FAISS Realtime'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {currentEmployee?.ho_ten || 'Nhân sự'}
                  </span>
                  {currentEmployee?.ma_can_bo && (
                    <>
                      {' · '}
                      <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                        {currentEmployee.ma_can_bo}
                      </span>
                    </>
                  )}
                  {(currentEmployee?.ten_phong_ban || currentEmployee?.don_vi_chinh?.ten_phong_ban) && (
                    <> · {currentEmployee.ten_phong_ban || currentEmployee.don_vi_chinh?.ten_phong_ban}</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Chế độ chính: Đăng ký / Kiểm thử */}
              <div className="flex items-center gap-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMainMode('enroll');
                    setTestResult(null);
                  }}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    mainMode === 'enroll'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Đăng ký</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMainMode('test');
                    setTestResult(null);
                    testStableCountRef.current = 0;
                    isExecutingTestRef.current = false;
                  }}
                  className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    mainMode === 'test'
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  <span>Kiểm thử</span>
                </button>
              </div>

              {/* Chọn nguồn ảnh khi Đăng ký: Webcam / Tải ảnh */}
              {mainMode === 'enroll' && (
                <div className="hidden sm:flex items-center gap-0.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTabMode('camera')}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer ${
                      tabMode === 'camera'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    title="Chụp qua Webcam"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Webcam</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabMode('upload')}
                    className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 cursor-pointer ${
                      tabMode === 'upload'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── BODY CUỘN GỌN ──────────────────────────────────────────── */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
            {/* Thanh tiến trình 5 góc (Enroll) hoặc Banner Kiểm thử AI */}
            {mainMode === 'enroll' ? (
              <div className="grid grid-cols-5 gap-1.5">
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
                      className={`h-8 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                        isCurrent
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 shadow-2xs'
                          : isCaptured
                          ? 'border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isCaptured ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <IconComponent className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{ang.label.split('. ')[1]}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/30 border border-brand-200/70 dark:border-brand-800/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <ScanFace className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  <p className="text-xs text-slate-700 dark:text-slate-200 truncate">
                    <strong className="font-semibold text-slate-900 dark:text-white">Kiểm thử nhận diện:</strong> Đưa khuôn mặt vào khung hình để đối soát trực tiếp trên FAISS.
                  </p>
                </div>
                <span className="hidden sm:inline-block text-[11px] font-mono font-semibold text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-brand-200/70 dark:border-brand-800 shrink-0">
                  Cosine ≥ 0.45
                </span>
              </div>
            )}

            {/* ── NỘI DUNG CHÍNH ───────────────────────────────────────── */}
            {mainMode === 'enroll' && tabMode === 'upload' ? (
              /* TAB TẢI ẢNH LÊN (5 DROPZONES) */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {ANGLES_CONFIG.map((ang) => {
                  const currentImage = capturedImages[ang.key];
                  const IconComp = ang.icon;

                  return (
                    <div
                      key={ang.key}
                      className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 flex flex-col items-center justify-between text-center gap-2.5 relative group hover:border-brand-400/70 transition-all"
                    >
                      <div className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="flex items-center gap-1 truncate">
                          <IconComp className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                          <span className="truncate">{ang.label.split('. ')[1]}</span>
                        </span>
                        {currentImage && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAngle(ang.key)}
                            className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                            title="Xóa ảnh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                        {currentImage?.previewUrl ? (
                          <img
                            src={currentImage.previewUrl}
                            alt={ang.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-brand-600 p-2">
                            <Upload className="w-5 h-5" />
                            <span className="text-[11px] font-medium text-center leading-tight">
                              Chọn ảnh
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

                      <p className="text-[10.5px] text-slate-400 dark:text-slate-500 leading-tight">{ang.desc}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LAYOUT 2 CỘT: CAMERA TRÁI (7) + HƯỚNG DẪN & MẪU PHẢI (5) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Cột Trái: Khung Camera Live & Thanh Điều Khiển */}
                <div className="lg:col-span-7 space-y-2.5">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center">
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

                    {/* Đếm ngược chuẩn bị ban đầu */}
                    {mainMode === 'enroll' && initialWarmupSeconds > 0 && isCameraActive && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20 pointer-events-none">
                        <span className="text-5xl font-black text-white animate-pulse">{initialWarmupSeconds}</span>
                        <span className="text-xs font-semibold text-slate-200">Chuẩn bị nhìn thẳng vào camera...</span>
                      </div>
                    )}

                    {/* Flash thành công khi chuyển bước */}
                    {mainMode === 'enroll' && stepSuccessFlash && (
                      <div className="absolute inset-0 bg-emerald-600/25 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20 pointer-events-none animate-fadeIn">
                        <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl">
                          <CheckCircle className="w-8 h-8" />
                        </div>
                        <span className="text-sm font-bold text-white drop-shadow">Đã chụp {stepSuccessFlash}!</span>
                      </div>
                    )}

                    {/* Loading camera */}
                    {!isCameraActive && (
                      <div className="flex flex-col items-center justify-center p-8 text-center gap-2.5">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                        <p className="text-xs text-slate-300 font-medium">Đang khởi động webcam...</p>
                      </div>
                    )}
                  </div>

                  {/* Thanh điều khiển 1 hàng gọn dưới Camera */}
                  {mainMode === 'enroll' ? (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            allAnglesDone || isCurrentAngleCaptured
                              ? 'bg-emerald-500'
                              : isCameraActive
                              ? 'bg-brand-500 animate-pulse'
                              : 'bg-slate-400'
                          }`}
                        />
                        {allAnglesDone ? (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                            Đã đủ 5/5 góc
                          </span>
                        ) : isCurrentAngleCaptured ? (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 truncate">
                            Đã hoàn thành góc này
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                            {currentDetectedPose}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            autoScanEnabled
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/90 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700'
                          }`}
                        >
                          Tự động: {autoScanEnabled ? 'BẬT' : 'TẮT'}
                        </button>

                        {isCurrentAngleCaptured ? (
                          <button
                            type="button"
                            onClick={handleRetakeCurrentAngle}
                            className="h-8 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Chụp lại góc này</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={triggerCaptureCurrentAngle}
                            disabled={!isCameraActive}
                            className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Chụp góc này</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Trạng thái:</span>
                        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 truncate">
                          {isTestingRecognition
                            ? 'Đang đối soát AI...'
                            : testResult
                            ? (testResult.khop_khuon_mat ? 'Đã nhận diện thành công' : 'Chưa trùng khớp')
                            : faceInFrame
                            ? 'Đã phát hiện khuôn mặt'
                            : 'Chờ khuôn mặt vào khung...'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={testResult ? handleRetryTest : executeTestRecognition}
                        disabled={!isCameraActive || isTestingRecognition}
                        className="h-8 px-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
                      >
                        {isTestingRecognition ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang quét...</span>
                          </>
                        ) : testResult ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Quét lại</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-3.5 h-3.5" />
                            <span>Quét ngay</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Cột Phải: Hướng dẫn góc chụp & Danh sách 5 mẫu */}
                <div className="lg:col-span-5 space-y-3">
                  {mainMode === 'enroll' ? (
                    <>
                      {/* Card Hướng Dẫn Góc Hiện Tại */}
                      <div className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 font-bold text-[11px] uppercase tracking-wider">
                            {React.createElement(currentAngleObj.icon, { className: 'w-3.5 h-3.5' })}
                            <span>Góc {activeStep + 1}/5 · {currentAngleObj.label.split('. ')[1]}</span>
                          </div>
                          <span
                            className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                              telemetry.isTargetMet
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {telemetry.isTargetMet ? '✓ Đạt chuẩn' : 'Đang căn chỉnh'}
                          </span>
                        </div>

                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                            {currentAngleObj.instruction}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            {currentAngleObj.tip}
                          </p>
                        </div>

                        {isCurrentAngleCaptured ? (
                          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                            <span className="inline-flex items-center gap-1.5 font-semibold">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Đã chụp xong góc này
                            </span>
                            <button
                              type="button"
                              onClick={handleRetakeCurrentAngle}
                              className="text-amber-700 dark:text-amber-400 hover:underline font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Chụp lại
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">
                                {telemetry.isTargetMet ? 'Đang lấy mẫu 512D...' : 'Độ ổn định góc mặt'}
                              </span>
                              <span
                                className={`font-mono font-bold tabular-nums ${
                                  telemetry.isTargetMet
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-brand-600 dark:text-brand-400'
                                }`}
                              >
                                {telemetry.progress}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-150 rounded-full ${
                                  telemetry.isTargetMet ? 'bg-emerald-500' : 'bg-brand-600'
                                }`}
                                style={{ width: `${telemetry.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Mini Gallery: 5 Góc Mẫu Khuôn Mặt */}
                      <div className="p-3.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            <span>Mẫu đã chụp</span>
                            <span className="text-slate-400 font-mono tabular-nums">({capturedCount}/5)</span>
                            {allAnglesDone && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Đủ 5 góc
                              </span>
                            )}
                          </div>
                          {capturedCount > 0 && (
                            <button
                              type="button"
                              onClick={handleRetakeAllAngles}
                              className="text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
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
                                    ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/40 dark:bg-brand-950/30'
                                    : imgItem
                                    ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                                    : 'border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
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
                                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity rounded-lg">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRetakeSpecificAngle(ang.key);
                                        }}
                                        className="p-1 rounded-md bg-white text-slate-800 hover:bg-amber-400 transition-colors cursor-pointer"
                                        title={`Chụp lại góc ${ang.label}`}
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveAngle(ang.key);
                                        }}
                                        className="p-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                                        title="Xóa góc này"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 text-center">
                                    <AngleIcon className="w-3.5 h-3.5" />
                                    <span className="text-[9px] font-semibold leading-tight">
                                      {ang.label.split('. ')[1]}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* GIAO DIỆN KẾT QUẢ KIỂM THỬ AI */
                    <div className="space-y-3">
                      {isTestingRecognition ? (
                        <div className="p-6 rounded-2xl border border-brand-200/80 dark:border-brand-800/60 bg-brand-50/40 dark:bg-brand-950/20 flex flex-col items-center justify-center text-center gap-3 py-10">
                          <Loader2 className="w-8 h-8 text-brand-600 dark:text-brand-400 animate-spin" />
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">Đang đối soát khuôn mặt...</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Trích xuất vector 512D &amp; tính độ tương đồng Cosine
                            </p>
                          </div>
                        </div>
                      ) : testResult ? (
                        testResult.khop_khuon_mat ? (
                          (() => {
                            const isMatchCurrent =
                              !currentEmployee?._id ||
                              String(testResult.nguoi_dung?.id) === String(currentEmployee._id || currentEmployee.id);
                            return (
                              <div
                                className={`p-4 rounded-2xl border space-y-3 ${
                                  isMatchCurrent
                                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                                    : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${
                                      isMatchCurrent
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}
                                  >
                                    {isMatchCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                    {isMatchCurrent ? 'Khớp đúng nhân sự' : 'Khớp nhân sự khác'}
                                  </span>
                                  {testResult.latencyMs && (
                                    <span className="text-[11px] font-mono text-slate-500">
                                      {testResult.latencyMs}ms
                                    </span>
                                  )}
                                </div>

                                {!isMatchCurrent && currentEmployee?.fullName && (
                                  <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
                                    Đang kiểm thử hồ sơ <strong>{currentEmployee.fullName}</strong>, nhưng AI nhận diện người trước camera là <strong>{testResult.nguoi_dung?.ho_ten}</strong>.
                                  </div>
                                )}

                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                    {testResult.nguoi_dung?.anh_dai_dien ? (
                                      <img src={testResult.nguoi_dung.anh_dai_dien} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {testResult.nguoi_dung?.ho_ten || 'Cán bộ'}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                      <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                                        {testResult.nguoi_dung?.ma_can_bo || '--'}
                                      </span>
                                      {' · '}
                                      {testResult.nguoi_dung?.ten_phong_ban || 'Nhà trường'}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-500">Độ tương đồng Cosine</span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      {(testResult.do_tuong_dong ?? testResult.do_tin_cay) !== undefined
                                        ? `${Math.round(Number(testResult.do_tuong_dong ?? testResult.do_tin_cay) * 1000) / 10}%`
                                        : '--'}
                                    </span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{
                                        width: `${Math.min(100, Math.max(10, Math.round(Number(testResult.do_tuong_dong ?? testResult.do_tin_cay ?? 0) * 100)))}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={handleRetryTest}
                                  className="w-full h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Quét thử tiếp</span>
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Chưa trùng khớp
                              </span>
                              {testResult.latencyMs && (
                                <span className="text-[11px] font-mono text-slate-500">{testResult.latencyMs}ms</span>
                              )}
                            </div>
                            <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                              {testResult.message || 'Không tìm thấy khuôn mặt trùng khớp trong CSDL (ngưỡng < 0.45).'}
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleRetryTest}
                                className="flex-1 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Thử lại</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setMainMode('enroll')}
                                className="flex-1 h-8 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Đăng ký 5 góc</span>
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
                          <div className="flex flex-col items-center justify-center text-center py-2 gap-1.5">
                            <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/70 dark:border-brand-800 flex items-center justify-center text-brand-600 dark:text-brand-400">
                              <ScanFace className="w-5 h-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">Sẵn sàng nhận diện</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Hướng khuôn mặt thẳng vào camera. Hệ thống sẽ tự động đối soát sau khi giữ ổn định 1 giây.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={executeTestRecognition}
                            disabled={!isCameraActive || isTestingRecognition}
                            className="w-full h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Bấm quét nhận diện ngay</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ĐỒNG THUẬN NGHỊ ĐỊNH 13 (GỌN NHẸ) ────────────────────── */}
            {mainMode === 'enroll' && (
              <label className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 cursor-pointer text-[11.5px] text-slate-600 dark:text-slate-300 select-none leading-relaxed">
                <input
                  type="checkbox"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span>
                  <strong className="font-semibold text-slate-800 dark:text-slate-100">
                    Cam kết Nghị định 13/2023/NĐ-CP:
                  </strong>{' '}
                  Đồng ý cho phép Nhà trường thu thập, trích xuất vector 512D và mã hóa AES-256 dữ liệu sinh trắc học phục vụ nhận diện &amp; chấm công, không chia sẻ cho bên thứ ba.
                </span>
              </label>
            )}

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* ── FOOTER CỐ ĐỊNH ─────────────────────────────────────────── */}
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 flex items-center justify-between gap-3 shrink-0">
            {mainMode === 'enroll' ? (
              <>
                <div>
                  {currentEmployee?._id && currentEmployee?.isFaceRegistered && (
                    <button
                      type="button"
                      onClick={handleDeleteFace}
                      disabled={deleting || submitting}
                      className="h-9 px-3 rounded-xl border border-rose-200/90 dark:border-rose-800/60 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      title="Xóa toàn bộ dữ liệu khuôn mặt theo NĐ 13/2023"
                    >
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Xóa mẫu Face ID</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAllAngles}
                    disabled={submitting || capturedCount === 0 || !consentAgreed}
                    className="h-9 px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu mẫu...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Lưu {capturedCount}/5 góc mẫu</span>
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
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span>Quay lại đăng ký 5 góc</span>
                </button>

                <div className="flex items-center gap-2">
                  {testResult && (
                    <button
                      type="button"
                      onClick={handleRetryTest}
                      className="h-9 px-3.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thử lại</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};
