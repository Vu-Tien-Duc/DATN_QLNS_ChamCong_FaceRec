import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  ScanFace,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

interface FaceRecognitionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: any[];
  targetUser?: any;
}

export function FaceRecognitionTestModal({
  isOpen,
  onClose,
  users,
  targetUser
}: FaceRecognitionTestModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập camera');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }
    } catch (err: any) {
      setErrorMsg('Không thể mở Camera: ' + err.message);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setResult(null);
      setErrorMsg('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const captureFrameBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!videoRef.current) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const handleRecognize = async () => {
    setLoading(true);
    setErrorMsg('');
    setResult(null);

    try {
      const blob = await captureFrameBlob();
      if (!blob) throw new Error('Không thể chụp ảnh từ camera');

      const formData = new FormData();
      formData.append('image', blob, 'test_frame.jpg');

      let res: any;
      if (targetUser) {
        // Chế độ 1:1 Verify
        formData.append('employee_id', targetUser.email || targetUser._id);
        res = await apiClient.post('/face/verify?threshold=0.60&check_liveness=false', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Chế độ 1:N Recognize
        res = await apiClient.post('/face/recognize?threshold=0.60&check_liveness=false', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      if (res.data?.success) {
        const data = res.data.data;
        setResult(data);
        if (data.matched) {
          toast.success(`Đã nhận diện: ${data.full_name || data.employee_id} (${(data.similarity * 100).toFixed(1)}%)`);
        } else {
          toast.error('Không tìm thấy nhân sự phù hợp trong cơ sở dữ liệu Face AI');
        }
      } else {
        throw new Error(res.data?.message || 'Lỗi nhận diện khuôn mặt');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Lỗi khi gọi Face AI';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl p-6 rounded-3xl shadow-2xl border border-slate-200 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Thử nghiệm Nhận diện Face AI (1:N Identification)
              </h2>
              <p className="text-xs text-slate-500">
                Chụp ảnh trực tiếp để tìm kiếm danh tính nhân sự trong Face AI Vector DB
              </p>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera Preview */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-4/3 border-2 border-slate-200 flex items-center justify-center shadow-inner">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />

          {/* Guide Overlay Box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-60 border-2 border-dashed border-indigo-400/70 rounded-3xl animate-pulse flex items-center justify-center">
              <div className="w-full h-0.5 bg-indigo-400/40 shadow-sm shadow-indigo-300" />
            </div>
          </div>

          {loading && (
            <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center text-white gap-2 backdrop-blur-xs">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p className="text-xs font-bold">Đang so khớp với Face AI Vector DB...</p>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className={`p-4 rounded-2xl border ${
            result.matched
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  result.matched ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {result.matched ? <UserCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-black text-sm">
                    {result.matched ? result.full_name || result.employee_id : 'Chưa nhận diện được danh tính'}
                  </h4>
                  <p className="text-xs opacity-80">
                    {result.matched
                      ? `Mã: ${result.employee_id} • Khớp: ${(result.similarity * 100).toFixed(1)}% (Góc: ${result.matched_angle || 'chính diện'})`
                      : 'Độ tương đồng dưới ngưỡng 65% hoặc chưa được đăng ký trong hệ thống.'}
                  </p>
                </div>
              </div>

              {result.liveness_passed !== undefined && (
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                  result.liveness_passed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  {result.liveness_passed ? 'Liveness: Thật 🟢' : 'Liveness: Nghi vấn 🔴'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleRecognize}
            disabled={loading || !cameraActive}
            className="flex-1 py-3 px-5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            Chụp & Nhận Diện Ngay
          </button>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="py-3 px-5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer text-sm"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
