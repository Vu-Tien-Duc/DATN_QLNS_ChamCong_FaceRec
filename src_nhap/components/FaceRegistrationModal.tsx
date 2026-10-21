import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Target,
  Upload,
  X,
  Check,
  Trash2,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

export const ANGLES_CONFIG = [
  {
    key: 'straight',
    label: '1. Chính Diện',
    poseReq: 'STRAIGHT',
    desc: 'Nhìn thẳng vào camera',
    instruction: 'Hãy giữ đầu thẳng, nhìn trực diện vào camera',
    tip: 'Nhìn trực diện vào ống kính, giữ khuôn mặt cân đối ở giữa khung hình.',
    icon: Target,
    color: '#06b6d4',
    targetCheck: (yaw: number, pitch: number) => Math.abs(yaw) <= 9 && Math.abs(pitch) <= 9,
  },
  {
    key: 'left',
    label: '2. Nghiêng Trái',
    poseReq: 'TURN_LEFT',
    desc: 'Từ từ quay mặt sang bên trái',
    instruction: 'Xoay đầu sang phía bên trái của bạn',
    tip: 'Từ từ quay đầu sang bên trái khoảng 12° - 25°, giữ mắt nhìn tự nhiên.',
    icon: ArrowLeft,
    color: '#818cf8',
    targetCheck: (yaw: number) => yaw >= 9.0 && yaw <= 42.0,
  },
  {
    key: 'right',
    label: '3. Nghiêng Phải',
    poseReq: 'TURN_RIGHT',
    desc: 'Từ từ quay mặt sang bên phải',
    instruction: 'Xoay đầu sang phía bên phải của bạn',
    tip: 'Từ từ quay đầu sang bên phải khoảng 12° - 25° và giữ yên trong 1 giây.',
    icon: ArrowRight,
    color: '#a78bfa',
    targetCheck: (yaw: number) => yaw <= -9.0 && yaw >= -42.0,
  },
  {
    key: 'up',
    label: '4. Ngước Lên',
    poseReq: 'LOOK_UP',
    desc: 'Hơi ngước cằm lên phía trên',
    instruction: 'Hơi nâng cằm hướng lên phía trên',
    tip: 'Chỉ cần nâng nhẹ cằm lên một chút (~5° - 18°), không cần ngửa đầu quá cao.',
    icon: ArrowUp,
    color: '#f59e0b',
    targetCheck: (_yaw: number, pitch: number) => pitch >= 5.0 && pitch <= 42.0,
  },
  {
    key: 'down',
    label: '5. Cúi Xuống',
    poseReq: 'LOOK_DOWN',
    desc: 'Hơi cúi đầu nhẹ xuống dưới',
    instruction: 'Hơi hạ cằm cúi nhẹ hướng xuống dưới',
    tip: 'Chỉ cần hạ nhẹ cằm xuống một chút (~3° - 15°), giữ mắt nhìn hướng về camera.',
    icon: ArrowDown,
    color: '#10b981',
    targetCheck: (_yaw: number, pitch: number) => pitch <= -3.0 && pitch >= -42.0,
  },
];

export const REQUIRED_HOLD_FRAMES = 5; // ~0.8s - 1.0s giữ ổn định vừa vặn, không mỏi cổ

export function checkAngleTargetMet(stepIndex: number, pose: string, yawDeg: number, pitchDeg: number): boolean {
  switch (stepIndex) {
    case 0: // Straight
      return (pose === 'STRAIGHT' || Math.abs(yawDeg) <= 9) && Math.abs(pitchDeg) <= 9;
    case 1: // Turn Left
      return (pose === 'TURN_LEFT') || (yawDeg >= 7.5 && yawDeg <= 45.0);
    case 2: // Turn Right
      return (pose === 'TURN_RIGHT') || (yawDeg <= -7.5 && yawDeg >= -45.0);
    case 3: // Look Up (ngước lên thoải mái)
      return (pose === 'LOOK_UP') || (pitchDeg >= 5.0 && pitchDeg <= 42.0);
    case 4: // Look Down (cúi xuống êm ái: chỉ cần hạ nhẹ cằm pitch <= -3.0° hoặc AI báo LOOK_DOWN)
      return (pose === 'LOOK_DOWN') || (pitchDeg <= -3.0 && pitchDeg >= -42.0);
    default:
      return false;
  }
}

