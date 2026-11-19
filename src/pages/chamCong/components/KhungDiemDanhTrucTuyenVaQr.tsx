import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Camera,
  CameraOff,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { apiClient } from '../../../api/apiClient';
import { attendanceApi, AttendancePunchResult } from '../../../api/chamCong.api';
import { shiftApi, ShiftItem } from '../../../api/caLamViec.api';
import { useAuthStore } from '../../../stores/useXacThucStore';
import { audioFeedback } from '../../../utils/amThanh';
import { cameraManager } from '../../../utils/quanLyCamera';
import { UserAvatar } from '../../../components/chung/AnhDaiDienNguoiDung';

interface CampusConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
  name?: string;
}

interface KhungDiemDanhTrucTuyenVaQrProps {
  mode: 'online' | 'qr';
  actionType: 'check_in' | 'check_out';
  allowPersonalCheckIn: boolean;
  allowKioskQrDisplay: boolean;
  embedded?: boolean;
  onChangeActionType: (next: 'check_in' | 'check_out') => void;
  onSuccess: (result: AttendancePunchResult) => void;
}

function calcHaversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const KhungDiemDanhTrucTuyenVaQr: React.FC<KhungDiemDanhTrucTuyenVaQrProps> = ({
  mode,
  actionType,
  allowPersonalCheckIn,
  allowKioskQrDisplay,
  embedded = false,
  onChangeActionType,
  onSuccess,
}) => {
  const { user: authUser } = useAuthStore();

  // Đồng hồ thời gian thực
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Trạng thái GPS & Geofence
  const [campus, setCampus] = useState<CampusConfig>({
    lat: 20.9752,
    lng: 105.7628,
    radiusMeters: 300,
    name: 'Trường Đại học Nguyễn Trãi',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>('');

  // Danh sách ca làm việc (tùy chọn khi điểm danh trực tuyến)
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // QR Sub-mode: quét mã bằng camera / nhập tay HOẶC hiển thị mã QR động 20s (phân quyền chặt)
  const [qrSubMode, setQrSubMode] = useState<'scan' | 'display'>(
    allowPersonalCheckIn ? 'scan' : 'display'
  );

  useEffect(() => {
    if (!allowPersonalCheckIn && allowKioskQrDisplay && qrSubMode === 'scan') {
      setQrSubMode('display');
    } else if (allowPersonalCheckIn && !allowKioskQrDisplay && qrSubMode === 'display') {
      setQrSubMode('scan');
    }
  }, [allowPersonalCheckIn, allowKioskQrDisplay, qrSubMode]);
  const [qrTokenInput, setQrTokenInput] = useState<string>('');
  const [isQrCamActive, setIsQrCamActive] = useState<boolean>(false);
  const [qrCamLoading, setQrCamLoading] = useState<boolean>(false);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrScanLockRef = useRef<boolean>(false);

  // Dynamic QR Display state
  const [dynamicQrData, setDynamicQrData] = useState<{
    qrToken: string;
    dataUrl: string;
    expiresIn: number;
    room: string;
  } | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(20);
  const [loadingDynamicQr, setLoadingDynamicQr] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Tải cấu hình khuôn viên & danh sách ca
  useEffect(() => {
    let active = true;
    attendanceApi
      .getCampusConfig()
      .then((cfg) => {
        if (!active || !cfg) return;
        const lat = Number(cfg.lat ?? cfg.vi_do ?? 20.9752);
        const lng = Number(cfg.lng ?? cfg.kinh_do ?? 105.7628);
        const radiusMeters = Number(cfg.radiusMeters ?? cfg.ban_kinh_met ?? 300);
        setCampus({ lat, lng, radiusMeters, name: cfg.name || cfg.ten || 'Trường ĐH Nguyễn Trãi' });
      })
      .catch(() => {});

    shiftApi
      .getShifts()
      .then((list) => {
        if (active && Array.isArray(list)) {
          setShifts(list.filter((s) => s.kich_hoat !== false));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Định vị GPS
  const refreshLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? 'Bạn chưa cấp quyền truy cập vị trí GPS cho trình duyệt.'
            : 'Không thể lấy tọa độ GPS hiện tại. Vui lòng thử lại.'
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  const distanceMeters = coords
    ? calcHaversineMeters(coords.lat, coords.lng, campus.lat, campus.lng)
    : null;
  const isInsideCampus = distanceMeters !== null ? distanceMeters <= campus.radiusMeters : null;

  // Dừng camera QR
  const stopQrCamera = useCallback(() => {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraManager.unregisterStream(qrStreamRef.current);
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsQrCamActive(false);
  }, []);

  // Bật camera quét QR
  const startQrCamera = useCallback(async () => {
    if (qrStreamRef.current) return;
    setQrCamLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      cameraManager.registerStream(stream);
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play();
      }
      setIsQrCamActive(true);
    } catch {
      toast.error('Không thể mở camera quét QR. Hãy kiểm tra quyền truy cập hoặc nhập mã thủ công.');
    } finally {
      setQrCamLoading(false);
    }
  }, []);

  // Tự dọn camera khi rời mode QR hoặc chuyển sang submode display
  useEffect(() => {
    if (mode !== 'qr' || qrSubMode !== 'scan') {
      stopQrCamera();
    }
    return () => {
      stopQrCamera();
    };
  }, [mode, qrSubMode, stopQrCamera]);

  // Xử lý điểm danh trực tuyến (Online / GPS)
  const handleOnlineSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const endpoint = actionType === 'check_out' ? '/cham-cong/tan-ca' : '/cham-cong/vao-ca';
      const payload: Record<string, any> = {
        phuong_thuc: 'gps_mobile',
        thiet_bi_id: 'WEB_ONLINE',
      };
      if (selectedShiftId) payload.ca_id = selectedShiftId;
      if (coords) {
        payload.vi_do = coords.lat;
        payload.kinh_do = coords.lng;
        payload.toa_do = { vi_do: coords.lat, kinh_do: coords.lng };
        if (coords.accuracy) payload.do_chinh_xac = coords.accuracy;
      }

      const res = await apiClient.post<any>(endpoint, payload);
      const data = res.data?.data || res.data || {};
      const message = res.data?.message || (actionType === 'check_out' ? 'Tan ca trực tuyến thành công!' : 'Vào ca trực tuyến thành công!');

      audioFeedback.playSuccessChime();
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
      toast.success(message);

      onSuccess({
        success: true,
        action: actionType,
        message,
        user: {
          id: authUser?.id || '',
          ho_ten: authUser?.ho_ten || 'Cán bộ',
          ma_can_bo: authUser?.ma_can_bo,
          anh_dai_dien: authUser?.anh_dai_dien,
        },
        record: data?.log || data,
      });
    } catch (err: any) {
      audioFeedback.playWarningBeep();
      const msg = err?.response?.data?.message || 'Điểm danh trực tuyến thất bại.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi mã QR để điểm danh
  const submitQrToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token) {
        toast.error('Vui lòng quét hoặc nhập mã QR hợp lệ.');
        return;
      }
      if (qrScanLockRef.current) return;
      qrScanLockRef.current = true;
      setIsSubmitting(true);
      try {
        const payload: any = {
          ma_qr: token,
          thiet_bi_id: 'WEB_QR_SCANNER',
        };
        if (coords) {
          payload.toa_do = { vi_do: coords.lat, kinh_do: coords.lng };
        }
        const res = await attendanceApi.scanQRCode(payload);
        const message = res?.message || 'Điểm danh bằng mã QR thành công!';

        audioFeedback.playSuccessChime();
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
        toast.success(message);
        setQrTokenInput('');

        onSuccess({
          success: true,
          action: res?.action || actionType,
          message,
          user: {
            id: authUser?.id || '',
            ho_ten: authUser?.ho_ten || 'Cán bộ',
            ma_can_bo: authUser?.ma_can_bo,
            anh_dai_dien: authUser?.anh_dai_dien,
          },
          record: res?.nhat_ky_cham_cong || res?.attendance || res?.log || res,
        });
      } catch (err: any) {
        audioFeedback.playWarningBeep();
        const msg = err?.response?.data?.message || 'Mã QR không hợp lệ hoặc đã hết hạn (20s).';
        toast.error(msg);
      } finally {
        setIsSubmitting(false);
        setTimeout(() => {
          qrScanLockRef.current = false;
        }, 2500);
      }
    },
    [actionType, authUser, coords, onSuccess]
  );

  // Vòng lặp giải mã QR từ webcam mỗi 250ms
  useEffect(() => {
    if (mode !== 'qr' || qrSubMode !== 'scan' || !isQrCamActive) return;

    const timer = setInterval(() => {
      if (qrScanLockRef.current || !qrVideoRef.current || !qrCanvasRef.current) return;
      const video = qrVideoRef.current;
      if (video.readyState !== 4 || !video.videoWidth) return;

      const canvas = qrCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code?.data) {
        setQrTokenInput(code.data);
        submitQrToken(code.data);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [mode, qrSubMode, isQrCamActive, submitQrToken]);

  // Sinh mã QR động 20s cho Kiosk / Giảng đường
  const loadDynamicQr = useCallback(async () => {
    setLoadingDynamicQr(true);
    try {
      const res = await attendanceApi.generateQRCode();
      const token = res?.qrToken || res?.ma_qr || '';
      if (!token) throw new Error('Không nhận được mã QR từ máy chủ.');
      const dataUrl = await QRCode.toDataURL(token, {
        width: 240,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      const expiresIn = Number(res?.expiresIn || 20);
      setDynamicQrData({
        qrToken: token,
        dataUrl,
        expiresIn,
        room: res?.qrPayload?.room || 'MAY_CHAM_CONG',
      });
      setQrCountdown(expiresIn);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể sinh mã QR động.');
    } finally {
      setLoadingDynamicQr(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'qr' && qrSubMode === 'display') {
      loadDynamicQr();
    }
  }, [mode, qrSubMode, loadDynamicQr]);

  // Đếm ngược & tự động làm mới mã QR mỗi 20 giây
  useEffect(() => {
    if (mode !== 'qr' || qrSubMode !== 'display' || !dynamicQrData) return;
    const timer = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          loadDynamicQr();
          return dynamicQrData.expiresIn || 20;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mode, qrSubMode, dynamicQrData, loadDynamicQr]);

  const handleCopyToken = async () => {
    if (!dynamicQrData?.qrToken) return;
    try {
      await navigator.clipboard.writeText(dynamicQrData.qrToken);
      setCopiedToken(true);
      toast.success('Đã sao chép mã QR Token!');
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      toast.error('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  // =========================================================================
  // RENDER MODE 1: ĐIỂM DANH TRỰC TUYẾN (GPS GEOFENCE)
  // =========================================================================
  if (mode === 'online') {
    return (
      <div
        className={
          embedded
            ? 'space-y-4'
            : 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-5'
        }
      >
        {/* Header: Chọn Vào Ca / Tan Ca + Đồng hồ */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => onChangeActionType('check_in')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
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
              onClick={() => onChangeActionType('check_out')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                actionType === 'check_out'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Tan Ca (Check-out)</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
            <span>{now.toLocaleTimeString('vi-VN')}</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400 font-sans font-medium">
              {now.toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>

        {/* Thẻ thông tin cán bộ đang điểm danh */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
          <UserAvatar
            user={authUser}
            name={authUser?.fullName}
            staffCode={authUser?.staffCode}
            size="md"
            shape="circle"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {authUser?.fullName || 'Cán bộ / Giảng viên'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {authUser?.staffCode || '—'} • {authUser?.email || ''}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/60 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            GPS Geofence
          </span>
        </div>

        {/* Khối định vị GPS & Khoảng cách khuôn viên */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isInsideCampus === true
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                    : isInsideCampus === false
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Xác thực vị trí khuôn viên ({campus.name})
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Bán kính hợp lệ: <strong>{campus.radiusMeters} m</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={refreshLocation}
              disabled={gpsLoading}
              className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>Định vị lại</span>
            </button>
          </div>

          {gpsError ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{gpsError}</span>
            </div>
          ) : coords ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Tọa độ hiện tại</div>
                <div className="text-xs font-mono font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Khoảng cách</div>
                <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                  {distanceMeters !== null
                    ? distanceMeters >= 1000
                      ? `${(distanceMeters / 1000).toFixed(2)} km`
                      : `${distanceMeters} m`
                    : '—'}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-medium text-slate-400 uppercase">Trạng thái vị trí</div>
                <div
                  className={`text-xs font-bold mt-0.5 flex items-center gap-1 ${
                    isInsideCampus
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isInsideCampus ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Trong khuôn viên
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Ngoài vùng GPS
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 py-1">
              <Navigation className="w-3.5 h-3.5 animate-pulse text-brand-500" />
              <span>Đang lấy tọa độ GPS từ thiết bị...</span>
            </div>
          )}
        </div>

        {/* Chọn ca làm việc (tùy chọn) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Ca làm việc áp dụng
          </label>
          <select
            value={selectedShiftId}
            onChange={(e) => setSelectedShiftId(e.target.value)}
            className="w-full h-9 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-brand-500 cursor-pointer"
          >
            <option value="">Tự động nhận diện ca theo lịch / khung giờ hiện tại</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ten_ca} ({s.gio_bat_dau} – {s.gio_ket_thuc})
              </option>
            ))}
          </select>
        </div>

        {/* Nút xác nhận điểm danh trực tuyến */}
        <button
          type="button"
          onClick={handleOnlineSubmit}
          disabled={isSubmitting}
          className={`w-full h-11 rounded-xl font-bold text-sm text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 ${
            actionType === 'check_out'
              ? 'bg-amber-600 hover:bg-amber-700'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang ghi nhận điểm danh...</span>
            </>
          ) : actionType === 'check_out' ? (
            <>
              <LogOut className="w-4 h-4" />
              <span>Xác Nhận Tan Ca Trực Tuyến</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Xác Nhận Vào Ca Trực Tuyến</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // =========================================================================
  // RENDER MODE 2: QUÉT MÃ QR ĐỘNG (TOTP 20 GIÂY)
  // =========================================================================
  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs space-y-4'
      }
    >
      {/* Sub-mode switcher: Chỉ hiển thị các chế độ đúng với vai trò */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70">
          {allowPersonalCheckIn && (
            <button
              type="button"
              onClick={() => setQrSubMode('scan')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                qrSubMode === 'scan'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Quét mã QR</span>
            </button>
          )}
          {allowKioskQrDisplay && (
            <button
              type="button"
              onClick={() => setQrSubMode('display')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                qrSubMode === 'display'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Hiển thị mã QR động (20s)</span>
            </button>
          )}
        </div>

        {qrSubMode === 'scan' && (
          <button
            type="button"
            onClick={isQrCamActive ? stopQrCamera : startQrCamera}
            disabled={qrCamLoading}
            className={`h-9 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
              isQrCamActive
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                : 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700'
            }`}
          >
            {isQrCamActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            <span>{isQrCamActive ? 'Tắt Camera QR' : 'Mở Camera Quét QR'}</span>
          </button>
        )}
      </div>

      {qrSubMode === 'scan' ? (
        <div className="space-y-4">
          {/* Khung Camera Quét QR */}
          <div className="relative w-full aspect-[4/3] max-h-[340px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            <video
              ref={qrVideoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${isQrCamActive ? 'block' : 'hidden'}`}
            />
            <canvas ref={qrCanvasRef} className="hidden" />

            {isQrCamActive ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-52 h-52 relative">
                  <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                  <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                  <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                  <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                </div>
                <div className="absolute bottom-3 px-3 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-medium border border-white/10">
                  Đưa mã QR động vào chính giữa khung quét
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 text-brand-400 flex items-center justify-center mx-auto">
                  <QrCode className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">Camera quét mã QR đang tắt</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Bấm "Mở Camera Quét QR" để quét trực tiếp mã QR động tại giảng đường, hoặc dán mã Token bên dưới.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startQrCamera}
                  disabled={qrCamLoading}
                  className="h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{qrCamLoading ? 'Đang mở camera...' : 'Bắt đầu quét QR'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Nhập mã QR thủ công */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              <span>Hoặc dán / nhập mã QR Token thủ công</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={qrTokenInput}
                onChange={(e) => setQrTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitQrToken(qrTokenInput);
                }}
                placeholder="Dán chuỗi mã QR động (eyJ...)"
                className="flex-1 h-9 px-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => submitQrToken(qrTokenInput)}
                disabled={isSubmitting || !qrTokenInput.trim()}
                className="h-9 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Điểm danh QR</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Sub-mode 2: Hiển thị mã QR động 20s cho Kiosk / Giảng đường */
        <div className="flex flex-col items-center text-center py-3 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border border-brand-200/70 dark:border-brand-800/60 text-[11px] font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mã QR TOTP ký HMAC-SHA256 • Tự làm mới mỗi 20 giây</span>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-slate-200/90 shadow-sm relative">
            {loadingDynamicQr && !dynamicQrData ? (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
            ) : dynamicQrData?.dataUrl ? (
              <img
                src={dynamicQrData.dataUrl}
                alt="Mã QR điểm danh động"
                className="w-[220px] h-[220px] object-contain"
              />
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-slate-400">
                Không thể tải mã QR
              </div>
            )}
          </div>

          {/* Thanh đếm ngược 20s */}
          <div className="w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Hiệu lực còn lại</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  qrCountdown <= 5 ? 'text-rose-600 dark:text-rose-400' : 'text-brand-600 dark:text-brand-400'
                }`}
              >
                {qrCountdown}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  qrCountdown <= 5 ? 'bg-rose-500' : 'bg-brand-600'
                }`}
                style={{ width: `${Math.max(0, Math.min(100, (qrCountdown / (dynamicQrData?.expiresIn || 20)) * 100))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDynamicQr}
              disabled={loadingDynamicQr}
              className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDynamicQr ? 'animate-spin' : ''}`} />
              <span>Tạo mã mới</span>
            </button>
            <button
              type="button"
              onClick={handleCopyToken}
              disabled={!dynamicQrData?.qrToken}
              className="h-9 px-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedToken ? 'Đã sao chép' : 'Sao chép Token'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
