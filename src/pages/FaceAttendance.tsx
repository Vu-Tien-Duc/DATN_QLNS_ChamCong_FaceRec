import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  ScanFace,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Building,
  RefreshCw,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  Zap,
  Play,
  Pause
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { attendanceApi, AttendancePunchResult, AttendanceHistoryItem } from '../api/attendance.api';
import { apiClient } from '../api/apiClient';
import { audioFeedback } from '../utils/audioFeedback';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';

export const FaceAttendance: React.FC = () => {
  const { user: authUser } = useAuthStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States: Điều khiển Camera
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  // Chế độ & Tính năng tự động
  const [actionType, setActionType] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
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

  // Tự động bật camera và tải lịch sử khi vào trang
  useEffect(() => {
    startCamera();
    loadRecentHistory();

    return () => {
      stopCamera();
    };
  }, []);

  // Tải danh sách lượt quét gần nhất
  const loadRecentHistory = async () => {
    try {
      const logs = await attendanceApi.getRecentHistory(6);
      setRecentPunches(logs);
    } catch (_) {}
  };

  // 1. Khởi động Camera (Độ phân giải chuẩn 640x480 siêu mượt, không lag)
  const startCamera = async () => {
    setCameraLoading(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
    } catch (err: any) {
      toast.error('Không thể mở Camera: ' + (err.message || 'Vui lòng cho phép quyền webcam.'));
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // 2. Tắt Camera hoàn toàn (Ngắt đèn webcam ngay lập tức)
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsProcessing(false);
  };

  // 3. Hàm chụp ảnh từ video stream
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
        message: 'Đang quét & nhận diện...',
        detail: 'Đang so khớp vector khuôn mặt với dữ liệu RAM...',
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

        // Tọa độ GPS mặc định trường ĐH
        const coords = { lat: 21.028511, lng: 105.854167 };

        let res: AttendancePunchResult;
        if (actionType === 'CHECK_OUT') {
          res = await attendanceApi.checkOutWithFace(capture.blob, {
            location: coords,
            deviceId: 'STATION_CAMERA_01',
          });
        } else {
          res = await attendanceApi.checkInWithFace(capture.blob, {
            location: coords,
            deviceId: 'STATION_CAMERA_01',
          });
        }

        if (res && res.success) {
          audioFeedback.playSuccessChime();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
          });

          setLastResult(res);
          toast.success(res.message, { id: 'face-attendance-toast' });
          loadRecentHistory();

          setScanStatus({
            type: 'success',
            message: `Điểm danh thành công: ${res.user?.fullName || 'Cán bộ'}`,
            detail: `Độ tin cậy: ${((res.similarity ?? 0.95) * 100).toFixed(1)}% • ${res.record?.status === 'ON_TIME' ? 'Đúng giờ' : 'Ghi nhận'}`,
          });

          // Kích hoạt Cooldown 5 giây để không quét lặp người vừa xong
          setCooldownRemaining(5);
        } else {
          const failMsg = res?.message || 'Khuôn mặt chưa khớp với nhân sự nào trong hệ thống.';
          audioFeedback.playWarningBeep();
          toast.error(failMsg, { id: 'face-attendance-toast', duration: 2500 });

          setScanStatus({
            type: 'error',
            message: 'Không nhận diện được',
            detail: failMsg,
          });

          // Tạm dừng 3 giây trước lần tự động quét kế tiếp để không spam server
          setCooldownRemaining(3);
        }
      } catch (err: any) {
        audioFeedback.playWarningBeep();
        const msg = err.response?.data?.message || err.message || 'Không nhận diện được khuôn mặt.';
        toast.error(msg, { id: 'face-attendance-toast', duration: 2500 });

        setScanStatus({
          type: 'error',
          message: 'Lỗi nhận diện',
          detail: msg,
        });
        setCooldownRemaining(3);
      } finally {
        setIsProcessing(false);
      }
    },
    [actionType, cooldownRemaining, isCameraActive, isProcessing, loadRecentHistory]
  );

  // Đăng ký nhanh Face ID từ camera hiện tại cho tài khoản đang đăng nhập
  const handleQuickEnroll = async () => {
    if (!authUser) {
      toast.error('Vui lòng đăng nhập để đăng ký khuôn mặt.');
      return;
    }
    const capture = await captureFrameBlob();
    if (!capture) {
      toast.error('Không thể chụp ảnh từ camera. Vui lòng kiểm tra lại webcam.');
      return;
    }

    try {
      setIsEnrolling(true);
      const loadingToastId = toast.loading('Đang trích xuất vector khuôn mặt và cập nhật dữ liệu...');

      const formData = new FormData();
      formData.append('image', capture.blob, 'straight.jpg');
      formData.append('image_straight', capture.blob, 'straight.jpg');
      formData.append('employee_id', (authUser as any)._id || (authUser as any).id);
      formData.append('fullName', authUser.fullName);
      formData.append('consentAgreed', 'true');
      formData.append('force', 'true');

      const res = await apiClient.post<any>('/face/enroll-multi-angle', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.dismiss(loadingToastId);

      if (res.data?.success) {
        toast.success(`Đăng ký Face ID thành công cho ${authUser.fullName}! Giờ bạn đã có thể điểm danh.`);
        audioFeedback.playSuccessChime();
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
        setCooldownRemaining(1);
      } else {
        toast.error(res.data?.message || 'Đăng ký không thành công.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi đăng ký khuôn mặt.';
      toast.error(msg);
    } finally {
      setIsEnrolling(false);
    }
  };

  // 5. Đếm ngược Cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (scanStatus.type !== 'idle' && !isProcessing) {
        setScanStatus({
          type: 'idle',
          message: 'Hệ thống đã sẵn sàng',
          detail: isAutoScan ? 'Tự động quét đang bật, đặt khuôn mặt vào khung...' : 'Nhấn nút để điểm danh',
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
        executePunch(true); // isAutoTrigger = true (không hiện lỗi rác nếu chưa có người)
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Trang */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ScanFace className="w-6 h-6 text-brand-600 dark:text-brand-400" />
            Điểm Danh Khuôn Mặt (AI FaceID)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Hệ thống hỗ trợ tự động nhận diện hoặc bấm nút để điểm danh ca làm việc.
          </p>
        </div>

        {/* Thanh công cụ phụ: Âm thanh & Tự động quét */}
        <div className="flex items-center gap-2">
          {/* Nút Bật/Tắt Tự Động Quét */}
          <button
            type="button"
            onClick={() => setIsAutoScan(!isAutoScan)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isAutoScan
                ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500'
            }`}
          >
            {isAutoScan ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Zap className="w-3.5 h-3.5" />
                Tự động quét: BẬT
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                Tự động quét: TẮT
              </>
            )}
          </button>

          {/* Nút Bật/Tắt Âm Thanh */}
          <button
            type="button"
            onClick={() => {
              const nextMuted = !isMuted;
              setIsMuted(nextMuted);
              audioFeedback.setMuted(nextMuted);
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:text-brand-500 transition-colors"
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-brand-500" />}
          </button>
        </div>
      </div>

      {/* 2. Bố cục: Khung Camera Gọn Gàng (Trái) & Kết quả / Lịch sử (Phải) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Cột Trái: Camera Vừa Vặn & Nút Điều Khiển (6 Cột) */}
        <div className="md:col-span-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-4">
            {/* Khung Camera: Thu gọn kích thước vừa vặn (max-w-[440px]), không bị quá to */}
            <div className="relative w-full max-w-[440px] mx-auto aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-200 ${
                  isCameraActive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Vòng hướng dẫn khuôn mặt nhẹ nhàng (CSS, không lag) */}
              {isCameraActive && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                  <div
                    className={`w-44 h-56 rounded-[45%] border-2 border-dashed transition-all duration-300 ${
                      scanStatus.type === 'scanning'
                        ? 'border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.6)] animate-pulse'
                        : scanStatus.type === 'success'
                        ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                        : scanStatus.type === 'error'
                        ? 'border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                        : cooldownRemaining > 0
                        ? 'border-amber-400'
                        : 'border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.25)] animate-pulse'
                    }`}
                  />
                  <span
                    className={`mt-2.5 px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-lg transition-colors ${
                      scanStatus.type === 'scanning'
                        ? 'bg-indigo-950/85 text-indigo-300 animate-pulse border border-indigo-700/50'
                        : scanStatus.type === 'success'
                        ? 'bg-emerald-950/85 text-emerald-300 border border-emerald-700/50'
                        : scanStatus.type === 'error'
                        ? 'bg-rose-950/85 text-rose-300 border border-rose-700/50'
                        : cooldownRemaining > 0
                        ? 'bg-amber-950/85 text-amber-300 border border-amber-700/50'
                        : 'bg-slate-950/80 text-white'
                    }`}
                  >
                    {scanStatus.type === 'scanning'
                      ? '⚡ Đang phân tích...'
                      : cooldownRemaining > 0
                      ? `⏳ Chờ ${cooldownRemaining}s lượt kế tiếp`
                      : scanStatus.type === 'success'
                      ? `✓ ${scanStatus.message}`
                      : scanStatus.type === 'error'
                      ? `✕ ${scanStatus.message}`
                      : 'Đặt khuôn mặt vào khung tròn'}
                  </span>
                </div>
              )}

              {/* Màn hình khi camera ĐANG TẮT */}
              {!isCameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-white">
                  {cameraLoading ? (
                    <RefreshCw className="w-8 h-8 animate-spin text-brand-400 mb-2" />
                  ) : (
                    <CameraOff className="w-8 h-8 text-slate-500 mb-2" />
                  )}
                  <p className="font-semibold text-xs mb-3 text-slate-300">
                    {cameraLoading ? 'Đang mở Camera...' : 'Camera đang tắt'}
                  </p>
                  <Button variant="primary" size="sm" onClick={startCamera} isLoading={cameraLoading}>
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    Bật Camera Lên
                  </Button>
                </div>
              )}
            </div>

            {/* Hộp Thông Báo Trạng Thái Trực Quan Thời Gian Thực */}
            {isCameraActive && (
              <div
                className={`mt-3 max-w-[440px] mx-auto p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 shadow-sm ${
                  scanStatus.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : scanStatus.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : scanStatus.type === 'scanning'
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {scanStatus.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : scanStatus.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                  ) : scanStatus.type === 'scanning' ? (
                    <RefreshCw className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  ) : (
                    <ScanFace className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider truncate">
                      {scanStatus.message}
                    </h4>
                    {cooldownRemaining > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-semibold flex-shrink-0">
                        Chờ {cooldownRemaining}s
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 mt-0.5 break-words">
                    {scanStatus.detail ||
                      (isAutoScan
                        ? 'Hệ thống tự động chụp & nhận diện mỗi 2-3 giây khi có khuôn mặt.'
                        : 'Nhấn nút hoặc bấm Space để chụp thủ công.')}
                  </p>
                </div>
              </div>
            )}

            {/* Thanh Nút Điều Khiển */}
            <div className="mt-4 space-y-3 max-w-[440px] mx-auto">
              {/* Chọn chế độ Vào ca / Tan ca */}
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setActionType('CHECK_IN')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    actionType === 'CHECK_IN'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Vào Ca (Check-in)
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('CHECK_OUT')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    actionType === 'CHECK_OUT'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Tan Ca (Check-out)
                </button>
              </div>

              {/* Hai nút: Điểm danh Ngay & Nút Tắt Camera RÕ RÀNG */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => executePunch(false)}
                  isLoading={isProcessing}
                  disabled={!isCameraActive || cooldownRemaining > 0}
                  className="flex-1 justify-center py-2.5 font-bold text-sm shadow-md"
                >
                  <Camera className="w-4 h-4 mr-1.5" />
                  {actionType === 'CHECK_IN' ? 'Điểm Danh Ngay' : 'Tan Ca Ngay'}
                </Button>

                {/* Nút BẬT / TẮT CAMERA rõ ràng */}
                {isCameraActive ? (
                  <Button
                    variant="outline"
                    onClick={stopCamera}
                    className="text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs px-3"
                    title="Tắt Camera để dừng hoạt động"
                  >
                    <CameraOff className="w-4 h-4 mr-1" />
                    Tắt Cam
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={startCamera}
                    className="text-emerald-600 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs px-3"
                  >
                    <Camera className="w-4 h-4 mr-1" />
                    Mở Cam
                  </Button>
                )}
              </div>

              <p className="text-center text-[11px] text-slate-400">
                {isAutoScan ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ● Chế độ tự động đang bật: Chỉ cần đứng trước camera hệ thống sẽ tự điểm danh.
                  </span>
                ) : (
                  <span>Nhấn nút hoặc bấm phím [Space] để chụp thủ công.</span>
                )}
              </p>

              {/* Đăng ký nhanh Face ID từ camera nếu chưa đăng ký */}
              {authUser && isCameraActive && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Chưa khớp mặt bạn?</span>
                  <button
                    type="button"
                    onClick={handleQuickEnroll}
                    disabled={isEnrolling}
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline flex items-center gap-1.5 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {isEnrolling ? 'Đang trích xuất...' : `Đăng ký Face ID cho ${authUser.fullName}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cột Phải: Kết Quả Điểm Danh & Lịch Sử Gần Nhất (6 Cột) */}
        <div className="md:col-span-6 space-y-4">
          {/* Card Kết quả vừa quét */}
          {lastResult && (
            <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/20 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{lastResult.message}</span>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                {capturedPreview && (
                  <img
                    src={capturedPreview}
                    alt="Captured"
                    className="w-14 h-14 rounded-lg object-cover border border-emerald-500"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-900 dark:text-white truncate text-sm">
                    {lastResult.user.fullName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mã CB: {lastResult.user.staffCode || 'N/A'} • {lastResult.user.role || 'Cán bộ'}
                  </p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Độ tin cậy: {((lastResult.similarity ?? 0.95) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Card Người Dùng Đang Đăng Nhập */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Tài khoản:</span>
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <UserCheck className="w-4 h-4 text-brand-500" />
              <span>{authUser?.fullName || 'Chưa đăng nhập'}</span>
              <span className="text-slate-400 font-normal">({authUser?.email})</span>
            </div>
          </div>

          {/* Card Danh Sách Lượt Quét Hôm Nay */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-500" />
                Các Lượt Chấm Công Gần Nhất
              </h3>
              <button
                onClick={loadRecentHistory}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Làm mới danh sách"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentPunches.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Chưa có dữ liệu chấm công hôm nay.
              </p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 text-xs">
                {recentPunches.map((item) => {
                  const timeStr = item.checkInTime
                    ? new Date(item.checkInTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '--:--';
                  const isOnTime = item.status === 'ON_TIME';

                  return (
                    <div
                      key={item._id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {item.userId?.fullName || 'Cán bộ'}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {item.shiftId?.name || 'Ca làm việc'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {timeStr}
                        </span>
                        <div>
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              isOnTime
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
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
    </div>
  );
};

export default FaceAttendance;
