import React, { useState, useEffect } from 'react';
import { X, Mail, KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../../api/xacThuc.api';
import { Portal } from '../../../components/chung/CongDichChuyen';

interface ModalQuenMatKhauProps {
  isOpen: boolean;
  defaultEmail?: string;
  onClose: () => void;
}

export const ModalQuenMatKhau: React.FC<ModalQuenMatKhauProps> = ({
  isOpen,
  defaultEmail = '',
  onClose,
}) => {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(defaultEmail || '');
    }
  }, [isOpen, defaultEmail]);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      if (res.success) {
        toast.success(res.message || 'Đã gửi mã OTP đặt lại mật khẩu về email.');
        setStep('reset');
      } else {
        toast.error(res.message || 'Không thể gửi mã OTP.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể gửi yêu cầu OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || newPassword.length < 6) {
      toast.error('Vui lòng nhập đủ mã OTP và mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        email: email.trim(),
        ma_otp: otp.trim(),
        mat_khau_moi: newPassword,
      });
      if (res.success) {
        toast.success(res.message || 'Đặt lại mật khẩu thành công!');
        setStep('done');
      } else {
        toast.error(res.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('request');
    setOtp('');
    setNewPassword('');
    onClose();
  };

  return (
    <Portal>
      <div
        onClick={handleClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Khôi Phục Mật Khẩu Qua Email (OTP)
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập email tài khoản của bạn để hệ thống gửi mã xác thực OTP 6 chữ số.
              </p>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="canbo@truong.edu.vn"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
                >
                  {loading ? 'Đang gửi...' : 'Gửi mã OTP'}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập mã OTP đã gửi tới <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span> và mật khẩu mới.
              </p>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Mã OTP (6 chữ số)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Gửi lại OTP
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-60"
                >
                  {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
                </button>
              </div>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4 py-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Đặt lại mật khẩu thành công!
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white"
              >
                Quay lại đăng nhập
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </Portal>
  );
};