export function getDetailedGuidance(stepIndex: number, yaw: number, pitch: number, isTargetMet: boolean, holdProgress: number) {
  if (isTargetMet) {
    if (holdProgress >= 100) {
      return { text: '📸 Đang chụp...', status: 'holding' };
    }
    return { text: `✨ Đúng góc rồi! Giữ nguyên... (${holdProgress}%)`, status: 'holding' };
  }

  switch (stepIndex) {
    case 0:
      if (Math.abs(yaw) > 10) return { text: yaw > 0 ? '👈 Xoay mặt lại về chính diện' : '👉 Xoay mặt lại về chính diện', status: 'adjusting' };
      if (pitch > 9) return { text: '👇 Hạ nhẹ cằm xuống chính diện', status: 'adjusting' };
      if (pitch < -9) return { text: '👆 Nâng nhẹ cằm lên chính diện', status: 'adjusting' };
      return { text: '👤 Nhìn thẳng trực diện vào camera', status: 'guiding' };

    case 1:
      if (yaw < 3) return { text: '👈 Từ từ quay đầu sang bên trái của bạn', status: 'guiding' };
      if (yaw < 7.5) return { text: '👈 Sắp đạt rồi! Quay sang trái thêm chút nữa...', status: 'adjusting' };
      if (yaw > 45) return { text: '👉 Quay hơi nhiều quá rồi, quay lại một chút', status: 'adjusting' };
      return { text: '👈 Quay đầu sang phía bên trái của bạn', status: 'guiding' };

    case 2:
      if (yaw > -3) return { text: '👉 Từ từ quay đầu sang bên phải của bạn', status: 'guiding' };
      if (yaw > -7.5) return { text: '👉 Sắp đạt rồi! Quay sang phải thêm chút nữa...', status: 'adjusting' };
      if (yaw < -45) return { text: '👈 Quay hơi nhiều quá, quay lại một chút', status: 'adjusting' };
      return { text: '👉 Quay đầu sang phía bên phải của bạn', status: 'guiding' };

    case 3:
      if (pitch < 2) return { text: '👆 Hơi nâng cằm hướng lên phía trên', status: 'guiding' };
      if (pitch < 5.0) return { text: '👆 Rất tốt! Nâng cằm lên thêm một chút nữa...', status: 'adjusting' };
      if (pitch > 42) return { text: '👇 Ngước hơi cao quá, hạ cằm xuống một chút', status: 'adjusting' };
      return { text: '👆 Hơi nâng cằm hướng lên phía trên', status: 'guiding' };

    case 4:
      if (pitch > 1.5) return { text: '👇 Hãy hơi cúi đầu / hạ cằm nhẹ xuống dưới', status: 'guiding' };
      if (pitch > -3.0) return { text: '👇 Sắp đạt rồi! Hạ cằm xuống thêm chút nữa...', status: 'adjusting' };
      if (pitch < -42) return { text: '👆 Cúi hơi sâu quá, nâng cằm lên một chút', status: 'adjusting' };
      return { text: '👇 Hơi cúi đầu nhẹ xuống dưới', status: 'guiding' };

    default:
      return { text: 'Đưa khuôn mặt vào khung hình', status: 'guiding' };
  }
}

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: any;
  employee?: any;
  onSuccess: () => void;
}

