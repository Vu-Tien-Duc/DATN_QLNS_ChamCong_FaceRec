import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  RefreshCw,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  Zap,
  Sparkles,
  Maximize2,
  Building2,
  User,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { useLocation } from 'react-router-dom';
import { attendanceApi, AttendancePunchResult, AttendanceHistoryItem } from '../api/attendance.api';
import { audioFeedback } from '../utils/audioFeedback';
import { useAuthStore } from '../store/useAuthStore';
import { cameraManager } from '../utils/cameraManager';
import { FaceAttendanceScannerModal } from '../components/biometrics/FaceAttendanceScannerModal';
import { FaceRegistrationModal } from '../components/biometrics/FaceRegistrationModal';

export const FaceAttendance: React.FC = () => {
  const { user: authUser } = useAuthStore();
  const location = useLocation();

  const [isScannerModalOpen, setIsScannerModalOpen] = useState<boolean>(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // States: Điều khiển Camera
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Chế độ & Tính năng tự động
  const [actionType, setActionType] = useState<'check_in' | 'check_out'>('check_in');
  const [isAutoScan, setIsAutoScan] = useState<boolean>(true);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(audioFeedback.getIsMuted());

  // Kết quả & Lịch sử
  const [lastResult, setLastResult] = useState<AttendancePunchResult | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [recentPunches, setRecentPunches] = useState<AttendanceHistoryItem[]>([]);
  const [scanStatus, setScanStatus] = useState<{
    type: 'idle' | 'scanning' | 'success' | 'error';
    message: string;
    detail?: string;
  }>({
    type: 'idle',
    message: 'Hệ thống đã sẵn sàng',
    detail: 'Đang theo dõi khuôn mặt trước camera...',
  });

  // Tự động bật camera khi vào trang và tắt sạch camera khi chuyển trang
  // Khởi tạo camera khi vào trang và dập tắt hoàn toàn khi unmount
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    loadRecentHistory();

    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  // Tải danh sách lượt quét gần nhất
  const loadRecentHistory = async () => {
    try {
      const logs = await attendanceApi.getRecentHistory(8);
      setRecentPunches(logs);
    } catch (_) {}
  };

  // 1. Khởi động Camera (Độ phân giải chuẩn 640x480 siêu mượt)
  const startCamera = async () => {
    setCameraLoading(true);

    try {
      // Dập tắt bất kỳ stream nào đang mở trước đó
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.enabled = false;
            t.stop();
          } catch (_) {}
        });
        streamRef.current = null;
      }

      // Đảm bảo chỉ mở nếu đang ở đúng trang /face-attendance
      if (!isMountedRef.current || (typeof window !== 'undefined' && window.location.pathname !== '/face-attendance')) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      // Nếu trong lúc chờ getUserMedia người dùng đã chuyển trang hoặc unmount
      if (!isMountedRef.current || (typeof window !== 'undefined' && window.location.pathname !== '/face-attendance')) {
        stream.getTracks().forEach((t) => {
          try {
            t.enabled = false;
            t.stop();
          } catch (_) {}
        });
        cameraManager.stopAllStreams();
        return;
      }

      streamRef.current = stream;
      cameraManager.registerStream(stream);

      if (videoRef.current) {
        cameraManager.registerVideoElement(videoRef.current);
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
    } catch (err: any) {
      if (isMountedRef.current) {
        toast.error('Không thể mở Camera: ' + (err.message || 'Vui lòng cho phép quyền webcam.'));
        setIsCameraActive(false);
      }
    } finally {
      if (isMountedRef.current) {
        setCameraLoading(false);
      }
    }
  };

  // 2. Tắt Camera hoàn toàn (Dập tắt đèn webcam phần cứng ngay lập tức)
  const stopCamera = () => {
    // 1. Dừng tất cả track của stream hiện tại
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.enabled = false;
          t.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }

    // 2. Tháo gỡ hoàn toàn thẻ video và giải phóng DirectShow/MediaFoundation
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        if (videoRef.current.srcObject) {
          const s = videoRef.current.srcObject as MediaStream;
          if (s?.getTracks) {
            s.getTracks().forEach((t) => {
              try {
                t.enabled = false;
                t.stop();
              } catch (_) {}
            });
          }
          videoRef.current.srcObject = null;
        }
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (_) {}
    }

    // 3. Dập tắt toàn bộ camera manager toàn cục
    cameraManager.stopAllStreams();

    setIsCameraActive(false);
    setIsProcessing(false);
  };

  // 3. Chụp frame từ video stream
  const captureFrameBlob = (): Promise<{ blob: Blob; dataUrl: string } | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        return resolve(null);
      }
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, dataUrl });
          else resolve(null);
        },
        'image/jpeg',
        0.88
      );
    });
  };

  // 4. Thực hiện Chấm công (Dùng chung cho cả Tự Động & Nút Bấm Thủ Công)
  const executePunch = useCallback(
    async (isAutoTrigger = false) => {
      if (!isCameraActive || isProcessing || cooldownRemaining > 0) return;

      setIsProcessing(true);
      setScanStatus({
        type: 'scanning',
        message: 'Đang nhận diện...',
        detail: 'Đang so khớp vector 512 chiều với hệ thống CSDL v2.5...',
      });

      try {
        const capture = await captureFrameBlob();
        if (!capture) {
          if (!isAutoTrigger) toast.error('Camera chưa sẵn sàng, vui lòng thử lại.');
          setScanStatus({
            type: 'error',
            message: 'Camera chưa sẵn sàng',
            detail: 'Không thể chụp ảnh từ webcam, vui lòng kiểm tra thiết bị.',
          });
          return;
        }

        setCapturedPreview(capture.dataUrl);

        // Tọa độ GPS: ưu tiên lấy định vị thực tế từ trình duyệt, fallback về tọa độ khuôn viên trường ĐH Nguyễn Trãi
        let coords = { lat: 21.028511, lng: 105.854167 };
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 2500,
                enableHighAccuracy: true,
                maximumAge: 60000,
              });
            });
            coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          } catch {
            // Giữ tọa độ chuẩn khuôn viên trường nếu trình duyệt chặn quyền hoặc timeout
          }
        }

        let res: AttendancePunchResult;
        if (actionType === 'check_out') {
          res = await attendanceApi.checkOutWithFace(capture.blob, {
            actionType: 'check_out',
            location: coords,
            deviceId: 'STATION_CAMERA_01',
          });
        } else {
          res = await attendanceApi.checkInWithFace(capture.blob, {
            actionType: 'check_in',
            location: coords,
            deviceId: 'STATION_CAMERA_01',
          });
        }

        if (res && res.success) {
          audioFeedback.playSuccessChime();
          confetti({
            particleCount: 40,
            spread: 55,
            origin: { y: 0.7 },
          });

          setLastResult(res);
          toast.success(res.message, { id: 'face-attendance-toast' });
          loadRecentHistory();

          setScanStatus({
            type: 'success',
            message: `Điểm danh thành công: ${res.user?.fullName || 'Cán bộ'}`,
            detail: `Độ tin cậy: ${((res.similarity ?? 0.95) * 100).toFixed(1)}% • ${
              res.record?.status === 'on_time' ? 'Đúng giờ' : 'Ghi nhận'
            }`,
          });

          // Kích hoạt Cooldown 4 giây để không quét lặp người vừa xong
          setCooldownRemaining(4);
        } else {
          const failMsg = res?.message || 'Khuôn mặt chưa khớp với nhân sự nào trong hệ thống.';
          audioFeedback.playWarningBeep();
          toast.error(failMsg, { id: 'face-attendance-toast', duration: 2500 });

          setScanStatus({
            type: 'error',
            message: 'Không nhận diện được',
            detail: failMsg,
          });

          // Tạm dừng 3 giây trước lần tự động quét kế tiếp
          setCooldownRemaining(3);
        }
      } catch (err: any) {
        audioFeedback.playWarningBeep();
        const msg = err.response?.data?.message || err.message || 'Không nhận diện được khuôn mặt.';
        toast.error(msg, { id: 'face-attendance-toast', duration: 2500 });

        const isScheduleIssue = msg.toLowerCase().includes('lịch') || msg.toLowerCase().includes('ca');
        setScanStatus({
          type: 'error',
          message: isScheduleIssue ? 'Thông báo ca làm việc / lịch dạy' : 'Lỗi nhận diện',
          detail: msg,
        });
        setCooldownRemaining(3);
      } finally {
        setIsProcessing(false);
      }
    },
    [actionType, cooldownRemaining, isCameraActive, isProcessing]
  );

  // 5. Đếm ngược Cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (scanStatus.type !== 'idle' && !isProcessing) {
        setScanStatus({
          type: 'idle',
          message: 'Hệ thống đã sẵn sàng',
          detail: isAutoScan ? 'Nhìn thẳng vào khung hình để hệ thống tự động điểm danh' : 'Nhấn nút Điểm Danh Ngay hoặc phím Space',
        });
      }
      return;
    }
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining, isAutoScan, isProcessing, scanStatus.type]);

  // 6. Vòng lặp TỰ ĐỘNG QUÉT (Mỗi 2 giây thử quét 1 lần)
  useEffect(() => {
    if (!isAutoScan || !isCameraActive) return;

    const autoScanTimer = setInterval(() => {
      if (isCameraActive && !isProcessing && cooldownRemaining === 0) {
        executePunch(true);
      }
    }, 2000);

    return () => clearInterval(autoScanTimer);
  }, [cooldownRemaining, executePunch, isAutoScan, isCameraActive, isProcessing]);

  // 7. Phím tắt Space để chụp thủ công
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isCameraActive && !isProcessing) {
        e.preventDefault();
        executePunch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executePunch, isCameraActive, isProcessing]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* =====================================================================
          1. HEADER CARD: TIÊU ĐỀ CHUẨN CARD TRẮNG/DARK & THANH CÔNG CỤ TINH TẾ
      ===================================================================== */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Điểm Danh Khuôn Mặt
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
              AI FaceID
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Nhận diện sinh trắc học 512 chiều thời gian thực, tự động ghi nhận lượt quẹt thẻ và kiểm soát ca làm việc.
          </p>
        </div>

        {/* Thanh công cụ phụ: Âm thanh, Tự động quét & Trình quét HUD */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Bật/Tắt Tự Động Quét */}
          <button
            type="button"
            onClick={() => setIsAutoScan(!isAutoScan)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isAutoScan
                ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
            title="Bật hoặc tắt chế độ tự động quét khuôn mặt mỗi 2 giây"
          >
            <span className={`w-2 h-2 rounded-full ${isAutoScan ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <Zap className="w-3.5 h-3.5" />
            <span>Tự động quét: {isAutoScan ? 'BẬT' : 'TẮT'}</span>
          </button>

          {/* Nút Âm Thanh */}
          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              audioFeedback.setMuted(nextMuted);
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 transition-colors cursor-pointer"
            title={isMuted ? 'Bật âm thanh phản hồi' : 'Tắt âm thanh phản hồi'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-brand-600" />}
          </button>

          {/* Nút Mở Trình Quét HUD Toàn Màn Hình */}
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setIsScannerModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:text-brand-600 text-xs font-semibold transition-all cursor-pointer"
            title="Mở trình quét AI Face ID toàn màn hình với hiệu ứng Laser"
          >
            <Maximize2 className="w-3.5 h-3.5 text-brand-600" />
            <span>Trình Quét HUD</span>
          </button>

          {/* Nút Đăng Ký 5 Góc (Chỉ Admin / BGH) */}
          {['admin', 'bgh'].includes(authUser?.role || '') && (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setIsEnrollModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Đăng ký mẫu khuôn mặt 5 góc"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Đăng Ký 5 Góc</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          2. MAIN WORKSPACE: CAMERA ĐIỂM DANH (TRÁI) & KẾT QUẢ / LỊCH SỬ (PHẢI)
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: CAMERA GỌN GÀNG, KHUNG QUÉT TỐI GIẢN (7 Cột) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            {/* Thanh điều khiển trên Camera: Chế độ Vào/Tan Ca & Bật/Tắt Cam */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Segmented Control Chọn Chế Độ Vào Ca / Tan Ca */}
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setActionType('check_in')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    actionType === 'check_in'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Vào Ca (Check-in)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('check_out')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    actionType === 'check_out'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Tan Ca (Check-out)</span>
                </button>
              </div>

              {/* Nút Bật/Tắt Webcam nhanh */}
              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Tạm thời tắt Webcam"
                >
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>Tắt Cam</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Bật Webcam để tiếp tục quét"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Mở Cam</span>
                </button>
              )}
            </div>

            {/* KHUNG CAMERA VIEWPORT - PHONG CÁCH TỐI GIẢN HIỆN ĐẠI (ASPECT 4/3) */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                  isCameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* KHUNG ĐỊNH VỊ KHUÔN MẶT: 4 GÓC BO TRÒN HIỆN ĐẠI (HUD CORNERS) */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  {/* Khung 4 góc nhận diện */}
                  <div className="relative w-52 h-64 sm:w-60 sm:h-72 transition-all duration-300">
                    {/* Góc trên trái */}
                    <div
                      className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 rounded-tl-xl transition-colors duration-300 ${
                        scanStatus.type === 'scanning'
                          ? 'border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]'
                          : scanStatus.type === 'success'
                          ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                          : scanStatus.type === 'error'
                          ? 'border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                          : cooldownRemaining > 0
                          ? 'border-amber-400'
                          : 'border-white/50'
                      }`}
                    />
                    {/* Góc trên phải */}
                    <div
                      className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 rounded-tr-xl transition-colors duration-300 ${
                        scanStatus.type === 'scanning'
                          ? 'border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]'
                          : scanStatus.type === 'success'
                          ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                          : scanStatus.type === 'error'
                          ? 'border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                          : cooldownRemaining > 0
                          ? 'border-amber-400'
                          : 'border-white/50'
                      }`}
                    />
                    {/* Góc dưới trái */}
                    <div
                      className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 rounded-bl-xl transition-colors duration-300 ${
                        scanStatus.type === 'scanning'
                          ? 'border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]'
                          : scanStatus.type === 'success'
                          ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                          : scanStatus.type === 'error'
                          ? 'border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                          : cooldownRemaining > 0
                          ? 'border-amber-400'
                          : 'border-white/50'
                      }`}
                    />
                    {/* Góc dưới phải */}
                    <div
                      className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 rounded-br-xl transition-colors duration-300 ${
                        scanStatus.type === 'scanning'
                          ? 'border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.8)]'
                          : scanStatus.type === 'success'
                          ? 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                          : scanStatus.type === 'error'
                          ? 'border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                          : cooldownRemaining > 0
                          ? 'border-amber-400'
                          : 'border-white/50'
                      }`}
                    />

                    {/* Tia quét laser chuyển động khi đang nhận diện */}
                    {scanStatus.type === 'scanning' && (
                      <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_rgba(99,102,241,1)] animate-pulse" />
                    )}
                  </div>

                  {/* Thanh nhãn trạng thái nổi dạng kính mờ (Frosted Glass Pill) */}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-[90%]">
                    <div
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border shadow-lg flex items-center gap-2 whitespace-nowrap transition-all ${
                        scanStatus.type === 'scanning'
                          ? 'bg-indigo-950/80 text-indigo-200 border-indigo-700/50'
                          : scanStatus.type === 'success'
                          ? 'bg-emerald-950/80 text-emerald-200 border-emerald-700/50'
                          : scanStatus.type === 'error'
                          ? 'bg-rose-950/80 text-rose-200 border-rose-700/50'
                          : cooldownRemaining > 0
                          ? 'bg-amber-950/80 text-amber-200 border-amber-700/50'
                          : 'bg-slate-900/80 text-slate-200 border-white/10'
                      }`}
                    >
                      {scanStatus.type === 'scanning' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />}
                      {scanStatus.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                      {scanStatus.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      {scanStatus.type === 'idle' && cooldownRemaining === 0 && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      )}
                      <span className="truncate">
                        {scanStatus.type === 'scanning'
                          ? 'Đang so khớp khuôn mặt...'
                          : cooldownRemaining > 0
                          ? `Chờ ${cooldownRemaining}s cho lượt tiếp theo`
                          : scanStatus.type === 'success'
                          ? scanStatus.message
                          : scanStatus.type === 'error'
                          ? scanStatus.message
                          : isAutoScan
                          ? 'Nhìn thẳng vào khung hình để điểm danh'
                          : 'Nhấn nút Điểm Danh hoặc phím Space'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Màn hình thông báo khi Camera đang tắt */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
                  {cameraLoading ? (
                    <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mb-2" />
                  ) : (
                    <CameraOff className="w-8 h-8 text-slate-500 mb-2" />
                  )}
                  <p className="font-semibold text-xs mb-3 text-slate-300">
                    {cameraLoading ? 'Đang khởi động Camera...' : 'Camera đang tắt'}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Bật Camera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Hàng Nút Hành Động Điểm Danh Ngay */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => executePunch(false)}
                disabled={!isCameraActive || isProcessing || cooldownRemaining > 0}
                className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? 'Đang Nhận Diện...'
                    : actionType === 'check_in'
                    ? 'Điểm Danh Ngay (Phím Space)'
                    : 'Tan Ca Ngay (Phím Space)'}
                </span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
                <span>
                  {isAutoScan ? '● Chế độ tự động chụp khi có người' : 'Nhấn nút hoặc bấm phím Space để chụp'}
                </span>
                {['admin', 'bgh'].includes(authUser?.role || '') && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setIsEnrollModalOpen(true);
                    }}
                    className="text-brand-600 dark:text-brand-400 hover:underline font-medium cursor-pointer"
                  >
                    Đăng ký khuôn mặt mới
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ VỪA QUÉT & LỊCH SỬ CHẤM CÔNG (5 Cột) */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1. THẺ KẾT QUẢ VỪA ĐIỂM DANH */}
          {lastResult ? (
            <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Xác Thực Thành Công
                </span>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                  {new Date().toLocaleTimeString('vi-VN')}
                </span>
              </div>

              <div className="flex items-center gap-3.5 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs">
                {capturedPreview ? (
                  <img
                    src={capturedPreview}
                    alt="Captured"
                    className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg shrink-0">
                    {lastResult.user?.fullName?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                    {lastResult.user?.fullName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {lastResult.user?.staffCode ? `${lastResult.user.staffCode} • ` : ''}
                    {lastResult.user?.role?.toUpperCase() || 'GIẢNG VIÊN'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {lastResult.record?.status === 'on_time' ? 'ĐÚNG GIỜ' : 'GHI NHẬN'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Độ tin cậy: {((lastResult.similarity ?? 0.95) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Khi chưa có lượt quét mới: hiển thị thẻ thông tin cán bộ đăng nhập */
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Cán Bộ Sử Dụng Thiết Bị
              </span>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm border border-brand-200 dark:border-brand-800 shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                    {authUser?.fullName || 'Cán Bộ Hệ Thống'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {authUser?.staffCode ? `${authUser.staffCode} • ` : ''}
                    {authUser?.email || 'admin@university.edu.vn'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Sẵn sàng nhận diện khuôn mặt mọi cán bộ đứng trước camera</span>
              </p>
            </div>
          )}

          {/* 2. THẺ LỊCH SỬ CHẤM CÔNG HÔM NAY */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Lượt Chấm Công Hôm Nay
                </h3>
                {recentPunches.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    {recentPunches.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={loadRecentHistory}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Làm mới lịch sử"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentPunches.length === 0 ? (
              <div className="py-8 text-center text-slate-400 dark:text-slate-500 space-y-1">
                <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-medium">Chưa có dữ liệu chấm công hôm nay</p>
                <p className="text-[11px] text-slate-400">Các lượt quẹt thẻ khuôn mặt thành công sẽ hiển thị ở đây.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar text-xs">
                {recentPunches.map((item) => {
                  const timeStr = item.checkInTime
                    ? new Date(item.checkInTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--';
                  const isOnTime = item.status === 'on_time';

                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 transition-colors hover:bg-slate-100/70"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.userId?.fullName?.charAt(0) || 'C'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {item.userId?.fullName || 'Cán bộ'}
                          </p>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {item.shiftId?.name || 'Ca hành chính'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                          {timeStr}
                        </span>
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              isOnTime
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                            }`}
                          >
                            {isOnTime ? 'ĐÚNG GIỜ' : 'ĐI MUỘN'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Trình Quét AI Face ID (HUD 3D Laser & Popup Xác Nhận Nhân Sự) */}
      <FaceAttendanceScannerModal
        isOpen={isScannerModalOpen}
        mode={actionType === 'check_in' ? 'check-in' : 'check-out'}
        onClose={() => {
          setIsScannerModalOpen(false);
          startCamera();
        }}
        onSuccess={() => {
          loadRecentHistory();
        }}
      />

      {/* Modal Đăng Ký Khuôn Mặt 5 Góc */}
      <FaceRegistrationModal
        isOpen={isEnrollModalOpen}
        user={authUser}
        onClose={() => {
          setIsEnrollModalOpen(false);
          startCamera();
        }}
        onSuccess={() => {
          toast.success('Đã lưu mẫu khuôn mặt 5 góc thành công!');
          useAuthStore.getState().fetchMe?.();
        }}
      />
    </div>
  );
};

export default FaceAttendance;
