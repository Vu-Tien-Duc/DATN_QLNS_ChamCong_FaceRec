import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  MapPin,
  Building2,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  Calendar,
  Award,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  publicFacultyApi,
  PublicFacultyDetail as FacultyDetailType,
} from '../../api/public_giangvien/giangVien.api';

export const FacultyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [faculty, setFaculty] = useState<FacultyDetailType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'bio' | 'research' | 'teaching'>('bio');

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await publicFacultyApi.getById(id);
        if (res.success && res.data) {
          setFaculty(res.data);
        } else {
          toast.error(res.message || 'Không tìm thấy thông tin giảng viên');
        }
      } catch (error) {
        console.error('Lỗi khi tải chi tiết giảng viên:', error);
        toast.error('Không thể tải hồ sơ giảng viên.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (faculty) {
      const titlePrefix = faculty.danh_hieu ? `${faculty.danh_hieu} ` : '';
      document.title = `${titlePrefix}${faculty.ho_ten} - Hồ sơ khoa học | ĐH Nguyễn Trãi (NTU)`;
    } else {
      document.title = 'Hồ sơ Giảng viên & Nhà khoa học | ĐH Nguyễn Trãi (NTU)';
    }
  }, [faculty]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-4 border-[#0c3b82] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500 font-medium">
          Đang tải hồ sơ khoa học...
        </span>
      </div>
    );
  }

  if (!faculty) {
    return (
      <div className="max-w-xl mx-auto my-20 p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy hồ sơ giảng viên</h2>
        <p className="text-xs text-slate-500">
          Hồ sơ này không tồn tại hoặc đã được chuyển khỏi danh bạ công khai của nhà trường.
        </p>
        <button
          onClick={() => navigate('/giang-vien')}
          className="px-4 py-2 rounded-xl bg-[#0c3b82] text-white text-xs font-semibold hover:bg-blue-800 transition-colors shadow"
        >
          Quay lại danh bạ giảng viên
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
        <Link to="/giang-vien" className="hover:text-[#0c3b82] transition-colors">
          Trang chủ
        </Link>
        <span>/</span>
        <Link to="/giang-vien" className="hover:text-[#0c3b82] transition-colors">
          Danh bạ Giảng viên
        </Link>
        <span>/</span>
        <span className="text-[#0c3b82] font-semibold">{faculty.ho_ten}</span>
      </nav>

      {/* Back button */}
      <div className="mb-6">
        <Link
          to="/giang-vien"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0c3b82] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </Link>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden sticky top-24">
          <div className="h-2.5 w-full bg-gradient-to-r from-[#0c3b82] via-[#2563eb] to-amber-400" />

          <div className="p-6 text-center">
            {/* Avatar lớn */}
            <div className="w-36 h-36 mx-auto rounded-full p-1.5 bg-gradient-to-tr from-[#0c3b82] via-blue-500 to-amber-400 shadow-md mb-4">
              {faculty.anh_dai_dien ? (
                <img
                  src={faculty.anh_dai_dien}
                  alt={faculty.ho_ten}
                  className="w-full h-full object-cover rounded-full bg-slate-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80';
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-900 to-[#0c3b82] flex items-center justify-center text-white text-4xl font-bold">
                  {faculty.ho_ten.charAt(0)}
                </div>
              )}
            </div>

            {/* Badge danh hiệu */}
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-[#0c3b82] border border-blue-200 mb-2">
              {faculty.danh_hieu || 'Cán bộ Giảng dạy'}
            </div>

            {/* Tên & Chức vụ */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
              {faculty.ho_ten}
            </h1>
            <p className="text-xs font-semibold text-[#0c3b82] mt-1">
              {faculty.chuc_vu || 'Giảng viên chuyên môn'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {faculty.khoa}
            </p>

            {/* Thông tin liên hệ nhanh */}
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-3 text-left text-xs text-slate-600">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0c3b82] flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div className="overflow-hidden">
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                    Email Học Thuật
                  </span>
                  <a
                    href={`mailto:${faculty.email}`}
                    className="font-medium text-blue-700 hover:underline truncate block"
                  >
                    {faculty.email}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0c3b82] flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                    Phòng Làm Việc
                  </span>
                  <span className="font-medium text-slate-700">
                    {(faculty.phong_lam_viec || 'Tòa nhà A1, ĐH Nguyễn Trãi (NTU)').replace(
                      'ĐH Phenikaa',
                      'ĐH Nguyễn Trãi (NTU)'
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0c3b82] flex items-center justify-center shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                    Đơn Vị Quản Lý
                  </span>
                  <span className="font-medium text-slate-700">
                    {faculty.khoa}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                    Tình Trạng
                  </span>
                  <span className="font-semibold text-emerald-600">
                    Đang trực tiếp giảng dạy & nghiên cứu
                  </span>
                </div>
              </div>
            </div>

            {/* Nút gửi email trực tiếp */}
            <div className="mt-6">
              <a
                href={`mailto:${faculty.email}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0c3b82] hover:bg-blue-800 text-white text-xs font-semibold shadow-md shadow-blue-900/10 transition-all active:scale-95"
              >
                <Mail className="w-4 h-4 text-amber-400" />
                <span>Gửi thư liên hệ</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Academic Tabs & Detailed Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Card với Tabs chuyển đổi phong cách Phenikaa */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="flex items-center border-b border-slate-200 overflow-x-auto text-xs sm:text-sm font-semibold">
              <button
                onClick={() => setActiveTab('bio')}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all shrink-0 ${
                  activeTab === 'bio'
                    ? 'border-[#0c3b82] text-[#0c3b82] bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4 text-[#0c3b82]" />
                <span>Lý Lịch Khoa Học & Giới Thiệu</span>
              </button>

              <button
                onClick={() => setActiveTab('research')}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all shrink-0 ${
                  activeTab === 'research'
                    ? 'border-[#0c3b82] text-[#0c3b82] bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Hướng Nghiên Cứu & Đề Tài</span>
              </button>

              <button
                onClick={() => setActiveTab('teaching')}
                className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all shrink-0 ${
                  activeTab === 'teaching'
                    ? 'border-[#0c3b82] text-[#0c3b82] bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <span>Học Phần Giảng Dạy</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 sm:p-8">
              {/* TAB 1: BIO & ACADEMIC BACKGROUND */}
              {activeTab === 'bio' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5 text-[#0c3b82]" />
                      <span>Tiểu Sử Khoa Học & Quá Trình Đào Tạo</span>
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
                      {faculty.tieu_su ||
                        `${faculty.ho_ten} là giảng viên giàu kinh nghiệm tại ${faculty.khoa}, Trường Đại học Nguyễn Trãi (NTU). Thầy/Cô tích cực tham gia các dự án nghiên cứu khoa học công nghệ, ứng dụng chuyển đổi số và hướng dẫn sinh viên, học viên cao học đạt nhiều thành tích xuất sắc.`}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30">
                      <span className="text-xs font-bold text-[#0c3b82] uppercase tracking-wider block mb-1">
                        Học Hàm & Chức Danh
                      </span>
                      <p className="text-sm font-semibold text-slate-800">
                        {faculty.danh_hieu}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/30">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">
                        Khoa / Viện Trực Thuộc
                      </span>
                      <p className="text-sm font-semibold text-slate-800">
                        {faculty.khoa}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: RESEARCH AREAS & PROJECTS */}
              {activeTab === 'research' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <span>Các Hướng Nghiên Cứu Mũi Nhọn</span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Tập trung vào các lĩnh vực công nghệ cao, giải quyết các bài toán chuyển đổi số và phát triển bền vững:
                    </p>

                    <div className="flex flex-wrap gap-2.5">
                      {faculty.huong_nghien_cuu && faculty.huong_nghien_cuu.length > 0 ? (
                        faculty.huong_nghien_cuu.map((topic, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50/60 border border-blue-200/80 text-blue-900 font-semibold text-xs shadow-sm"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#0c3b82]" />
                            <span>{topic}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">
                          Chưa cập nhật danh sách hướng nghiên cứu.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-800 mb-2">
                      Định Hướng Đề Tài & Hướng Dẫn Nghiên Cứu
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Sẵn sàng tiếp nhận sinh viên đam mê NCKH, học viên Cao học và Nghiên cứu sinh tham gia vào các nhóm nghiên cứu mạnh của Trường Đại học Nguyễn Trãi (NTU) trong các lĩnh vực AI, IoT, Công nghệ phần mềm và Quản trị thông minh.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: TEACHING COURSES */}
              {activeTab === 'teaching' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <span>Các Học Phần & Môn Học Đảm Nhiệm</span>
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Danh sách các môn học chính thức do giảng viên phụ trách trong chương trình đào tạo của nhà trường:
                    </p>

                    {/* Môn học chi tiết có trong DB */}
                    {faculty.cac_mon_chi_tiet && faculty.cac_mon_chi_tiet.length > 0 ? (
                      <div className="space-y-3">
                        {faculty.cac_mon_chi_tiet.map((sub) => (
                          <div
                            key={sub._id}
                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors bg-white shadow-sm flex items-start justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-[#0c3b82] font-bold text-[11px]">
                                  {sub.ma_mon}
                                </span>
                                <h4 className="text-sm font-bold text-slate-800">
                                  {sub.ten_mon}
                                </h4>
                              </div>
                              {sub.mo_ta && (
                                <p className="text-xs text-slate-500 line-clamp-2">
                                  {sub.mo_ta}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                              {sub.so_tin_chi} Tín chỉ
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : faculty.hoc_phan_giang_day && faculty.hoc_phan_giang_day.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {faculty.hoc_phan_giang_day.map((mon, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center gap-2 text-xs font-semibold text-slate-800"
                          >
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span>{mon}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        Hiện chưa có danh sách học phần cụ thể cho học kỳ hiện tại.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
