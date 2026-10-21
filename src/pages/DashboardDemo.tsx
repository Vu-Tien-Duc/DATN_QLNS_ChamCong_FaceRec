import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Camera,
  FilePlus,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const DashboardDemo: React.FC = () => {
  const { user } = useAuthStore();
  const [btnLoading, setBtnLoading] = useState(false);

  const simulateLoading = () => {
    setBtnLoading(true);
    setTimeout(() => setBtnLoading(false), 1500);
  };

  const statCards = [
    {
      title: 'Tổng Cán Bộ & Giảng Viên',
      value: '14',
      sub: 'Thuộc 4 Khoa / Phòng Ban',
      change: '+2 tháng này',
      trend: 'up',
      icon: Users,
      color: 'from-blue-500 to-indigo-600',
      badgeColor: 'info' as const,
    },
    {
      title: 'Tỷ Lệ Điểm Danh Hôm Nay',
      value: '94.8%',
      sub: '13 / 14 nhân sự có mặt',
      change: 'Đúng giờ 100%',
      trend: 'up',
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      badgeColor: 'success' as const,
    },
    {
      title: 'Đơn Nghỉ Phép Chờ Duyệt',
      value: '02',
      sub: 'Cần Trưởng Khoa / BGH duyệt',
      change: '1 đơn mới hôm nay',
      trend: 'neutral',
      icon: Clock,
      color: 'from-amber-500 to-orange-600',
      badgeColor: 'warning' as const,
    },
    {
      title: 'Quỹ Lương Tháng 10/2026',
      value: '218.4M ₫',
      sub: 'Lương cơ sở 2.340.000 ₫',
      change: 'Đã khóa bảng lương',
      trend: 'up',
      icon: DollarSign,
      color: 'from-purple-500 to-brand-600',
      badgeColor: 'purple' as const,
    },
  ];

  const recentPunches = [
    {
      name: 'TS. Lê Thị Bích',
      role: 'Giảng viên CNTT',
      time: '07:42:15',
      shift: 'Ca Sáng (07:30 - 11:30)',
      similarity: '98.4%',
      status: 'ON_TIME',
      method: 'InsightFace 512D',
    },
    {
      name: 'GS. TS. Nguyễn Văn An',
      role: 'Hiệu Trưởng',
      time: '07:55:02',
      shift: 'Ca Hành Chính',
      similarity: '99.1%',
      status: 'ON_TIME',
      method: 'InsightFace 512D',
    },
    {
      name: 'Nguyễn Thu Hà',
      role: 'Chuyên viên Đào tạo',
      time: '08:08:40',
      shift: 'Ca Sáng (07:30 - 11:30)',
      similarity: '95.6%',
      status: 'LATE',
      method: 'InsightFace 512D',
    },
    {
      name: 'PGS. TS. Trần Hoàng Minh',
      role: 'Trưởng Khoa CNTT',
      time: '07:35:10',
      shift: 'Ca Sáng (07:30 - 11:30)',
      similarity: '97.9%',
      status: 'ON_TIME',
      method: 'InsightFace 512D',
    },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* ─── Hero Welcome Banner ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-indigo-800/40">
        {/* Glow background effects */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-xs">
                <img src="/logo.png" alt="NTU Logo" className="w-full h-full object-contain" />
              </div>
              <Badge variant="brand" size="sm" dot>
                Đại Học Nguyễn Trãi (NTU)
              </Badge>
              <Badge variant="purple" size="sm">
                Vai trò: {user?.role?.toUpperCase() || 'BGH'}
              </Badge>
              <span className="text-xs text-indigo-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> CSDL v2.5
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Xin chào, <span className="text-gradient-brand">{user?.fullName || 'Người Dùng'}</span>
            </h1>

            <p className="text-sm text-indigo-100/80 leading-relaxed">
              Chào mừng bạn đến với Hệ thống Quản lý Nhân sự & Chấm công ứng dụng Thị giác Máy tính
              (InsightFace 512-D). Hệ sinh thái thiết kế hiện đại, hỗ trợ Dark/Light mode và điều hướng mượt mà.
            </p>
          </div>

          {/* Quick Hero Actions */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Camera className="w-4 h-4" />}
              className="shadow-glow-primary bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              Điểm Danh AI
            </Button>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<FilePlus className="w-4 h-4" />}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md"
            >
              Nộp Đơn Phép
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Metric Stat Cards Grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} hoverEffect glass className="relative group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {stat.title}
                  </span>
                  <div
                    className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${stat.color} text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </span>
                  <Badge variant={stat.badgeColor} size="sm">
                    {stat.change}
                  </Badge>
                </div>

                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 truncate">
                  {stat.sub}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Design System & Theme Showcase Component Section ────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Today's Realtime Check-ins Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card glass hoverEffect>
            <CardHeader>
              <div>
                <CardTitle>Nhật Ký Chấm Công Hôm Nay (Realtime 512D)</CardTitle>
                <CardDescription>
                  Dữ liệu nhận diện khuôn mặt trực tiếp từ trạm camera giảng đường
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Xem tất cả
              </Button>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Cán Bộ / Giảng Viên</th>
                    <th className="px-4 py-3">Thời Gian</th>
                    <th className="px-4 py-3">Ca Làm Việc</th>
                    <th className="px-4 py-3">Độ Khớp AI</th>
                    <th className="px-4 py-3 text-right">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {recentPunches.map((item, pIdx) => (
                    <tr
                      key={pIdx}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{item.role}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-brand-600 dark:text-brand-400 font-medium">
                        {item.time}
                      </td>
                      <td className="px-4 py-3.5">{item.shift}</td>
                      <td className="px-4 py-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.similarity}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Badge
                          variant={item.status === 'ON_TIME' ? 'success' : 'warning'}
                          size="sm"
                          dot
                        >
                          {item.status === 'ON_TIME' ? 'Đúng Giờ' : 'Đi Muộn'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column (1/3): Theme & Design Tokens Interactive Lab */}
        <div className="space-y-6">
          <Card glass>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  Hệ Thống Thiết Kế (Design System)
                </CardTitle>
                <CardDescription>Các thành phần giao diện chuẩn (Buttons, Badges, Dark/Light)</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Theme Toggle Lab */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Chế độ hiển thị Theme:
                </span>
                <ThemeToggle showLabel className="w-full" />
              </div>

              {/* Button Variants Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Biến thể Nút (Button Variants):
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm">
                    Primary
                  </Button>
                  <Button variant="secondary" size="sm">
                    Secondary
                  </Button>
                  <Button variant="outline" size="sm">
                    Outline
                  </Button>
                  <Button variant="success" size="sm">
                    Success
                  </Button>
                  <Button variant="danger" size="sm">
                    Danger
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={btnLoading}
                    onClick={simulateLoading}
                  >
                    Bấm Thử Spinner
                  </Button>
                </div>
              </div>

              {/* Badge Variants Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nhãn trạng thái (Status Badges):
                </span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="brand" dot>
                    Brand
                  </Badge>
                  <Badge variant="success" dot>
                    Đã duyệt
                  </Badge>
                  <Badge variant="warning" dot>
                    Chờ duyệt
                  </Badge>
                  <Badge variant="danger" dot>
                    Từ chối
                  </Badge>
                  <Badge variant="purple">InsightFace 512D</Badge>
                  <Badge variant="neutral">Ca Hành Chính</Badge>
                </div>
              </div>

              {/* Color Palette Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Bảng màu chủ đạo (University Brand Palette):
                </span>
                <div className="grid grid-cols-5 gap-2">
                  <div className="h-8 rounded-lg bg-brand-500 shadow-sm flex items-center justify-center text-[10px] text-white font-mono">
                    500
                  </div>
                  <div className="h-8 rounded-lg bg-brand-600 shadow-sm flex items-center justify-center text-[10px] text-white font-mono">
                    600
                  </div>
                  <div className="h-8 rounded-lg bg-emerald-500 shadow-sm flex items-center justify-center text-[10px] text-white font-mono">
                    OK
                  </div>
                  <div className="h-8 rounded-lg bg-amber-500 shadow-sm flex items-center justify-center text-[10px] text-white font-mono">
                    WARN
                  </div>
                  <div className="h-8 rounded-lg bg-rose-500 shadow-sm flex items-center justify-center text-[10px] text-white font-mono">
                    ERR
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
