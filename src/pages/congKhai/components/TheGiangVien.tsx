import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, BookOpen, ArrowRight } from 'lucide-react';
import { PublicFacultyItem } from '../../../api/public_giangvien/giangVien.api';

interface FacultyCardProps {
  faculty: PublicFacultyItem;
}

export const FacultyCard: React.FC<FacultyCardProps> = ({ faculty }) => {
  const getDegreeLabel = () => {
    if (faculty.hoc_ham === 'giao_su' || faculty.danh_hieu.includes('GS')) return 'GS.TS';
    if (faculty.hoc_ham === 'pho_giao_su' || faculty.danh_hieu.includes('PGS')) return 'PGS.TS';
    if (faculty.hoc_vi === 'tien_si' || faculty.danh_hieu.includes('TS')) return 'Tiến sĩ';
    return 'Thạc sĩ';
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 hover:border-[#002b5c] hover:shadow-md transition-all flex flex-col overflow-hidden">
      {/* Top thin bar */}
      <div className="h-1 w-full bg-[#002b5c]" />

      {/* Avatar & Name */}
      <div className="p-5 flex items-start gap-4">
        <div className="w-20 h-20 rounded-full border border-slate-200 overflow-hidden shrink-0 bg-slate-100">
          {faculty.anh_dai_dien ? (
            <img
              src={faculty.anh_dai_dien}
              alt={faculty.ho_ten}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80';
              }}
            />
          ) : (
            <div className="w-full h-full bg-[#002b5c] flex items-center justify-center text-white text-xl font-bold">
              {faculty.ho_ten.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[#002b5c] border border-slate-200 rounded">
            {getDegreeLabel()}
          </span>
          <h3 className="text-base font-bold text-[#002b5c] mt-1 truncate">
            {faculty.ho_ten}
          </h3>
          <p className="text-xs font-semibold text-[#f37021] mt-0.5 truncate">
            {faculty.chuc_vu || 'Giảng viên cơ hữu'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {faculty.khoa}
          </p>
        </div>
      </div>

      {/* Info Details */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex-1 space-y-2 text-xs text-slate-600">
        {faculty.huong_nghien_cuu && faculty.huong_nghien_cuu.length > 0 && (
          <div className="flex items-start gap-2">
            <BookOpen className="w-3.5 h-3.5 text-[#002b5c] shrink-0 mt-0.5" />
            <span className="line-clamp-1">
              {faculty.huong_nghien_cuu.slice(0, 2).join(', ')}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{faculty.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{faculty.phong_lam_viec}</span>
        </div>
      </div>

      {/* Action Link */}
      <div className="px-5 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
        <span className="text-[11px] text-slate-400 font-semibold">
          {faculty.danh_hieu || getDegreeLabel()}
        </span>
        <Link
          to={`/giang-vien/${faculty._id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#002b5c] hover:text-[#f37021] transition-colors"
        >
          <span>Xem lý lịch khoa học</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
