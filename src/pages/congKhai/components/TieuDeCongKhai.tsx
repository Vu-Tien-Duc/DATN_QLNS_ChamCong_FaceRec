import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

export const PublicHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<string>('');

  const navItems = [
    { label: 'GIỚI THIỆU', href: '#gioi-thieu' },
    { label: 'TUYỂN SINH', href: '#tuyen-sinh' },
    { label: 'ĐÀO TẠO', href: '#dao-tao' },
    { label: 'NGHIÊN CỨU', href: '#nghien-cuu' },
    { label: 'ĐỘI NGŨ GIẢNG VIÊN', href: '#giang-vien' },
    { label: 'TIN TỨC & SỰ KIỆN', href: '#tin-tuc' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (href === '#') return;

    if (location.pathname !== '/giang-vien') {
      navigate(`/giang-vien${href}`);
      setTimeout(() => {
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } else {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePortalSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPortal('');

    if (!val || val === '#') return;

    if (val === '/dang-nhap') {
      navigate('/dang-nhap');
      return;
    }

    if (val.startsWith('#')) {
      if (location.pathname !== '/giang-vien') {
        navigate(`/giang-vien${val}`);
      } else {
        const el = document.querySelector(val);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50">
      {/* TẦNG 1: TOP UTILITY BAR (Chuẩn Phenikaa: Xanh Navy đậm #002b5c) */}
      <div className="bg-[#002b5c] text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between">
          {/* Bên trái: Địa chỉ & Hotline */}
          <div className="flex items-center gap-5 overflow-hidden">
            <span className="flex items-center gap-1.5 text-slate-200 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#f37021] shrink-0" />
              <span>28A Lê Trọng Tấn, Hà Đông, Hà Nội</span>
            </span>
            <span className="hidden md:flex items-center gap-1.5 text-slate-200">
              <Phone className="w-3.5 h-3.5 text-[#f37021] shrink-0" />
              <span>(024) 3748 1830 - 0981 922 641</span>
            </span>
            <span className="hidden lg:flex items-center gap-1.5 text-slate-200">
              <Mail className="w-3.5 h-3.5 text-[#f37021] shrink-0" />
              <span>daihocnguyentrai@gmail.com</span>
            </span>
          </div>

          {/* Bên phải: Các liên kết đối tượng (Cái nào có thì trỏ thật, cái nào không có để #) */}
          <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-200">
            <Link
              to="/dang-nhap"
              className="hover:text-[#f37021] transition-colors"
            >
              Cán bộ - Giảng viên
            </Link>
            <span className="text-white/30">|</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hover:text-[#f37021] transition-colors"
            >
              Sinh viên
            </a>
            <span className="hidden sm:inline text-white/30">|</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hidden sm:inline hover:text-[#f37021] transition-colors"
            >
              Cựu sinh viên
            </a>
            <span className="hidden md:inline text-white/30">|</span>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="hidden md:inline hover:text-[#f37021] transition-colors"
            >
              Thư viện số
            </a>
            <span className="hidden sm:inline text-white/30">|</span>
            <span className="hidden sm:inline font-semibold text-slate-200">VN / EN</span>
          </div>
        </div>
      </div>

      {/* TẦNG 2: THANH ĐIỀU HƯỚNG CHÍNH (Logo bên trái - Menu ở giữa - Select Cổng thông tin bên phải) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
        {/* Logo & Tên trường */}
        <Link
          to="/giang-vien"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 shrink-0"
        >
          <img
            src="/logo.png"
            alt="Logo Đại học Nguyễn Trãi"
            className="w-11 h-11 object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold text-[#002b5c] uppercase leading-tight tracking-tight whitespace-nowrap">
              TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#f37021] uppercase tracking-wider whitespace-nowrap mt-0.5">
              NGUYEN TRAI UNIVERSITY
            </span>
          </div>
        </Link>

        {/* Menu ngang chính (Đơn giản, phẳng, vừa khít không bao giờ tràn) */}
        <nav className="hidden xl:flex items-center gap-4 text-[13px] font-bold text-[#002b5c]">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="py-2 hover:text-[#f37021] border-b-2 border-transparent hover:border-[#f37021] transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Bên phải: Duy nhất 1 ô Select Cổng thông tin gọn đẹp (không có nút thừa bị tràn) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <select
              value={selectedPortal}
              onChange={handlePortalSelectChange}
              aria-label="Chọn cổng thông tin"
              className="appearance-none bg-[#002b5c] hover:bg-[#001f42] text-white text-xs font-semibold rounded-md pl-3.5 pr-8 py-2.5 focus:outline-none cursor-pointer transition-colors"
            >
              <option value="" className="bg-white text-slate-800">
                Cổng thông tin điện tử
              </option>
              <option value="/dang-nhap" className="bg-white text-slate-800">
                Cổng Cán bộ - Giảng viên
              </option>
              <option value="#giang-vien" className="bg-white text-slate-800">
                Danh bạ Học thuật Giảng viên
              </option>
              <option value="#tuyen-sinh" className="bg-white text-slate-800">
                Cổng Thông tin Tuyển sinh
              </option>
              <option value="#" className="bg-white text-slate-800">
                Cổng Thông tin Sinh viên
              </option>
              <option value="#" className="bg-white text-slate-800">
                Hệ thống Học tập Trực tuyến (LMS)
              </option>
              <option value="#" className="bg-white text-slate-800">
                Thư viện số & Học liệu
              </option>
              <option value="#" className="bg-white text-slate-800">
                Cổng Cựu sinh viên & Việc làm
              </option>
            </select>
            <ChevronDown className="w-4 h-4 text-white/80 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu thu gọn cho màn hình nhỏ hơn xl */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="px-3 py-2 text-xs font-bold text-[#002b5c] hover:bg-slate-50 rounded"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
