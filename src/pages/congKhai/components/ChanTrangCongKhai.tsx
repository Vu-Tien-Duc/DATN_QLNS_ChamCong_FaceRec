import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, ChevronRight } from 'lucide-react';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="w-full bg-[#002b5c] text-slate-200 text-sm border-t-4 border-[#f37021]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Cột 1: Thông tin trường */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded bg-white p-1 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="NTU Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase">
                TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI
              </h3>
              <p className="text-xs text-[#f37021] font-semibold">
                NGUYEN TRAI UNIVERSITY
              </p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-300 pt-2">
            <p className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#f37021] shrink-0 mt-0.5" />
              <span>Số 28A Lê Trọng Tấn, Quận Hà Đông, TP. Hà Nội</span>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#f37021] shrink-0" />
              <span>(024) 3748 1830 - Hotline: 0981 922 641</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#f37021] shrink-0" />
              <span>daihocnguyentrai@gmail.com</span>
            </p>
          </div>
        </div>

        {/* Cột 2: Về Đại học Nguyễn Trãi */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/15 pb-2">
            Về Đại học Nguyễn Trãi
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li>
              <a href="#gioi-thieu" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Giới thiệu chung & Sứ mạng
              </a>
            </li>
            <li>
              <a href="#dao-tao" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Hệ thống Khoa & Viện đào tạo
              </a>
            </li>
            <li>
              <a href="#giang-vien" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Đội ngũ Cán bộ - Giảng viên
              </a>
            </li>
            <li>
              <a href="#nghien-cuu" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Nghiên cứu Khoa học & Chuyển đổi số
              </a>
            </li>
          </ul>
        </div>

        {/* Cột 3: Tuyển sinh & Đào tạo */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/15 pb-2">
            Tuyển sinh & Đào tạo
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li>
              <a href="#tuyen-sinh" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Thông tin Tuyển sinh Đại học 2026
              </a>
            </li>
            <li>
              <a href="#dao-tao" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Chương trình Đại học chính quy
              </a>
            </li>
            <li>
              <a href="#dao-tao" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Chương trình Liên kết Quốc tế
              </a>
            </li>
            <li>
              <a href="#tin-tuc" className="flex items-center gap-1.5 hover:text-[#f37021]">
                <ChevronRight className="w-3.5 h-3.5 text-[#f37021]" />
                Tin tức & Sự kiện Học thuật
              </a>
            </li>
          </ul>
        </div>

        {/* Cột 4: Hệ thống Quản trị Nội bộ */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/15 pb-2">
            Hệ thống Điện tử Nội bộ
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Cổng quản trị nhân sự, lịch giảng dạy và chấm công nhận diện khuôn mặt dành cho Cán bộ - Giảng viên.
          </p>
          <div className="pt-1">
            <Link
              to="/dang-nhap"
              className="inline-block px-4 py-2 rounded bg-[#f37021] hover:bg-[#d95f16] text-white text-xs font-bold transition-colors"
            >
              Đăng nhập Hệ thống Cán bộ (HRM)
            </Link>
          </div>
        </div>
      </div>

      {/* Bản quyền */}
      <div className="bg-[#001f42] py-4 px-4 text-center text-xs text-slate-400 border-t border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 Trường Đại học Nguyễn Trãi (Nguyen Trai University - NTU).</span>
          <span>Đồ án Tốt nghiệp • Vũ Tiến Đức (2310900023)</span>
        </div>
      </div>
    </footer>
  );
};
