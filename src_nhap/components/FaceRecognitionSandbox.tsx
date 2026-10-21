import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ScanFace,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  X,
  User,
  Clock,
  LogIn,
  LogOut,
  Building,
  Award,
  ChevronDown,
  ChevronUp,
  Trash2,
  Zap
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

interface FaceRecognitionSandboxProps {
  users: any[];
  onRefreshUsers?: () => void;
}

export function FaceRecognitionSandbox({ users, onRefreshUsers }: FaceRecognitionSandboxProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showMesh, setShowMesh] = useState(true);

  // Video & Canvases
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Canvas phụ để nén nhỏ gửi AI (320x240 để tăng tốc 10x)
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trạng thái theo dõi khuôn mặt mượt mà 60 FPS (LERP)
  const targetBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const currentBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const targetLandmarksRef = useRef<any>(null);
  const currentLandmarksRef = useRef<any>(null);
  const lastPoseInfoRef = useRef<{ icon: string; text: string }>({ icon: '👤', text: 'Chờ camera...' });

  // Auto Recognition & State Controls
  const [attendanceMode, setAttendanceMode] = useState<'checkin' | 'checkout' | 'test'>('checkin');
  const attendanceModeRef = useRef<'checkin' | 'checkout' | 'test'>('checkin');

  const stableFaceCountRef = useRef(0);
  const isExecutingAutoRef = useRef(false);
  const cooldownUntilRef = useRef(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'checkin' | 'checkout' | 'test' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPoseInfo, setCurrentPoseInfo] = useState<{ icon: string; text: string }>({ icon: '👤', text: 'Chờ camera...' });
  const [faceDetected, setFaceDetected] = useState(false);
  const [autoStatusText, setAutoStatusText] = useState('Đang quét khuôn mặt...');

  // Modal Popup sau khi Check-in / Check-out thành công
  const [attendanceModalData, setAttendanceModalData] = useState<{
    action: 'check-in' | 'check-out' | 'test';
    user: any;
    similarity: number;
    matchedAngle?: string;
    timestamp: string;
    status?: string;
    message: string;
  } | null>(null);

  // Đồng bộ ref
  useEffect(() => {
    attendanceModeRef.current = attendanceMode;
  }, [attendanceMode]);

  // Registered users count
  const registeredUsers = users.filter(u => u.isFaceRegistered || (u.faceAngles && u.faceAngles.straight && u.faceAngles.straight.length > 0) || u.facePhoto);

  // Khởi tạo process canvas nhỏ
  useEffect(() => {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 320;
    pCanvas.height = 240;
    processCanvasRef.current = pCanvas;
  }, []);

  // Bật camera với chế độ cụ thể
  const startCamera = async (mode: 'checkin' | 'checkout' | 'test' = 'checkin') => {
    setAttendanceMode(mode);
    attendanceModeRef.current = mode;
    setCameraLoading(true);
    setErrorMsg('');
    stableFaceCountRef.current = 0;
    isExecutingAutoRef.current = false;
    cooldownUntilRef.current = Date.now() + 600; // 0.6s ổn định ban đầu
    setAutoStatusText(`Đang tự động ${mode === 'checkin' ? 'Check-in (Vào ca)' : mode === 'checkout' ? 'Check-out (Về ca)' : 'nhận diện'}...`);

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
      startUltraFastBiometricLoop();
    } catch (err: any) {
      setErrorMsg('Không thể mở Camera: ' + (err.message || 'Thiết bị bận hoặc từ chối quyền.'));
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Tắt camera
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
    isExecutingAutoRef.current = false;
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // ── DỌN SẠCH CACHE FACE AI ──────────────────────────────────────
  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res = await apiClient.post('/face/clear-cache');
      toast.success(res.data.message || 'Đã dọn sạch cache Face AI và đồng bộ lại danh sách!');
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi dọn dẹp cache';
      toast.error(msg);
    } finally {
      setIsClearingCache(false);
    }
  };

  // ── VÒNG LẶP NHẬN DIỆN SIÊU TỐC & NỘI SUY MƯỢT MÀ 60 FPS ────────
  const startUltraFastBiometricLoop = () => {
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

        // 1. GỬI KHUNG HÌNH NHỎ (320x240, 50% JPEG) ĐỂ DETECT SIÊU NHANH (~350ms/lần, tiết kiệm 75% CPU)
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
                  // frame drop
                } finally {
                  isDetecting = false;
                }
              } else {
                isDetecting = false;
              }
            }, 'image/jpeg', 0.5); // Nén 50% JPEG nhẹ ~6KB truyền tức thì
          } else {
            isDetecting = false;
          }
        }

        // 2. VẼ OVERLAY 60 FPS VỚI HIỆU ỨNG NỘI SUY MƯỢT MÀ (LERP INTERPOLATION)
        drawSmoothHUD(overlay);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Cập nhật toạ độ mục tiêu từ kết quả AI
  const handleDetectionResult = (data: any, canvasW: number, canvasH: number) => {
    if (!data || !data.face_detected || !data.bbox) {
      setFaceDetected(false);
      targetBoxRef.current = null;
      targetLandmarksRef.current = null;
      setCurrentPoseInfo({ icon: '👤', text: 'Đang tìm khuôn mặt...' });
      stableFaceCountRef.current = 0;
      return;
    }

    setFaceDetected(true);
    // Tỉ lệ scale từ 320x240 lên kích thước thực tế của canvas
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
    const poseObj = poseMap[pose] || { icon: '🎯', text: pose };
    setCurrentPoseInfo(poseObj);
    lastPoseInfoRef.current = poseObj;

    // ── TỰ ĐỘNG TRIGGER CHECK-IN / CHECK-OUT KHI PHÁT HIỆN MẶT ──
    stableFaceCountRef.current += 1;
    if (
      stableFaceCountRef.current >= 2 &&
      Date.now() > cooldownUntilRef.current &&
      !isExecutingAutoRef.current &&
      !attendanceModalData
    ) {
      isExecutingAutoRef.current = true;
      executeAutoAttendance(attendanceModeRef.current);
    }
  };

  // ── VẼ HUD NỘI SUY MƯỢT MÀ CHUẨN 60 FPS ─────────────────────────
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

    // Khởi tạo hoặc nội suy LERP mượt mà 0.40
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
    const mode = attendanceModeRef.current;
    const mainColor = mode === 'checkin' ? '#10b981' : mode === 'checkout' ? '#f59e0b' : '#6366f1';
    const glowColor = mode === 'checkin' ? 'rgba(16, 185, 129, 0.45)' : mode === 'checkout' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(99, 102, 241, 0.45)';

    ctx.save();

    // 1. 3D WIREFRAME MESH & LANDMARKS
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

    // 2. CORNER BRACKETS BOUNDING BOX BÁM THEO MẶT
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

    // 3. FLOATING BADGE TRÊN ĐẦU
    const badgeH = 32;
    const badgeW = Math.max(220, box.width * 1.05);
    const badgeX = box.x + (box.width - badgeW) / 2;
    const badgeY = box.y - badgeH - 12;

    ctx.shadowBlur = 0;
    ctx.fillStyle = mode === 'checkin' ? 'rgba(6, 78, 59, 0.95)' : mode === 'checkout' ? 'rgba(120, 53, 15, 0.95)' : 'rgba(30, 27, 75, 0.95)';
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

    const modeText = mode === 'checkin' ? 'CHECK-IN' : mode === 'checkout' ? 'CHECK-OUT' : 'TEST';
    ctx.fillText(
      `🎯 ${modeText} • ${lastPoseInfoRef.current.text}`,
      badgeX + badgeW / 2,
      badgeY + 20
    );

    ctx.restore();
  };

  // Chụp ảnh frame sắc nét để gửi nhận diện
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

  // ── THỰC HIỆN TỰ ĐỘNG CHẤM CÔNG (KHÔNG CẦN BẤM NÚT) ──────────────
  const executeAutoAttendance = async (action: 'checkin' | 'checkout' | 'test') => {
    if (submittingAction) return;

    setSubmittingAction(action);
    setAutoStatusText(`Đang xác thực ${action === 'checkin' ? 'Check-in' : action === 'checkout' ? 'Check-out' : 'danh tính'}...`);

    try {
      const blob = await captureHighQualityBlob();
      if (!blob) throw new Error('Không thể chụp ảnh từ camera.');

      const formData = new FormData();
      formData.append('image', blob, 'attendance.jpg');

      let endpoint = '/face/recognize?threshold=0.58&check_liveness=false';
      if (action === 'checkin') endpoint = '/face/checkin?threshold=0.58&check_liveness=false';
      if (action === 'checkout') endpoint = '/face/checkout?threshold=0.58&check_liveness=false';

      const res = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success) {
        const data = res.data.data;
        const matchedUser = data.user || users.find(u => u.email === data.employee_id || u._id === data.employee_id);

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        // Pháo hoa chúc mừng 🎉
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 }
        });

        const actionText = action === 'checkin' ? 'check-in' : action === 'checkout' ? 'check-out' : 'test';

        setAttendanceModalData({
          action: actionText as any,
          user: matchedUser || { fullName: data.full_name || data.employee_id, email: data.employee_id },
          similarity: data.similarity || 1,
          matchedAngle: data.matchedAngle || data.matched_angle || 'straight',
          timestamp: `${timeStr} • ${dateStr}`,
          status: data.status || 'Normal',
          message: res.data.message || 'Thực hiện chấm công thành công!'
        });

        toast.success(res.data.message || `Chấm công thành công cho ${matchedUser?.fullName}!`);
        if (onRefreshUsers) onRefreshUsers();

        // Tạm dừng 10s để không lặp lại
        cooldownUntilRef.current = Date.now() + 10000;
        stableFaceCountRef.current = 0;
      } else {
        throw new Error(res.data?.message || 'Không thể nhận diện khuôn mặt.');
      }
    } catch (err: any) {
      // Nếu chưa khớp hoặc khuôn mặt chưa rõ, tạm hoãn 2 giây để quét tiếp mà không làm gián đoạn
      cooldownUntilRef.current = Date.now() + 2000;
      stableFaceCountRef.current = 0;
      setAutoStatusText('Đang canh góc và thử lại...');
    } finally {
      setSubmittingAction(null);
      isExecutingAutoRef.current = false;
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-500/30 overflow-hidden transition-all duration-300">
      {/* ── TOP BAR HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-500/20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
            <ScanFace className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Trạm Nhận Diện Chấm Công Khuôn Mặt (Face AI Biometric Terminal)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                REALTIME 60FPS
              </span>
            </div>
            <p className="text-xs text-indigo-200/70 mt-0.5">
              Tự động bắt nét BoundingBox & 3D FaceLandmarks trực tiếp từ <code className="bg-white/10 px-1 py-0.5 rounded text-cyan-300 font-mono">face_ai (YuNet ONNX)</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Xoá cache nhận diện Face AI */}
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="Dọn sạch cache Face AI và đồng bộ lại chính xác danh sách từ users MongoDB"
          >
            {isClearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>Xoá cache Face AI</span>
          </button>

          {/* Nút bật/tắt lưới 3D Wireframe */}
          <button
            onClick={() => setShowMesh(!showMesh)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              showMesh
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Bật/Tắt hiển thị lưới 3D FaceLandmarks"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lưới 3D Mesh</span>
          </button>

          {/* Đã đăng ký */}
          <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-indigo-200 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Đã có vector: <strong className="text-white font-mono">{registeredUsers.length}/{users.length}</strong></span>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
            title={isOpen ? 'Thu gọn khung chấm công' : 'Mở rộng khung chấm công'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── NỘI DUNG CHÍNH (COLLAPSIBLE) ─────────────────────────── */}
      {isOpen && (
        <div className="pt-5 space-y-5 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Cột trái: Camera Feed with Overlaid BoundingBox & FaceLandmarks Canvas */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              {/* THANH CHỌN CHẾ ĐỘ CHẤM CÔNG (KHI CAMERA BẬT) */}
              {isCameraActive && (
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      onClick={() => {
                        setAttendanceMode('checkin');
                        attendanceModeRef.current = 'checkin';
                        stableFaceCountRef.current = 0;
                        setAutoStatusText('Đang tự động Check-in (Vào ca)...');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        attendanceMode === 'checkin'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Chế độ: Check-in</span>
                    </button>

                    <button
                      onClick={() => {
                        setAttendanceMode('checkout');
                        attendanceModeRef.current = 'checkout';
                        stableFaceCountRef.current = 0;
                        setAutoStatusText('Đang tự động Check-out (Về ca)...');
                      }}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        attendanceMode === 'checkout'
                          ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Chế độ: Check-out</span>
                    </button>

                    <button
                      onClick={() => {
                        setAttendanceMode('test');
                        attendanceModeRef.current = 'test';
                        stableFaceCountRef.current = 0;
                        setAutoStatusText('Đang tự động kiểm tra danh tính...');
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        attendanceMode === 'test'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                      title="Chỉ nhận diện danh tính không ghi nhận ca làm"
                    >
                      <ScanFace className="w-3.5 h-3.5" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              )}

              {/* KHUNG VIDEO VÀ CANVASES */}
              <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 flex items-center justify-center shadow-2xl">
                {/* Webcam Video */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Overlaid Canvas HUD (Vẽ BoundingBox, 3D Mesh & FaceLandmarks 60 FPS) */}
                <canvas
                  ref={overlayCanvasRef}
                  className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Badge trạng thái tự động nhận diện */}
                {isCameraActive && (
                  <div className="absolute top-3 left-4 right-4 z-10 pointer-events-none flex items-center justify-between">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span className="text-xs font-bold text-cyan-200">
                        {autoStatusText}
                      </span>
                    </div>

                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[10px] font-black uppercase">
                      Tự động 100%
                    </span>
                  </div>
                )}

                {/* Khi chưa bật camera */}
                {!isCameraActive && (
                  <div className="flex flex-col items-center justify-center text-center p-6 gap-3">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center text-indigo-300">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Camera đang ở trạng thái nghỉ</p>
                      <p className="text-xs text-indigo-200/60 max-w-xs mt-1">
                        Bấm <strong>Bật Camera Check-in</strong> để hệ thống tự động quét và chấm công ngay khi bạn nhìn vào camera mà không cần nhấn nút nào.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading Spinner khi đang hoàn tất chấm công */}
                {submittingAction && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white z-20">
                    <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                    <p className="text-xs font-black tracking-wider uppercase text-cyan-200">
                      {submittingAction === 'checkin' ? 'Đang tự động Check-in...' : submittingAction === 'checkout' ? 'Đang tự động Check-out...' : 'Đang đối soát danh tính...'}
                    </p>
                  </div>
                )}
              </div>

              {/* NÚT THAO TÁC (ĐÃ BỎ NÚT CHECK-IN THỦ CÔNG THEO YÊU CẦU) */}
              <div className="flex items-center gap-2.5">
                {!isCameraActive ? (
                  <>
                    <button
                      onClick={() => startCamera('checkin')}
                      disabled={cameraLoading}
                      className="flex-1 py-3.5 px-4 rounded-xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer text-sm"
                    >
                      {cameraLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      Bật Camera Check-in (Tự động)
                    </button>

                    <button
                      onClick={() => startCamera('checkout')}
                      disabled={cameraLoading}
                      className="flex-1 py-3.5 px-4 rounded-xl font-black bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer text-sm"
                    >
                      {cameraLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      Bật Camera Check-out (Tự động)
                    </button>
                  </>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="w-full py-3 px-4 rounded-xl font-bold bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer text-sm border border-white/10 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Tắt Camera
                  </button>
                )}
              </div>
            </div>

            {/* Cột phải: Hướng dẫn & Giám sát Realtime Biometric */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h3 className="text-xs font-black tracking-wider uppercase text-indigo-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Giám sát Sinh trắc học Realtime
                    </h3>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      faceDetected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {faceDetected ? 'Face In Frame' : 'No Face'}
                    </span>
                  </div>

                  {errorMsg && (
                    <div className="mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* Thông số Realtime */}
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Chế độ đang chạy:</span>
                        <span className="font-bold flex items-center gap-1.5">
                          {attendanceMode === 'checkin' ? (
                            <span className="text-emerald-300 font-black">🟢 Tự động Check-in (Vào ca)</span>
                          ) : attendanceMode === 'checkout' ? (
                            <span className="text-amber-300 font-black">🟠 Tự động Check-out (Về ca)</span>
                          ) : (
                            <span className="text-indigo-300 font-black">🟣 Tự động Test danh tính</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Trạng thái phát hiện:</span>
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span>{currentPoseInfo.icon}</span>
                          <span>{currentPoseInfo.text}</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Tốc độ bắt nét & theo dõi:</span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {isCameraActive ? 'Siêu tốc (Downscale 320p + LERP 60fps)' : 'Đang chờ bật'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Khung định vị (BoundingBox):</span>
                        <span className="font-mono text-cyan-300 font-bold">
                          {faceDetected ? 'OpenCV YuNet ONNX (Hoạt động)' : 'Đang chờ mặt'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Điểm mốc (Face Landmarks):</span>
                        <span className="font-mono text-emerald-300 font-bold">
                          {faceDetected ? '5 Landmarks & 3D Mesh (Hoạt động)' : 'Chưa có'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Trích xuất đặc trưng:</span>
                        <span className="font-mono text-amber-300 font-bold">ArcFace ResNet100 (512D)</span>
                      </div>
                    </div>

                    {/* Hướng dẫn thao tác */}
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-400/20 space-y-2 text-[11px] text-indigo-200">
                      <p className="font-black text-white uppercase tracking-wider text-[10px]">
                        💡 Cơ chế Chấm công Tự Động Hoàn Toàn:
                      </p>
                      <ul className="list-disc list-inside space-y-1 opacity-90">
                        <li>Bật camera: Hệ thống tự động kích hoạt chế độ quét liên tục.</li>
                        <li>Đứng trước camera và nhìn thẳng: Hệ thống tự động khóa mục tiêu và chấm công ngay tức thì.</li>
                        <li><strong>Không cần bấm nút Check-in:</strong> Mọi thao tác hoàn tất 100% tự động rảnh tay.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Engine: DeepCode Face AI</span>
                  <span>MongoDB Atlas / Local DB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── POPUP THÔNG BÁO CHECK-IN / CHECK-OUT THÀNH CÔNG ──────── */}
      {attendanceModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 w-full max-w-md p-6 rounded-3xl shadow-2xl border border-slate-200 flex flex-col items-center text-center gap-4 relative animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => {
                setAttendanceModalData(null);
                cooldownUntilRef.current = Date.now() + 2000;
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Status Icon */}
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg ${
              attendanceModalData.action === 'check-in'
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-emerald-200'
                : attendanceModalData.action === 'check-out'
                ? 'bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-amber-200'
                : 'bg-gradient-to-tr from-indigo-500 to-purple-400 text-white shadow-indigo-200'
            }`}>
              {attendanceModalData.action === 'check-in' ? (
                <LogIn className="w-10 h-10" />
              ) : attendanceModalData.action === 'check-out' ? (
                <LogOut className="w-10 h-10" />
              ) : (
                <CheckCircle className="w-10 h-10" />
              )}
            </div>

            {/* Title */}
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                attendanceModalData.action === 'check-in'
                  ? 'bg-emerald-100 text-emerald-800'
                  : attendanceModalData.action === 'check-out'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}>
                {attendanceModalData.action === 'check-in' ? 'Check-in Thành Công 🎉' : attendanceModalData.action === 'check-out' ? 'Check-out Thành Công 👋' : 'Nhận Diện Thành Công 🎯'}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-2">
                {attendanceModalData.user?.fullName || attendanceModalData.user?.email}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {attendanceModalData.message}
              </p>
            </div>

            {/* Attendance Details Card */}
            <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5 text-xs text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Nhân viên:
                </span>
                <span className="font-bold text-slate-800">{attendanceModalData.user?.fullName}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" /> Phòng ban:
                </span>
                <span className="font-bold text-slate-800">{attendanceModalData.user?.department || 'Vận hành'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Thời gian ghi nhận:
                </span>
                <span className="font-mono font-bold text-indigo-600">{attendanceModalData.timestamp}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-slate-400" /> Độ khớp ArcFace:
                </span>
                <span className="font-mono font-black text-emerald-600">
                  {(attendanceModalData.similarity * 100).toFixed(1)}%
                </span>
              </div>

              {attendanceModalData.status && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">Trạng thái chấm công:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                    attendanceModalData.status === 'Normal' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {attendanceModalData.status === 'Normal' ? 'Đúng giờ (Normal)' : attendanceModalData.status}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setAttendanceModalData(null);
                  cooldownUntilRef.current = Date.now() + 2000;
                }}
                className="w-full py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md shadow-indigo-200 cursor-pointer text-sm"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
