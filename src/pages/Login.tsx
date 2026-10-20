import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Camera,
  Cpu,
  Sparkles,
  Info,
  Check,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Đường dẫn quay lại sau khi đăng nhập thành công
  const from = (location.state as any)?.from?.pathname || '/';

  const demoAccounts = [
    {
      role: 'Hiệu Trưởng',
      name: 'GS. TS. Nguyễn Văn An',
      email: 'hieutruong@university.edu.vn',
      tag: 'BGH',
      variant: 'purple' as const,
    },
    {
      role: 'Quản Trị IT',
      name: 'Admin Hệ Thống',
      email: 'admin@university.edu.vn',
      tag: 'Admin IT',
      variant: 'brand' as const,
    },
    {
      role: 'Trưởng Khoa',
      name: 'PGS. TS. Lê Hoàng Nam',
      email: 'truongkhoa.cntt@university.edu.vn',
      tag: 'Khoa CNTT',
      variant: 'info' as const,
    },
    {
      role: 'Giảng Viên',
      name: 'TS. Trần Thị Bích',
      email: 'giangvien.bich@university.edu.vn',
      tag: 'Kỹ Thuật PM',
      variant: 'success' as const,
    },
    {
      role: 'Trưởng Phòng HC',
      name: 'ThS. Nguyễn Thị Mai',
      email: 'admin.hr@university.edu.vn',
      tag: 'Hành Chính',
      variant: 'warning' as const,
    },
    {
      role: 'Chuyên Viên',
      name: 'Đỗ Thu Hà',
      email: 'nhanvien.ha@university.edu.vn',
      tag: 'Đào Tạo',
      variant: 'neutral' as const,
    },
  ];

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email.');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    const success = await login({ email: email.trim(), password });
    if (success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-brand-500 selection:text-white overflow-x-hidden">
      {/* ─── Glowing Ambient Background Lights ───────────────────────── */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 dark:bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* ─── Header Navigation (Top Bar) ────────────────────────────── */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-brand-500/25">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              TRƯỜNG ĐẠI HỌC CÔNG NGHỆ
            </span>
            <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Hệ Thống Quản Lý Nhân Sự & Chấm Công FaceID
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* ─── Main Content Split Layout ──────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: University Branding & AI Biometrics Showcase */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-800/60 text-xs font-semibold text-brand-700 dark:text-brand-300 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              Công Nghệ Nhận Diện InsightFace Buffalo_S 512-D
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Quản Trị Nhân Sự & Điểm Danh Số Hóa{' '}
              <span className="text-gradient-brand">Thế Hệ Mới 2026</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Hệ sinh thái điểm danh thị giác máy tính đa góc chụp, phát hiện liveness chống giả mạo,
              tự động đối soát thời khóa biểu và tính toán bảng lương tức thời theo tiêu chuẩn CSDL v2.5.
            </p>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-xl mx-auto lg:mx-0">
              <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 backdrop-blur-md shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-2.5">
                  <Camera className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Camera AI Đa Góc Chụp
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  5 góc nhận diện (chính diện, trái, phải, ngửa, cúi) độ chính xác 99.4%.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 backdrop-blur-md shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Bảo Mật Sinh Trắc Học
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Mã hóa AES-256-GCM theo Nghị định 13/2023/NĐ-CP bảo vệ dữ liệu cá nhân.
                </p>
              </div>
            </div>

            {/* System Status Pill */}
            <div className="hidden sm:flex items-center gap-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                MongoDB 14 Collections v2.5
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-brand-500" />
                InsightFace Engine 8001
              </span>
            </div>
          </div>

          {/* Right Column: Glassmorphism Login Card */}
          <div className="lg:col-span-5">
            <div className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-6">
              {/* Form Title */}
              <div className="space-y-1 text-center sm:text-left">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Đăng Nhập Tài Khoản
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nhập thông tin cán bộ / giảng viên để truy cập bảng điều khiển
                </p>
              </div>

              {/* Error Alert Banner */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-slide-up">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email tài khoản
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@university.edu.vn"
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-brand-500 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Mật khẩu
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          'Mật khẩu mặc định của tất cả tài khoản mẫu trong CSDL là: password123\nHoặc liên hệ Quản trị viên IT để cấp lại.'
                        )
                      }
                      className="text-[11px] text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-brand-500 dark:focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 absolute right-2.5 top-1/2 -translate-y-1/2"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700 dark:bg-slate-800"
                  />
                  <label
                    htmlFor="remember"
                    className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
                  >
                    Ghi nhớ phiên đăng nhập trên thiết bị này
                  </label>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="w-full mt-2 shadow-glow-primary font-semibold"
                >
                  Đăng Nhập Ngay
                </Button>
              </form>

              {/* ─── Quick Demo Accounts Selector (1-Click Fill) ───────── */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>Tài khoản thử nghiệm nhanh:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Pass: password123</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {demoAccounts.map((acc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDemo(acc.email)}
                      className={`p-2 rounded-xl text-left border transition-all text-xs flex items-center justify-between group ${email === acc.email
                          ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-900 dark:text-brand-200 font-semibold'
                          : 'bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="truncate font-medium">{acc.role}</div>
                        <div className="text-[10px] text-slate-400 truncate">{acc.name}</div>
                      </div>
                      <Badge variant={acc.variant} size="sm">
                        {email === acc.email ? <Check className="w-3 h-3 text-brand-600" /> : acc.tag}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="relative z-10 py-4 px-6 border-t border-slate-200/60 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>
          Hệ Thống Quản Lý Nhân Sự & Chấm Công Đại Học • Sinh viên thực hiện:{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-400">Vũ Tiến Đức</span> (MSV:{' '}
          <span className="font-mono">2310900023</span>) • Phiên bản CSDL v2.5
        </p>
      </footer>
    </div>
  );
};