export function FaceRegistrationModal({
  isOpen,
  onClose,
  user,
  employee,
  onSuccess
}: FaceRegistrationModalProps) {
  const currentEmployee = user || employee;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const holdCounterRef = useRef(0);
  const lastCaptureTimeRef = useRef(0);

  const [activeStep, setActiveStep] = useState(0); // 0 to 4
  const activeStepRef = useRef(0);
  const autoScanEnabledRef = useRef(true);
  const isCapturingRef = useRef(false);
  const isStepTransitioningRef = useRef(false);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [stepSuccessFlash, setStepSuccessFlash] = useState<string | null>(null);

  // Đếm số frame mất mặt liên tiếp để decay mượt mà thay vì reset về 0 ngay tức thì
  const noFaceFramesRef = useRef(0);

  // Đếm ngược khởi động chuẩn bị ban đầu (1.8s) để người dùng không bị bất ngờ ở bước 1
  const initialWarmupRef = useRef(false);
  const [initialWarmupSeconds, setInitialWarmupSeconds] = useState(2);
  const warmupTimerRef = useRef<any>(null);

  const [capturedImages, setCapturedImages] = useState<Record<string, { blob: Blob; previewUrl: string; existingUrl?: string } | null>>({
    straight: null,
    left: null,
    right: null,
    up: null,
    down: null,
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentDetectedPose, setCurrentDetectedPose] = useState('Chưa có camera');
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [tabMode, setTabMode] = useState<'camera' | 'upload'>('camera');
  const [fps, setFps] = useState(0);

  // 3D Head Orientation Telemetry State
  const [telemetry, setTelemetry] = useState({
    yaw: 0,
    pitch: 0,
    roll: 0,
    isTargetMet: false,
    progress: 0,
    guidanceText: '',
  });

  const fpsRef = useRef({ count: 0, lastTime: performance.now() });

  // Current step angle object
  const currentAngleObj = ANGLES_CONFIG[activeStep] || ANGLES_CONFIG[0];

  // Load existing angles if previously registered
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
              blob: null as any,
              previewUrl: url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`,
              existingUrl: url,
            };
          }
        });
      } else if (currentEmployee.faceAngles) {
        ANGLES_CONFIG.forEach((ang) => {
          const url = currentEmployee.faceAngles[ang.key];
          if (url && typeof url === 'string') {
            existing[ang.key] = {
              blob: null as any,
              previewUrl: url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`,
              existingUrl: url,
            };
          }
        });
      } else if (currentEmployee.facePhoto && typeof currentEmployee.facePhoto === 'string') {
        const url = currentEmployee.facePhoto;
        existing.straight = {
          blob: null as any,
          previewUrl: url.startsWith('http') || url.startsWith('/') ? url : `/uploads/${url}`,
          existingUrl: url,
        };
      }

      setCapturedImages(existing);

      // QUAN TRỌNG: Luôn tìm góc đầu tiên chưa có ảnh để bắt đầu khi mở modal
      // Đảm bảo không bao giờ bị lưu vết nhảy thẳng vào bước 5 từ phiên trước
      const firstUncapturedIndex = ANGLES_CONFIG.findIndex((ang) => !existing[ang.key]);
      const targetStartStep = firstUncapturedIndex !== -1 ? firstUncapturedIndex : 0;
      setActiveStep(targetStartStep);
      activeStepRef.current = targetStartStep;
      holdCounterRef.current = 0;
      noFaceFramesRef.current = 0;
      lastCaptureTimeRef.current = Date.now();
      setIsStepTransitioning(false);
      isStepTransitioningRef.current = false;
      setStepSuccessFlash(null);
    }
  }, [isOpen, currentEmployee?._id]);

  // Synchronize refs with state to prevent stale closures in animation frame
  useEffect(() => {
    activeStepRef.current = activeStep;
    holdCounterRef.current = 0;
  }, [activeStep]);

  useEffect(() => {
    autoScanEnabledRef.current = autoScanEnabled;
  }, [autoScanEnabled]);

  // Start Camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ Camera');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
        setErrorMsg('');
      }

      // Khởi động delay 1.8s (đếm ngược 2s) trước khi cho phép auto-scan chụp bước 1
      initialWarmupRef.current = false;
      setInitialWarmupSeconds(2);
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);

      setTimeout(() => {
        setInitialWarmupSeconds(1);
      }, 900);
      warmupTimerRef.current = setTimeout(() => {
        initialWarmupRef.current = true;
        setInitialWarmupSeconds(0);
      }, 1800);

      startProcessingLoop();
    } catch (err: any) {
      console.error('Camera error:', err);
      setErrorMsg('Không thể mở Camera: ' + err.message + '. Bạn có thể chuyển qua tab "Tải Ảnh Lên".');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
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
  };

  useEffect(() => {
    if (isOpen && tabMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isOpen, tabMode]);

  // Real-time Detection Loop
  const startProcessingLoop = () => {
    let isProcessing = false;

    const loop = async () => {
      if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current) {
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

        // FPS counter
        fpsRef.current.count++;
        const now = performance.now();
        if (now - fpsRef.current.lastTime >= 1000) {
          setFps(fpsRef.current.count);
          fpsRef.current.count = 0;
          fpsRef.current.lastTime = now;
        }

        if (!isProcessing) {
          isProcessing = true;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(async (blob) => {
              if (!blob) {
                isProcessing = false;
                return;
              }

              try {
                let data: any = null;
                try {
                  const formData = new FormData();
                  formData.append('image', blob, 'frame.jpg');

                  const res = await fetch('/api/face/detect-pose', {
                    method: 'POST',
                    body: formData,
                  });
                  if (res.ok) {
                    data = await res.json();
                  }
                } catch {
                  // Fallback to simulated biometric HUD if server detect-pose is not available
                }

                if (!data || !data.face_detected) {
                  // Fallback smart visual guide
                  data = generateClientBiometricHUD(video.videoWidth, video.videoHeight);
                }

                // Draw Visual 3D Guide & HUD
                drawFaceIDHUD(data, overlay);

                // Auto Capture on Angle Match
                if (autoScanEnabledRef.current) {
                  handle3DAngleAutoCapture(data);
                }
              } catch (err) {
                console.error(err);
              } finally {
                isProcessing = false;
              }
            }, 'image/jpeg', 0.85);
          } else {
            isProcessing = false;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  // Fallback client-side bounding box - TUYỆT ĐỐI KHÔNG FAKE TRUE ĐỂ TRÁNH AUTO CHỤP SAI HOẶC NHẢY BƯỚC
  const generateClientBiometricHUD = (w: number, h: number) => {
    const boxW = Math.round(w * 0.44);
    const boxH = Math.round(h * 0.58);
    const boxX = Math.round((w - boxW) / 2);
    const boxY = Math.round((h - boxH) / 2.2);

    return {
      face_detected: false, // Bắt buộc false khi không có AI nhận diện
      bbox: { x: boxX, y: boxY, width: boxW, height: boxH },
      pose: {
        pose: 'NONE',
        yaw_deg: 0,
        pitch_deg: 0,
        roll_deg: 0
      },
      landmarks: null
    };
  };

  // --- DRAW APPLE FACEID STYLE 3D COMPASS & MESH ---
  const drawFaceIDHUD = (data: any, overlay: HTMLCanvasElement) => {
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (!data || !data.face_detected || !data.bbox) {
      setFaceInFrame(false);
      setCurrentDetectedPose('Không có mặt trong khung');
      setTelemetry((prev) => ({
        ...prev,
        isTargetMet: false,
        progress: 0,
        guidanceText: 'Đưa khuôn mặt vào giữa khung hình'
      }));

      // Vẽ khung hướng dẫn dạng nét đứt mờ
      if (data?.bbox) {
        const rawBox = data.bbox;
        const boxW = rawBox.width;
        const boxH = rawBox.height;
        const boxX = overlay.width - (rawBox.x + boxW);
        const boxY = rawBox.y;

        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxW, boxH);
        ctx.restore();
      }
      return;
    }

    setFaceInFrame(true);
    const rawBox = data.bbox;
    const boxW = rawBox.width;
    const boxH = rawBox.height;
    const boxX = overlay.width - (rawBox.x + boxW); // Mirror X
    const boxY = rawBox.y;

    const pose = data.pose ? data.pose.pose : 'STRAIGHT';
    const yawDeg = data.pose?.yaw_deg ?? 0;
    const pitchDeg = data.pose?.pitch_deg ?? 0;
    const rollDeg = data.pose?.roll_deg ?? 0;

    const currentStepIndex = activeStepRef.current;
    const currentAngle = ANGLES_CONFIG[currentStepIndex] || ANGLES_CONFIG[0];

    // Đánh giá tư thế 3D với dải góc mềm
    const isTargetMet = checkAngleTargetMet(currentStepIndex, pose, yawDeg, pitchDeg);
    const holdProgress = Math.min(100, Math.round((holdCounterRef.current / REQUIRED_HOLD_FRAMES) * 100));
    const guidance = getDetailedGuidance(currentStepIndex, yawDeg, pitchDeg, isTargetMet, holdProgress);

    setTelemetry({
      yaw: yawDeg,
      pitch: pitchDeg,
      roll: rollDeg,
      isTargetMet,
      progress: isTargetMet ? holdProgress : 0,
      guidanceText: guidance.text,
    });

    const poseMap: Record<string, { icon: string; text: string }> = {
      STRAIGHT: { icon: '👤', text: 'Nhìn thẳng' },
      TURN_LEFT: { icon: '👈', text: 'Quay trái' },
      TURN_RIGHT: { icon: '👉', text: 'Quay phải' },
      LOOK_UP: { icon: '👆', text: 'Ngước lên' },
      LOOK_DOWN: { icon: '👇', text: 'Cúi xuống' },
    };
    const currentPoseInfo = poseMap[pose] || { icon: '🎯', text: pose };
    setCurrentDetectedPose(`${currentPoseInfo.icon} ${currentPoseInfo.text}`);

    const mainColor = isTargetMet ? '#10b981' : currentAngle.color || '#06b6d4';
    const glowColor = isTargetMet ? 'rgba(16, 185, 129, 0.45)' : 'rgba(234, 84, 40, 0.35)';

    ctx.save();

    // 1. 3D VECTOR WIREFRAME MESH (If enabled)
    if (showMesh && data.landmarks) {
      const lm = data.landmarks;
      const mirrorX = (rawX: number) => overlay.width - rawX;

      const re = { x: mirrorX(lm.right_eye.x), y: lm.right_eye.y };
      const le = { x: mirrorX(lm.left_eye.x), y: lm.left_eye.y };
      const nose = { x: mirrorX(lm.nose_tip.x), y: lm.nose_tip.y };
      const mr = { x: mirrorX(lm.mouth_right.x), y: lm.mouth_right.y };
      const ml = { x: mirrorX(lm.mouth_left.x), y: lm.mouth_left.y };

      const foreheadL = { x: boxX + boxW * 0.7, y: boxY + boxH * 0.1 };
      const foreheadR = { x: boxX + boxW * 0.3, y: boxY + boxH * 0.1 };
      const foreheadMid = { x: boxX + boxW * 0.5, y: boxY + boxH * 0.05 };
      const templeL = { x: boxX + boxW * 0.92, y: boxY + boxH * 0.28 };
      const templeR = { x: boxX + boxW * 0.08, y: boxY + boxH * 0.28 };
      const cheekL = { x: boxX + boxW * 0.88, y: boxY + boxH * 0.62 };
      const cheekR = { x: boxX + boxW * 0.12, y: boxY + boxH * 0.62 };
      const jawL = { x: boxX + boxW * 0.75, y: boxY + boxH * 0.9 };
      const jawR = { x: boxX + boxW * 0.25, y: boxY + boxH * 0.9 };
      const chin = { x: boxX + boxW * 0.5, y: boxY + boxH * 0.98 };
      const noseBridge = { x: (re.x + le.x) / 2, y: (re.y + le.y) / 2 - boxH * 0.05 };

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

    // 2. CORNER BRACKETS BOUNDING BOX
    const cornerLength = Math.min(boxW, boxH) * 0.2;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = isTargetMet ? 14 : 6;

    ctx.beginPath();
    ctx.moveTo(boxX, boxY + cornerLength); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cornerLength, boxY);
    ctx.moveTo(boxX + boxW - cornerLength, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + cornerLength);
    ctx.moveTo(boxX + boxW, boxY + boxH - cornerLength); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW - cornerLength, boxY + boxH);
    ctx.moveTo(boxX + cornerLength, boxY + boxH); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX, boxY + boxH - cornerLength);
    ctx.stroke();

    // 3. TOP RECOGNITION NAME BADGE
    const badgeH = 32;
    const badgeW = Math.max(220, boxW * 1.05);
    const badgeX = boxX + (boxW - badgeW) / 2;
    const badgeY = boxY - badgeH - 14;

    ctx.shadowBlur = 0;
    ctx.fillStyle = isTargetMet ? 'rgba(6, 78, 59, 0.95)' : 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    // @ts-ignore roundRect compatibility
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

    if (isTargetMet) {
      ctx.fillText(
        `✨ ĐÃ ĐẠT GÓC: ${currentAngle.label} (${Math.round((holdCounterRef.current / 4) * 100)}%)`,
        badgeX + badgeW / 2,
        badgeY + 20
      );
    } else {
      ctx.fillText(
        `${currentPoseInfo.icon} ${currentPoseInfo.text} • Cần: ${currentAngle.label}`,
        badgeX + badgeW / 2,
        badgeY + 20
      );
    }

    ctx.restore();
  };

  // 3D Angle Auto-Capture logic
  const handle3DAngleAutoCapture = (data: any) => {
    if (!autoScanEnabledRef.current || isCapturingRef.current || isStepTransitioningRef.current) return;
    
    // Nếu chưa xong chuẩn bị ban đầu (1.8s): không tự chụp
    if (!initialWarmupRef.current) {
      holdCounterRef.current = 0;
      return;
    }

    // Nếu không có khuôn mặt thật: đếm frame mất mặt, decay dần để tránh chớp mắt bị mất tiến trình
    if (!data || !data.face_detected || !data.pose) {
      noFaceFramesRef.current++;
      if (noFaceFramesRef.current >= 4) {
        holdCounterRef.current = 0;
      } else {
        holdCounterRef.current = Math.max(0, holdCounterRef.current - 1);
      }
      return;
    }
    noFaceFramesRef.current = 0;

    // Cooldown giữa các lần chụp
    if (Date.now() - lastCaptureTimeRef.current < 900) {
      holdCounterRef.current = 0;
      return;
    }

    const currentStepIndex = activeStepRef.current;
    const pose = data.pose.pose || '';
    const yawDeg = data.pose?.yaw_deg ?? 0;
    const pitchDeg = data.pose?.pitch_deg ?? 0;

    const isTargetMet = checkAngleTargetMet(currentStepIndex, pose, yawDeg, pitchDeg);

    if (isTargetMet) {
      holdCounterRef.current++;
      if (holdCounterRef.current >= REQUIRED_HOLD_FRAMES) {
        lastCaptureTimeRef.current = Date.now();
        holdCounterRef.current = 0;
        triggerCaptureCurrentAngle();
      }
    } else {
      // Giảm dần tiến trình 1 frame khi lệch nhẹ thay vì reset tức thì
      holdCounterRef.current = Math.max(0, holdCounterRef.current - 1);
    }
  };

  // Capture current angle snapshot
  const triggerCaptureCurrentAngle = () => {
    if (!videoRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    lastCaptureTimeRef.current = Date.now();
    holdCounterRef.current = 0;

    const currentStepIndex = activeStepRef.current;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isCapturingRef.current = false;
      return;
    }

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) {
        isCapturingRef.current = false;
        return;
      }
      const angleKey = ANGLES_CONFIG[currentStepIndex].key;
      const previewUrl = URL.createObjectURL(blob);

      setCapturedImages((prev) => ({
        ...prev,
        [angleKey]: { blob, previewUrl },
      }));

      // BẬT HIỆU ỨNG THÀNH CÔNG ĐƠN GIẢN, TINH TẾ (XÓA BỎ CONFETTI BẮN TỨ TUNG)
      setStepSuccessFlash(ANGLES_CONFIG[currentStepIndex].label);
      setIsStepTransitioning(true);
      isStepTransitioningRef.current = true;

      // Khoảng nghỉ 1.3s để người dùng kịp đọc góc tiếp theo và chuẩn bị tư thế
      setTimeout(() => {
        setStepSuccessFlash(null);
        setIsStepTransitioning(false);
        isStepTransitioningRef.current = false;
        isCapturingRef.current = false;
        lastCaptureTimeRef.current = Date.now();

        // Chuyển sang góc tiếp theo
        if (currentStepIndex < 4) {
          const nextStep = currentStepIndex + 1;
          activeStepRef.current = nextStep;
          setActiveStep(nextStep);
        }
      }, 1300);
    }, 'image/jpeg', 0.95);
  };

  // Manual image upload
  const handleManualUpload = (key: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCapturedImages((prev) => ({
      ...prev,
      [key]: { blob: file, previewUrl },
    }));
  };

  // Submit all angles to backend
  const handleSaveAllAngles = async () => {
    const validCount = Object.values(capturedImages).filter(Boolean).length;
    if (validCount === 0) {
      setErrorMsg('Vui lòng chụp hoặc tải lên ít nhất 1 góc khuôn mặt.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Gửi các góc khuôn mặt sang backend để trích xuất 512D ArcFace vector và lưu vào trường faceAngles của users
      const formData = new FormData();
      formData.append('employee_id', currentEmployee._id || currentEmployee.email);
      if (currentEmployee.fullName) formData.append('full_name', currentEmployee.fullName);
      if (currentEmployee.department) formData.append('department', currentEmployee.department);

      for (const [key, item] of Object.entries(capturedImages)) {
        if (!item) continue;
        if (item.blob) {
          formData.append(`image_${key}`, item.blob, `${key}.jpg`);
        } else if (item.existingUrl) {
          formData.append(`image_${key}`, item.existingUrl);
        }
      }

      const res = await apiClient.post('/face/enroll-multi-angle', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Đã lưu vector 5 góc khuôn mặt vào hệ thống thành công!');
        toast.success(`Đã lưu vector các góc khuôn mặt cho ${currentEmployee.fullName}!`);
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });

        setTimeout(() => {
          stopCamera();
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      } else {
        throw new Error(res.data?.message || 'Lỗi khi lưu dữ liệu khuôn mặt.');
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Lỗi kết nối máy chủ.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete all face data
  const handleDeleteFace = async () => {
    if (!currentEmployee?._id) return;
    if (!window.confirm(`Xác nhận xóa toàn bộ dữ liệu khuôn mặt của "${currentEmployee.fullName}"?`)) {
      return;
    }

    try {
      setDeleting(true);
      const res = await apiClient.delete(`/users/${currentEmployee._id}/face`);
      // Đồng thời xoá vector trong Face AI
      try {
        await apiClient.delete(`/face/faces/${currentEmployee._id}`);
      } catch (_) {}

      if (res.data?.success) {
        toast.success(`Đã xóa dữ liệu khuôn mặt của ${currentEmployee.fullName}`);
        stopCamera();
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể xóa dữ liệu khuôn mặt');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !currentEmployee) return null;

  const capturedCount = Object.values(capturedImages).filter(Boolean).length;
  const isAlreadyRegistered = Boolean(currentEmployee.isFaceRegistered || currentEmployee.facePhoto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl p-6 rounded-3xl shadow-2xl border border-slate-200 max-h-[94vh] overflow-y-auto flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div>
            <h2 className="text-xl text-slate-900 font-black tracking-tight flex items-center gap-2">
              Đăng Ký Khuôn Mặt 5 Góc (Apple FaceID 3D)
              {isAlreadyRegistered && (
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Đã có hồ sơ
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhân sự: <strong className="text-indigo-600 font-bold">{currentEmployee.fullName}</strong> ({currentEmployee.email})
              {currentEmployee.department && ` — Phòng ban: ${currentEmployee.department}`}
            </p>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 5-Angle Steps Banner */}
        <div className="grid grid-cols-5 gap-2">
          {ANGLES_CONFIG.map((ang, idx) => {
            const Icon = ang.icon;
            const isDone = Boolean(capturedImages[ang.key]);
            const isActive = activeStep === idx;

            return (
              <button
                key={ang.key}
                type="button"
                onClick={() => setActiveStep(idx)}
                className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-700 shadow-xs'
                    : isDone
                    ? 'border-emerald-300 bg-emerald-50/70 text-emerald-700'
                    : 'border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon size={14} className={isDone ? 'text-emerald-600' : isActive ? 'text-indigo-600' : 'text-slate-400'} />
                  <span className="text-xs font-bold truncate">{ang.label}</span>
                </div>
                <span className="text-[10px] font-semibold">
                  {isDone ? '✓ Đã chụp' : isActive ? 'Đang quét' : 'Chưa có'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode Selector & Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tabMode === 'camera' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTabMode('camera')}
            >
              <Camera size={14} /> Camera Quét Tự Động
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                tabMode === 'upload' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTabMode('upload')}
            >
              <Upload size={14} /> Tải Ảnh Lên
            </button>
          </div>

          {tabMode === 'camera' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  showMesh
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => setShowMesh(!showMesh)}
              >
                <span>{showMesh ? 'Lưới 3D: Bật' : 'Lưới 3D: Tắt'}</span>
              </button>
              <button
                type="button"
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  autoScanEnabled
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => setAutoScanEnabled(!autoScanEnabled)}
              >
                <span>{autoScanEnabled ? 'Tự Động Chụp: Bật' : 'Tự Động Chụp: Tắt'}</span>
              </button>
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                FPS: {fps}
              </span>
            </div>
          )}
        </div>

        {/* Mode 1: Live Camera */}
        {tabMode === 'camera' && (
          <div className="grid grid-cols-1 md:grid-cols-[1.55fr_1fr] gap-4">
            {/* Video & 3D HUD Canvas */}
            <div
              className={`relative w-full h-[360px] bg-slate-950 rounded-3xl overflow-hidden border-2 flex items-center justify-center transition-all duration-300 shadow-inner ${
                stepSuccessFlash
                  ? 'border-emerald-400 ring-4 ring-emerald-400/40 shadow-emerald-500/30'
                  : telemetry.isTargetMet
                  ? 'border-emerald-500 shadow-emerald-500/20'
                  : 'border-slate-800'
              }`}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover scale-x-[-1]"
                playsInline
                muted
                autoPlay
              />
              <canvas
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Instruction Pill */}
              <div
                className={`absolute top-3 px-4 py-1.5 rounded-full border text-xs font-bold text-white flex items-center gap-2 pointer-events-none shadow-lg transition-all duration-200 z-10 ${
                  initialWarmupSeconds > 0
                    ? 'bg-amber-600/95 border-amber-400 shadow-amber-500/20'
                    : isStepTransitioning
                    ? 'bg-emerald-600/95 border-emerald-400 shadow-emerald-500/20'
                    : telemetry.isTargetMet
                    ? 'bg-emerald-600/95 border-emerald-400 shadow-emerald-500/30'
                    : 'bg-slate-900/90 border-white/20'
                }`}
              >
                <currentAngleObj.icon size={15} className={telemetry.isTargetMet || isStepTransitioning ? 'text-white' : 'text-indigo-300'} />
                <span>
                  {initialWarmupSeconds > 0
                    ? `⏳ Chuẩn bị: Hãy nhìn thẳng vào camera (sẵn sàng sau ${initialWarmupSeconds}s)...`
                    : isStepTransitioning
                    ? '✓ Đã chụp thành công! Đang chuyển góc...'
                    : telemetry.guidanceText || currentAngleObj.instruction}
                </span>
              </div>

              {/* Progress Bar under Instruction Pill when holding target */}
              {telemetry.isTargetMet && !isStepTransitioning && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-48 h-2 bg-slate-900/90 rounded-full border border-emerald-400/50 overflow-hidden shadow-md z-10 pointer-events-none">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-150 ease-out shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                    style={{ width: `${telemetry.progress}%` }}
                  />
                </div>
              )}

              {/* Step Success Overlay (Thay thế pháo hoa confetti bằng hiệu ứng thanh lịch) */}
              {stepSuccessFlash && (
                <div className="absolute inset-0 bg-emerald-950/35 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-150 z-20 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-500/60 mb-2.5 animate-in zoom-in-75 duration-200 ring-4 ring-white/30">
                    <Check size={36} strokeWidth={3.5} />
                  </div>
                  <div className="px-5 py-2 rounded-full bg-slate-900/95 border border-emerald-400 text-white font-black text-xs shadow-2xl tracking-wide flex items-center gap-1.5">
                    <span>✓ Đã thu thập:</span>
                    <strong className="text-emerald-400">{stepSuccessFlash}</strong>
                  </div>
                </div>
              )}

              {/* Realtime Pose Status */}
              <div className="absolute bottom-3 right-3 pointer-events-none z-10">
                <div
                  className={`px-3 py-1 rounded-full border text-xs font-bold shadow-md ${
                    faceInFrame
                      ? telemetry.isTargetMet
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900/90 border-white/20 text-slate-200'
                      : 'bg-rose-950/90 border-rose-500 text-rose-300'
                  }`}
                >
                  {currentDetectedPose}
                </div>
              </div>
            </div>

            {/* Step Card & Snapshot Preview */}
            <div className="flex flex-col justify-between gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <currentAngleObj.icon size={20} className="text-indigo-600" />
                    <h4 className="text-base font-black text-slate-900">{currentAngleObj.label}</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    Góc {activeStep + 1}/5
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">{currentAngleObj.desc}</p>

                <div className="p-3 bg-indigo-50/70 border border-indigo-200/60 rounded-2xl text-[11px] text-indigo-900 leading-relaxed">
                  💡 <strong>Chỉ dẫn:</strong> {(currentAngleObj as any).tip || currentAngleObj.instruction}
                </div>

                {/* Realtime Telemetry Angles Gauge */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex flex-col items-center">
                    <span className="text-slate-400 font-medium text-[10px]">Quay ngang (Yaw)</span>
                    <strong className={Math.abs(telemetry.yaw) > 7 ? 'text-indigo-600 font-bold' : 'text-slate-700'}>
                      {telemetry.yaw > 0 ? `Trái +${telemetry.yaw}°` : telemetry.yaw < 0 ? `Phải ${telemetry.yaw}°` : '0°'}
                    </strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex flex-col items-center">
                    <span className="text-slate-400 font-medium text-[10px]">Ngước/Cúi (Pitch)</span>
                    <strong className={Math.abs(telemetry.pitch) > 5 ? 'text-indigo-600 font-bold' : 'text-slate-700'}>
                      {telemetry.pitch > 0 ? `Ngước +${telemetry.pitch}°` : telemetry.pitch < 0 ? `Cúi ${telemetry.pitch}°` : '0°'}
                    </strong>
                  </div>
                </div>

                {capturedImages[currentAngleObj.key] ? (
                  <div className="mt-1 p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
                    <img
                      src={capturedImages[currentAngleObj.key]?.previewUrl}
                      alt="captured"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
                    />
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">
                        ✓ Đã lưu ảnh
                      </span>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Bấm nút bên dưới nếu bạn muốn chụp lại góc này
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 p-2.5 bg-white border border-slate-200/80 rounded-2xl text-center">
                    Hệ thống sẽ tự động chụp khi bạn xoay đúng góc và giữ yên 1 giây.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={triggerCaptureCurrentAngle}
                  disabled={!isCameraActive}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-all"
                >
                  <Camera size={16} />
                  <span>{capturedImages[currentAngleObj.key] ? 'Chụp Lại Góc Này' : 'Chụp Ngay'}</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep(activeStep - 1)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Góc trước
                  </button>
                  <button
                    type="button"
                    disabled={activeStep === 4}
                    onClick={() => setActiveStep(activeStep + 1)}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Góc tiếp theo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: Manual Upload */}
        {tabMode === 'upload' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {ANGLES_CONFIG.map((ang) => {
              const Icon = ang.icon;
              const imgData = capturedImages[ang.key];

              return (
                <div
                  key={ang.key}
                  className="p-3.5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 text-center flex flex-col items-center gap-2"
                >
                  <Icon size={18} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">{ang.label}</span>

                  {imgData ? (
                    <img
                      src={imgData.previewUrl}
                      alt={ang.key}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-xs"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-slate-400">
                      Trống
                    </div>
                  )}

                  <input
                    type="file"
                    id={`upload_${ang.key}`}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleManualUpload(ang.key, e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor={`upload_${ang.key}`}
                    className="w-full py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 border border-slate-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Upload size={11} /> {imgData ? 'Đổi ảnh' : 'Chọn ảnh'}
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-2">
          <div className="text-xs text-slate-500 flex items-center gap-3">
            <span>
              Đã thu thập:{' '}
              <strong className={capturedCount >= 3 ? 'text-emerald-600 font-black' : 'text-amber-600 font-bold'}>
                {capturedCount}/5
              </strong>{' '}
              góc khuôn mặt
            </span>

            {isAlreadyRegistered && (
              <button
                type="button"
                onClick={handleDeleteFace}
                disabled={deleting}
                className="text-rose-600 hover:text-rose-700 hover:underline text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Xóa hồ sơ khuôn mặt
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              onClick={() => { stopCamera(); onClose(); }}
            >
              Đóng
            </button>
            <button
              type="button"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              onClick={handleSaveAllAngles}
              disabled={submitting || capturedCount === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Lưu Hồ Sơ ({capturedCount} Góc)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FaceRegistrationModal;
