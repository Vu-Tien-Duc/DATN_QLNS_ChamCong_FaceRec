import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuthStore } from '../../stores/useXacThucStore';
import { ThemeToggle } from '../../components/chung/NutChuyenGiaoDien';
import { Button } from '../../components/chung/NutBam';
import { Badge } from '../../components/chung/NhanTrangThai';
import { ModalQuenMatKhau } from './components/ModalQuenMatKhau';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

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
      tag: 'CNTT',
      variant: 'info' as const,
    },
    {
      role: 'Phó Khoa',
      name: 'TS. Đặng Tiến Hưng',
      email: 'phokhoa.cntt@university.edu.vn',
      tag: 'Phó Khoa',
      variant: 'info' as const,
    },
    {
      role: 'Giảng Viên',
      name: 'TS. Trần Thị Bích',
      email: 'giangvien.bich@university.edu.vn',
      tag: 'Giảng Viên',
      variant: 'success' as const,
    },
    {
      role: 'Chuyên Viên',
      name: 'Đỗ Thu Hà',
      email: 'nhanvien.ha@university.edu.vn',
      tag: 'Đào Tạo',
      variant: 'neutral' as const,
    },
    {
      role: 'Kiểm Toán / KT',
      name: 'Vũ Văn Thành',
      email: 'nhanvien.thanh@university.edu.vn',
      tag: 'Khảo Thí',
      variant: 'neutral' as const,
    },
    {
      role: 'Trưởng Phòng HC',
      name: 'ThS. Nguyễn Thị Mai',
      email: 'admin.hr@university.edu.vn',
      tag: 'Nhân Sự',
      variant: 'warning' as const,
    },
  ];

  const handleSelectDemo = async (demoEmail: string, autoSubmit = false) => {
    setEmail(demoEmail);
    setPassword('password123');
    setErrorMessage(null);

    if (autoSubmit) {
      const success = await login({ email: demoEmail, password: 'password123' });
      if (success) {
        navigate(from, { replace: true });
      }
    }
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
          <div className="w-12 h-12 rounded-xl bg-white p-1 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-sm overflow-hidden shrink-0">
            <img src="/logo.png" alt="NTU Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU)
            </span>
            <span className="text-[11px] font-medium text-brand-600 dark:text-brand-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Ứng dụng thị giác máy tính xây dựng hệ thống chấm công nhân sự - Đại Học Nguyễn Trãi (NTU)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/giang-vien"
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-[#0c3b82] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:border-blue-300 transition-all shadow-xs whitespace-nowrap"
          >
            <GraduationCap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Cổng Danh Bạ Giảng Viên</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* ─── Main Content Split Layout ──────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
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
                SQL Server 2022 (3NF 24 bảng)
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
            <div className="p-6 sm:p-7 rounded-3xl bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl space-y-5">
              {/* Brand Banner */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-11 h-11 rounded-2xl bg-white p-1.5 border border-slate-200/80 dark:border-slate-700/80 shadow-xs shrink-0 flex items-center justify-center">
                  <img src="/logo.png" alt="NTU Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                    ĐẠI HỌC NGUYỄN TRÃI
                  </h3>
                  <p className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">
                    Cổng Chấm Công & Nhân Sự FaceID
                  </p>
                </div>
              </div>

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
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
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
                      onClick={() => setShowForgotModal(true)}
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
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span className="shrink-0">Tài khoản thử nghiệm nhanh:</span>
                  <span className="text-[10px] text-slate-400 font-normal truncate">Nhấp đúp để đăng nhập tức thì</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {demoAccounts.map((acc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDemo(acc.email)}
                      onDoubleClick={() => handleSelectDemo(acc.email, true)}
                      title={`${acc.role} - ${acc.name} (${acc.email})`}
                      className={`px-2.5 py-2 rounded-xl text-left border transition-all text-xs flex items-center justify-between gap-1.5 group cursor-pointer ${
                        email === acc.email
                          ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-300 dark:border-brand-700 text-brand-900 dark:text-brand-200 font-semibold shadow-xs'
                          : 'bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-[11px] leading-tight">{acc.role}</div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{acc.name}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <Badge variant={acc.variant} size="sm" className="whitespace-nowrap !text-[10px] !px-2 !py-0.5">
                          {acc.tag}
                        </Badge>
                        {email === acc.email && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDemo(acc.email, true);
                            }}
                            className="p-1 rounded-md bg-brand-600 hover:bg-brand-700 text-white shadow-xs shrink-0"
                            title="Đăng nhập ngay với tài khoản này"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <ModalQuenMatKhau
        isOpen={showForgotModal}
        defaultEmail={email}
        onClose={() => setShowForgotModal(false)}
      />
      <footer className="relative z-10 py-4 px-6 border-t border-slate-200/60 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>
          Ứng dụng thị giác máy tính xây dựng hệ thống chấm công nhân sự - Đại Học Nguyễn Trãi (NTU) • Sinh viên thực hiện:{' '}
          <span className="font-semibold text-slate-600 dark:text-slate-400">Vũ Tiến Đức</span> (MSV:{' '}
          <span className="font-mono">2310900023</span>) • Phiên bản CSDL v2.5
        </p>
      </footer>
    </div>
  );
};
