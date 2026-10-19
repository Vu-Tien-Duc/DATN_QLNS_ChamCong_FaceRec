import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Mail, Lock, Loader2, LogIn, KeyRound, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/apiClient';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // States cho tính năng Quên mật khẩu qua OTP
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState<'REQUEST_OTP' | 'VERIFY_RESET'>('REQUEST_OTP');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Bộ đếm ngược Cooldown 60s
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      toast.error('Vui lòng nhập địa chỉ email giảng viên');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail.trim() });
      toast.success(res.data?.message || 'Mã OTP đã được gửi đến email của bạn!');
      if (res.data?.data?.devOtp) {
        toast((t) => (
          <span>
            <b>[Mã OTP thử nghiệm]:</b> {res.data.data.devOtp}
          </span>
        ), { duration: 10000, icon: '🔑' });
      }
      setForgotStep('VERIFY_RESET');
      setCooldown(60);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không thể gửi mã OTP. Vui lòng thử lại.';
      toast.error(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error('Vui lòng nhập đúng 6 chữ số mã OTP');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: forgotEmail.trim(),
        otp: otpCode.trim(),
        newPassword,
      });
      toast.success(res.data?.message || 'Đặt lại mật khẩu thành công!');
      setEmail(forgotEmail);
      setPassword('');
      setShowForgotModal(false);
      setForgotStep('REQUEST_OTP');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại OTP.';
      toast.error(message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setLoading(true);
    try {
      // Lấy vị trí GPS (nếu có)
      let locationData: { latitude?: number; longitude?: number; address?: string } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
      } catch (_) {
        // GPS không bắt buộc
      }

      await login(email, password, locationData);
      toast.success('Đăng nhập thành công!');
      navigate('/');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Email hoặc mật khẩu không đúng';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 gradient-blue" />
        {/* Pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px),
                              radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <Shield size={24} />
            </div>
            <div>
              <p className="font-bold text-lg leading-none">QLNS & Chấm Công</p>
              <p className="text-blue-200 text-sm">Hệ thống thị giác máy tính</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">
            Chào mừng trở lại
          </h1>
          <p className="text-blue-200 text-lg mb-12">
            Hệ thống Quản lý Nhân sự &amp; Chấm công ứng dụng nhận diện khuôn mặt AI
          </p>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: '🤖', title: 'Nhận diện khuôn mặt AI', desc: 'Chấm công tự động bằng FaceID' },
              { icon: '📊', title: 'Báo cáo thông minh', desc: 'Phân tích chuyên cần theo thời gian thực' },
              { icon: '🔒', title: 'Bảo mật cao', desc: 'JWT + httpOnly Cookie + RBAC' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-blue-200 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800">QLNS & Chấm Công</p>
              <p className="text-slate-500 text-xs">Thị giác máy tính</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Đăng nhập</h2>
          <p className="text-slate-500 mb-8">Nhập thông tin tài khoản để tiếp tục</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@university.edu.vn"
                  className="form-input pl-10"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Mật khẩu</label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input pl-10 pr-10"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Quên mật khẩu Link */}
            <div className="flex items-center justify-end -mt-2">
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email || '');
                  setForgotStep('REQUEST_OTP');
                  setShowForgotModal(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8">
            © 2024 DATN – Vũ Tiến Đức. Hệ thống QLNS Chấm công FaceID.
          </p>
        </div>
      </div>

      {/* Modal Quên mật khẩu qua OTP */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Đặt lại mật khẩu</h3>
                  <p className="text-xs text-slate-500">Xác thực OTP qua Email Giảng viên</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {forgotStep === 'REQUEST_OTP' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Vui lòng nhập địa chỉ email đã được cấp trên hệ thống để nhận mã xác thực OTP 6 chữ số:
                  </p>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">Email tài khoản</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="giangvien@university.edu.vn"
                        className="form-input pl-10"
                        autoFocus
                        disabled={forgotLoading}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="btn-secondary flex-1 justify-center py-2.5 text-sm"
                      disabled={forgotLoading}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-primary flex-1 justify-center py-2.5 text-sm"
                    >
                      {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : 'Gửi mã OTP'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
                    <Mail size={16} className="shrink-0 mt-0.5 text-blue-500" />
                    <div>
                      Mã OTP đã được gửi tới: <strong>{forgotEmail}</strong>. Mã có hiệu lực trong 10 phút.
                    </div>
                  </div>

                  {/* Mã OTP */}
                  <div className="form-group">
                    <label className="form-label text-center block" htmlFor="otp-code">
                      Nhập mã OTP 6 chữ số:
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="form-input text-center text-xl font-mono tracking-widest py-2.5 text-blue-900 font-bold"
                      autoFocus
                      disabled={forgotLoading}
                    />
                  </div>

                  {/* Mật khẩu mới */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-pass">Mật khẩu mới (tối thiểu 6 ký tự)</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="new-pass"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="form-input pl-10"
                        disabled={forgotLoading}
                      />
                    </div>
                  </div>

                  {/* Nhập lại mật khẩu mới */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-pass">Xác nhận mật khẩu mới</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="confirm-pass"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="form-input pl-10"
                        disabled={forgotLoading}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotStep('REQUEST_OTP')}
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <ArrowLeft size={14} /> Đổi email khác
                    </button>

                    <button
                      type="button"
                      disabled={cooldown > 0 || forgotLoading}
                      onClick={() => handleSendOtp()}
                      className={`font-semibold ${
                        cooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'
                      }`}
                    >
                      {cooldown > 0 ? `Gửi lại mã (${cooldown}s)` : 'Gửi lại mã OTP'}
                    </button>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="btn-secondary flex-1 justify-center py-2.5 text-sm"
                      disabled={forgotLoading}
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="btn-primary flex-1 justify-center py-2.5 text-sm"
                    >
                      {forgotLoading ? <Loader2 size={16} className="animate-spin" /> : 'Xác nhận đổi'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
