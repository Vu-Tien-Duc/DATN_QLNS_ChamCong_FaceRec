import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  Calendar,
  MapPin,
  CheckCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  publicFacultyApi,
  PublicFacultyItem,
  FacultyStats,
  DepartmentSummary,
} from '../../api/public_giangvien/giangVien.api';
import { FacultyCard } from './components/TheGiangVien';

// 1. Dữ liệu Đào tạo theo hệ (Chuẩn bố cục trang chủ Phenikaa)
const TRAINING_PROGRAMS = [
  {
    id: 'cntt',
    category: 'dai_hoc',
    title: 'Công nghệ Thông tin & Trí tuệ Nhân tạo',
    code: '7480201',
    facultyName: 'Khoa Công nghệ Thông tin',
    desc: 'Đào tạo kỹ sư phần mềm, trí tuệ nhân tạo, thị giác máy tính và hệ thống thông tin theo định hướng ứng dụng thực tiễn.',
    image: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'qtkd',
    category: 'dai_hoc',
    title: 'Quản trị Kinh doanh & Tài chính Ngân hàng',
    code: '7340101',
    facultyName: 'Khoa Kinh tế & Quản trị Kinh doanh',
    desc: 'Đào tạo cử nhân quản trị doanh nghiệp, tài chính số, kế toán kiểm toán và thương mại điện tử.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'kien_truc',
    category: 'dai_hoc',
    title: 'Kiến trúc, Nội thất & Thiết kế Đồ họa',
    code: '7580101',
    facultyName: 'Khoa Kiến trúc & Mỹ thuật Ứng dụng',
    desc: 'Đào tạo kiến trúc sư công trình, thiết kế nội thất và đồ họa đa phương tiện qua hệ thống xưởng thực hành.',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'ngon_ngu',
    category: 'quoc_te',
    title: 'Ngôn ngữ Nhật Bản, Hàn Quốc & Trung Quốc',
    code: '7220209',
    facultyName: 'Khoa Ngôn ngữ & Văn hóa Quốc tế',
    desc: 'Chương trình đào tạo ngoại ngữ chuyên ngành kết hợp học kỳ thực tập doanh nghiệp tại Nhật Bản và Hàn Quốc.',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dieu_duong',
    category: 'quoc_te',
    title: 'Khoa học Sức khỏe & Điều dưỡng Đa khoa',
    code: '7720301',
    facultyName: 'Khoa Khoa học Sức khỏe',
    desc: 'Đào tạo cử nhân điều dưỡng chuẩn quốc tế, thực hành lâm sàng tại các bệnh viện lớn.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'sau_dh',
    category: 'sau_dai_hoc',
    title: 'Đào tạo Thạc sĩ Quản lý Kinh tế & Kỹ thuật',
    code: '8340410',
    facultyName: 'Viện Đào tạo Sau đại học',
    desc: 'Chương trình đào tạo sau đại học nâng cao năng lực quản trị, lãnh đạo và nghiên cứu chuyên sâu.',
    image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80',
  },
];

// 2. Dữ liệu Tin tức & Sự kiện (Bố cục 1 tin lớn + danh sách tin & sự kiện như Phenikaa)
interface NewsItem {
  id: string;
  title: string;
  date: string;
  category: string;
  summary: string;
  content: string[];
  image: string;
}

const NEWS_LIST: NewsItem[] = [
  {
    id: 'news-1',
    title: 'Trường Đại học Nguyễn Trãi đẩy mạnh chuyển đổi số trong quản trị đại học và đào tạo ứng dụng năm 2026',
    date: '14/11/2026',
    category: 'Tin tiêu điểm',
    summary:
      'Nhà trường triển khai đồng bộ hệ thống quản trị nhân sự, lịch giảng dạy và điểm danh sinh trắc học kết hợp cổng thông tin học thuật công khai.',
    content: [
      'Trong chiến lược phát triển giai đoạn 2025 - 2030, Trường Đại học Nguyễn Trãi (NTU) tập trung hiện đại hóa hạ tầng công nghệ thông tin phục vụ công tác giảng dạy và quản trị đại học.',
      'Hệ thống tích hợp cơ sở dữ liệu cán bộ giảng viên, lịch trình giảng dạy và nhận diện khuôn mặt hỗ trợ tự động hóa quy trình chấm công, minh bạch hóa dữ liệu học thuật.',
      'Sinh viên và giảng viên có thể tra cứu trực tiếp danh bạ học thuật, thông tin bộ môn và các hướng nghiên cứu ngay trên cổng thông tin điện tử của Nhà trường.',
    ],
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1000&q=80',
  },
  {
    id: 'news-2',
    title: 'Hội thảo Khoa học Quốc gia về Trí tuệ Nhân tạo và Ứng dụng Thị giác Máy tính năm 2026',
    date: '10/11/2026',
    category: 'Nghiên cứu khoa học',
    summary:
      'Quy tụ các nhà khoa học, giảng viên và chuyên gia công nghệ chia sẻ các kết quả nghiên cứu mới về nhận diện sinh trắc học và học sâu.',
    content: [
      'Hội thảo do Khoa Công nghệ Thông tin tổ chức với sự tham gia của nhiều giảng viên, tiến sĩ và đại diện các doanh nghiệp công nghệ.',
      'Nhiều báo cáo khoa học xuất sắc của giảng viên và sinh viên đã được trình bày, khẳng định định hướng đại học ứng dụng gắn liền thực tiễn.',
    ],
    image: 'https://images.unsplash.com/photo-1591115765373-5207764f72e7?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'news-3',
    title: 'Lễ ký kết hợp tác đào tạo và tiếp nhận sinh viên thực tập với các doanh nghiệp Nhật Bản - Hàn Quốc',
    date: '05/11/2026',
    category: 'Hợp tác quốc tế',
    summary:
      'Mở rộng cơ hội thực tập hưởng lương và việc làm sau tốt nghiệp cho sinh viên các ngành CNTT, Ngôn ngữ và Quản trị kinh doanh.',
    content: [
      'Biên bản ghi nhớ hợp tác mở ra hàng trăm suất thực tập doanh nghiệp hàng năm cho sinh viên năm 3 và năm 4.',
      'Chương trình đào tạo theo đơn đặt hàng doanh nghiệp giúp sinh viên làm quen môi trường làm việc quốc tế ngay khi còn trên ghế nhà trường.',
    ],
    image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'news-4',
    title: 'Thông báo Tuyển sinh Đại học Chính quy năm 2026 và Chính sách Học bổng Nguyễn Trãi',
    date: '01/11/2026',
    category: 'Tuyển sinh',
    summary:
      'Công bố các phương thức xét tuyển đại học chính quy năm 2026 cùng quỹ học bổng khuyến khích tài năng dành cho tân sinh viên.',
    content: [
      'Nhà trường xét tuyển theo kết quả kỳ thi tốt nghiệp THPT, xét tuyển học bạ THPT và xét tuyển kết hợp chứng chỉ quốc tế.',
      'Thí sinh có thể đăng ký tư vấn trực tuyến ngay trên cổng thông tin tuyển sinh của trường.',
    ],
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80',
  },
];

const UPCOMING_EVENTS = [
  {
    day: '20',
    month: 'Th11',
    title: 'Lễ kỷ niệm Ngày Nhà giáo Việt Nam 20/11 & Vinh danh Giảng viên tiêu biểu',
    location: 'Hội trường lớn - Cơ sở 28A Lê Trọng Tấn',
  },
  {
    day: '28',
    month: 'Th11',
    title: 'Ngày hội Việc làm & Kết nối Doanh nghiệp NTU Career Fair 2026',
    location: 'Khuôn viên Trung tâm ĐH Nguyễn Trãi',
  },
  {
    day: '05',
    month: 'Th12',
    title: 'Bảo vệ Đồ án Tốt nghiệp Đại học chính quy đợt cuối năm 2026',
    location: 'Các phòng Hội đồng Khoa CNTT & Kinh tế',
  },
];

export const FacultyDirectory: React.FC = () => {
  const navigate = useNavigate();

  // State cho Danh bạ Giảng viên (Dữ liệu thật từ Backend)
  const [items, setItems] = useState<PublicFacultyItem[]>([]);
  const [stats, setStats] = useState<FacultyStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedDegree, setSelectedDegree] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // State cho các tab trên trang chủ
  const [activeProgramTab, setActiveProgramTab] = useState<string>('all');
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [admissionForm, setAdmissionForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    major: 'Công nghệ Thông tin & AI',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    publicFacultyApi
      .getStats()
      .then((res) => {
        if (res.data) {
          setStats(res.data);
          setDepartments(res.data.danh_sach_khoa || []);
        }
      })
      .catch(() => {});
  }, []);

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      const isAcademicRank = selectedDegree === 'giao_su' || selectedDegree === 'pho_giao_su';
      const res = await publicFacultyApi.getList({
        search: debouncedSearch || undefined,
        phong_ban_id: selectedDept || undefined,
        hoc_ham: isAcademicRank ? selectedDegree : undefined,
        hoc_vi: !isAcademicRank && selectedDegree ? selectedDegree : undefined,
        page,
        limit: 9,
      });
      if (res.data) {
        setItems(res.data || []);
        setTotalPages(res.pagination?.totalPages || 1);
        setTotalItems(res.pagination?.total || 0);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedDept, selectedDegree, page]);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedDept('');
    setSelectedDegree('');
    setPage(1);
  };

  const handleAdmissionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionForm.fullName.trim() || !admissionForm.phone.trim()) {
      toast.error('Vui lòng nhập họ tên và số điện thoại.');
      return;
    }
    toast.success(`Đã ghi nhận thông tin đăng ký tư vấn của ${admissionForm.fullName}!`);
    setAdmissionForm({
      fullName: '',
      phone: '',
      email: '',
      major: 'Công nghệ Thông tin & AI',
    });
  };

  const filteredPrograms =
    activeProgramTab === 'all'
      ? TRAINING_PROGRAMS
      : TRAINING_PROGRAMS.filter((p) => p.category === activeProgramTab);

  return (
    <div className="w-full bg-white text-slate-800">
      {/* =====================================================================
          1. HERO BANNER (Bố cục chuẩn Phenikaa: Ảnh trường + Hộp thông điệp gọn)
         ===================================================================== */}
      <section className="relative w-full h-[420px] sm:h-[480px] bg-[#002b5c] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1600&q=80"
          alt="Trường Đại học Nguyễn Trãi"
          className="w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#002b5c]/95 via-[#002b5c]/80 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">
          <div className="max-w-2xl space-y-4">
            <span className="inline-block px-3 py-1 bg-[#f37021] text-white text-xs font-bold uppercase tracking-wider rounded">
              TRƯỜNG ĐẠI HỌC NGUYỄN TRÃI (NTU)
            </span>
            <h1 className="text-2xl sm:text-4xl lg:text-[42px] font-bold text-white leading-tight">
              Đại học Ứng dụng • Đổi mới Sáng tạo & Hội nhập Quốc tế
            </h1>
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              Đào tạo nguồn nhân lực chất lượng cao theo mô hình 70% thực hành - 30% lý thuyết, kết nối chặt chẽ doanh nghiệp và tiên phong chuyển đổi số trong quản trị đại học.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href="#tuyen-sinh"
                className="px-5 py-2.5 bg-[#f37021] hover:bg-[#d95f16] text-white text-xs sm:text-sm font-bold rounded transition-colors"
              >
                THÔNG TIN TUYỂN SINH 2026
              </a>
              <a
                href="#giang-vien"
                className="px-5 py-2.5 bg-white hover:bg-slate-100 text-[#002b5c] text-xs sm:text-sm font-bold rounded transition-colors"
              >
                TRA CỨU DANH BẠ GIẢNG VIÊN
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. DẢI SỐ LIỆU THỐNG KÊ (Phenikaa Key Figures Strip)
         ===================================================================== */}
      <section className="bg-[#001f42] text-white border-b-4 border-[#f37021]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 lg:grid-cols-4 gap-6 text-center divide-x divide-white/10">
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f37021]">
              {stats?.tong_so_giang_vien || 32}+
            </div>
            <div className="text-xs text-slate-200 mt-1 font-medium uppercase">
              Cán bộ & Giảng viên cơ hữu
            </div>
          </div>
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f37021]">
              {stats?.so_luong_gs_pgs_ts || 14}+
            </div>
            <div className="text-xs text-slate-200 mt-1 font-medium uppercase">
              Giáo sư, Phó Giáo sư & Tiến sĩ
            </div>
          </div>
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f37021]">
              {stats?.danh_sach_khoa?.length || 12}
            </div>
            <div className="text-xs text-slate-200 mt-1 font-medium uppercase">
              Khoa, Viện & Phòng ban
            </div>
          </div>
          <div className="px-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#f37021]">96.4%</div>
            <div className="text-xs text-slate-200 mt-1 font-medium uppercase">
              Sinh viên có việc làm sau tốt nghiệp
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. GIỚI THIỆU VỀ TRƯỜNG (#gioi-thieu)
         ===================================================================== */}
      <section id="gioi-thieu" className="py-14 bg-white border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="border-l-4 border-[#f37021] pl-3">
                <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
                  VỀ CHÚNG TÔI
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#002b5c] mt-0.5">
                  Trường Đại học Nguyễn Trãi (NTU)
                </h2>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Trải qua gần 20 năm xây dựng và phát triển tại Thủ đô Hà Nội, Trường Đại học Nguyễn Trãi kiên định với mô hình <strong>Đại học Ứng dụng</strong> chuẩn quốc tế, lấy người học làm trung tâm và lấy chất lượng thực hành làm thước đo.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Nhà trường đẩy mạnh ứng dụng công nghệ thông tin và Trí tuệ nhân tạo (AI) trong công tác quản lý đào tạo, quản trị nhân sự và xây dựng môi trường đại học số hiện đại.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded">
                  <h4 className="text-sm font-bold text-[#002b5c]">Đào tạo gắn kết thực tiễn</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    70% thời lượng thực hành tại phòng Lab và thực tập trực tiếp tại doanh nghiệp đối tác.
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded">
                  <h4 className="text-sm font-bold text-[#002b5c]">Quản trị Đại học Số</h4>
                  <p className="text-xs text-slate-600 mt-1">
                    Hệ thống quản lý nhân sự, thời khóa biểu và điểm danh tự động bằng thị giác máy tính.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <img
                src="https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=600&q=80"
                alt="Khuôn viên Đại học Nguyễn Trãi"
                className="w-full h-56 object-cover rounded border border-slate-200"
              />
              <img
                src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=600&q=80"
                alt="Sinh viên Đại học Nguyễn Trãi"
                className="w-full h-56 object-cover rounded border border-slate-200"
              />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. TIN TỨC & SỰ KIỆN (#tin-tuc) - Chuẩn bố cục 2 cột Phenikaa
         ===================================================================== */}
      <section id="tin-tuc" className="py-14 bg-slate-50 border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div className="border-l-4 border-[#f37021] pl-3">
              <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
                BẢN TIN ĐẠI HỌC NGUYỄN TRÃI
              </span>
              <h2 className="text-2xl font-bold text-[#002b5c] mt-0.5">
                Tin tức & Sự kiện nổi bật
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Cột trái (8 cols): 1 Tin lớn + 3 Tin nhỏ */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tin tiêu điểm bên trái */}
              <div
                onClick={() => setSelectedNews(NEWS_LIST[0])}
                className="bg-white rounded border border-slate-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex flex-col"
              >
                <img
                  src={NEWS_LIST[0].image}
                  alt={NEWS_LIST[0].title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                      <span className="font-bold text-[#f37021]">{NEWS_LIST[0].category}</span>
                      <span>•</span>
                      <span>{NEWS_LIST[0].date}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#002b5c] hover:text-[#f37021] transition-colors line-clamp-2">
                      {NEWS_LIST[0].title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {NEWS_LIST[0].summary}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#002b5c] mt-3">
                    Đọc chi tiết <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>

              {/* 3 tin bên cạnh */}
              <div className="space-y-4">
                {NEWS_LIST.slice(1).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className="bg-white p-3 rounded border border-slate-200 hover:border-[#002b5c] transition-colors cursor-pointer flex gap-3.5"
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-24 h-20 object-cover rounded shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-[#f37021]">
                        {item.category} • {item.date}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-[#002b5c] hover:text-[#f37021] line-clamp-2 mt-0.5">
                        {item.title}
                      </h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cột phải (4 cols): Sự kiện sắp diễn ra (Chuẩn Phenikaa) */}
            <div className="lg:col-span-4 bg-white rounded border border-slate-200 p-5">
              <h3 className="text-base font-bold text-[#002b5c] uppercase border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#f37021]" />
                Sự kiện sắp diễn ra
              </h3>
              <div className="space-y-4">
                {UPCOMING_EVENTS.map((ev, idx) => (
                  <div key={idx} className="flex items-start gap-3.5 pb-4 border-b border-slate-100 last:border-none last:pb-0">
                    <div className="w-14 h-14 rounded bg-[#002b5c] text-white flex flex-col items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold leading-none">{ev.day}</span>
                      <span className="text-[10px] uppercase text-[#f37021] font-bold mt-0.5">
                        {ev.month}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                        {ev.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#f37021] shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. CHƯƠNG TRÌNH ĐÀO TẠO & KHOA VIỆN (#dao-tao)
         ===================================================================== */}
      <section id="dao-tao" className="py-14 bg-white border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="border-l-4 border-[#f37021] pl-3">
              <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
                CHƯƠNG TRÌNH ĐÀO TẠO
              </span>
              <h2 className="text-2xl font-bold text-[#002b5c] mt-0.5">
                Các Khoa & Ngành Đào Tạo Trọng Điểm
              </h2>
            </div>

            {/* Tabs lọc chương trình */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'dai_hoc', label: 'Đại học chính quy' },
                { id: 'quoc_te', label: 'Đào tạo Quốc tế' },
                { id: 'sau_dai_hoc', label: 'Sau đại học' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveProgramTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    activeProgramTab === tab.id
                      ? 'bg-[#002b5c] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrograms.map((prog) => (
              <div
                key={prog.id}
                className="bg-white rounded border border-slate-200 overflow-hidden hover:border-[#002b5c] hover:shadow-md transition-all flex flex-col"
              >
                <div className="h-44 overflow-hidden relative">
                  <img
                    src={prog.image}
                    alt={prog.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#002b5c] text-white text-[11px] font-bold rounded">
                    Mã ngành: {prog.code}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#f37021]">
                      {prog.facultyName}
                    </span>
                    <h3 className="text-base font-bold text-[#002b5c] mt-1">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {prog.desc}
                    </p>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <a
                      href="#giang-vien"
                      className="text-xs font-bold text-[#002b5c] hover:text-[#f37021] flex items-center gap-1"
                    >
                      <span>Xem đội ngũ giảng viên</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href="#tuyen-sinh"
                      className="text-xs font-semibold text-slate-500 hover:text-[#002b5c]"
                    >
                      Đăng ký xét tuyển
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. ĐỘI NGŨ CÁN BỘ - GIẢNG VIÊN (#giang-vien) - DỮ LIỆU THẬT TỪ CSDL
         ===================================================================== */}
      <section id="giang-vien" className="py-14 bg-slate-50 border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-l-4 border-[#f37021] pl-3 mb-6">
            <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
              CƠ SỞ DỮ LIỆU HỌC THUẬT CÔNG KHAI
            </span>
            <h2 className="text-2xl font-bold text-[#002b5c] mt-0.5">
              Đội ngũ Cán bộ & Giảng viên Trường Đại học Nguyễn Trãi
            </h2>
          </div>

          {/* Thanh công cụ tìm kiếm & lọc đơn giản, chuẩn mực */}
          <div className="bg-white p-4 rounded border border-slate-200 mb-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo họ tên, mã cán bộ, hướng nghiên cứu..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded focus:outline-none focus:border-[#002b5c]"
              />
            </div>

            <div className="md:col-span-3">
              <select
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo đơn vị"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-[#002b5c]"
              >
                <option value="">-- Tất cả Khoa / Đơn vị --</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.ten_khoa}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <select
                value={selectedDegree}
                onChange={(e) => {
                  setSelectedDegree(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo học hàm học vị"
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-[#002b5c]"
              >
                <option value="">-- Học hàm / Học vị --</option>
                <option value="giao_su">Giáo sư (GS)</option>
                <option value="pho_giao_su">Phó Giáo sư (PGS)</option>
                <option value="tien_si">Tiến sĩ (TS)</option>
                <option value="thac_si">Thạc sĩ (ThS)</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2 px-3 border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại ({totalItems})</span>
              </button>
            </div>
          </div>

          {/* Danh sách thẻ giảng viên */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-56 bg-white rounded border border-slate-200 p-5 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded border border-slate-200 p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-600">
                Không tìm thấy giảng viên phù hợp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 bg-[#002b5c] text-white text-xs font-bold rounded cursor-pointer"
              >
                Hiển thị toàn bộ giảng viên
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((faculty) => (
                  <FacultyCard key={faculty._id} faculty={faculty} />
                ))}
              </div>

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-[#002b5c] px-3">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded border border-slate-300 bg-white disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* =====================================================================
          7. NGHIÊN CỨU KHOA HỌC & CHUYỂN ĐỔI SỐ (#nghien-cuu)
         ===================================================================== */}
      <section id="nghien-cuu" className="py-14 bg-white border-b border-slate-200 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-l-4 border-[#f37021] pl-3 mb-8">
            <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
              KHOA HỌC CÔNG NGHỆ & ĐỔI MỚI SÁNG TẠO
            </span>
            <h2 className="text-2xl font-bold text-[#002b5c] mt-0.5">
              Hoạt động Nghiên cứu & Ứng dụng Trí tuệ Nhân tạo (AI)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded border border-slate-200 bg-slate-50">
              <span className="text-xs font-bold text-[#f37021] uppercase">Đề tài trọng điểm</span>
              <h3 className="text-base font-bold text-[#002b5c] mt-1">
                Thị giác Máy tính & Sinh trắc học Khuôn mặt
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Nghiên cứu và triển khai mô hình nhận diện khuôn mặt đa góc chụp (InsightFace 512-D) kết hợp chống giả mạo Liveness ứng dụng trực tiếp vào quản trị nhân sự nhà trường.
              </p>
            </div>

            <div className="p-6 rounded border border-slate-200 bg-slate-50">
              <span className="text-xs font-bold text-[#f37021] uppercase">Chuyển đổi số giáo dục</span>
              <h3 className="text-base font-bold text-[#002b5c] mt-1">
                Hệ thống Quản trị Nhân sự & Học thuật Đồng bộ
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Số hóa toàn diện hồ sơ cán bộ giảng viên, tự động đối soát lịch giảng dạy, quản lý đơn từ trực tuyến và tính toán lương minh bạch.
              </p>
            </div>

            <div className="p-6 rounded border border-slate-200 bg-slate-50">
              <span className="text-xs font-bold text-[#f37021] uppercase">Hợp tác Doanh nghiệp</span>
              <h3 className="text-base font-bold text-[#002b5c] mt-1">
                Chuyển giao Công nghệ & Đồ án Thực tế
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                100% đề tài khóa luận tốt nghiệp của sinh viên hướng tới giải quyết bài toán thực tiễn tại trường học và doanh nghiệp đối tác.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          8. TUYỂN SINH ĐẠI HỌC 2026 (#tuyen-sinh)
         ===================================================================== */}
      <section id="tuyen-sinh" className="py-14 bg-slate-50 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Thông tin phương thức xét tuyển */}
            <div className="lg:col-span-7 space-y-4">
              <div className="border-l-4 border-[#f37021] pl-3">
                <span className="text-xs font-bold text-[#f37021] uppercase tracking-wider">
                  TUYỂN SINH ĐẠI HỌC CHÍNH QUY 2026
                </span>
                <h2 className="text-2xl font-bold text-[#002b5c] mt-0.5">
                  Phương thức Xét tuyển & Chính sách Học bổng
                </h2>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Năm 2026, Trường Đại học Nguyễn Trãi (Mã trường: <strong>NTU</strong>) tuyển sinh đại học chính quy theo 3 phương thức linh hoạt, tạo điều kiện thuận lợi cho thí sinh trên cả nước:
              </p>

              <div className="space-y-3">
                <div className="p-4 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#f37021] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#002b5c]">
                      Phương thức 1: Xét tuyển kết quả kỳ thi tốt nghiệp THPT năm 2026
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Theo ngưỡng đảm bảo chất lượng đầu vào của Bộ Giáo dục & Đào tạo.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#f37021] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#002b5c]">
                      Phương thức 2: Xét tuyển Học bạ THPT
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Xét tổng điểm trung bình 3 môn theo tổ hợp xét tuyển năm lớp 12 hoặc 3 học kỳ (HK1, HK2 lớp 11 và HK1 lớp 12) đạt từ 18.0 điểm trở lên.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white rounded border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#f37021] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#002b5c]">
                      Phương thức 3: Xét tuyển thẳng & Chứng chỉ Quốc tế (IELTS, TOPIK, JLPT)
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Ưu tiên xét tuyển và cấp học bổng từ 30% - 100% học phí năm đầu cho thí sinh có thành tích học tập xuất sắc.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form đăng ký tư vấn tuyển sinh */}
            <div className="lg:col-span-5 bg-white p-6 rounded border border-slate-200 shadow-sm">
              <h3 className="text-base font-bold text-[#002b5c] uppercase border-b border-slate-200 pb-3 mb-4">
                Đăng ký Tư vấn Tuyển sinh 2026
              </h3>
              <form onSubmit={handleAdmissionSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Họ và tên thí sinh *
                  </label>
                  <input
                    type="text"
                    required
                    value={admissionForm.fullName}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, fullName: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[#002b5c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại liên hệ *
                  </label>
                  <input
                    type="tel"
                    required
                    value={admissionForm.phone}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, phone: e.target.value })}
                    placeholder="098xxxxxxx"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[#002b5c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email nhận thông tin
                  </label>
                  <input
                    type="email"
                    value={admissionForm.email}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, email: e.target.value })}
                    placeholder="thisinh@gmail.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:border-[#002b5c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngành quan tâm xét tuyển
                  </label>
                  <select
                    value={admissionForm.major}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, major: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:border-[#002b5c]"
                  >
                    <option value="Công nghệ Thông tin & AI">Công nghệ Thông tin & AI (7480201)</option>
                    <option value="Quản trị Kinh doanh">Quản trị Kinh doanh (7340101)</option>
                    <option value="Kiến trúc & Thiết kế Đồ họa">Kiến trúc & Thiết kế Đồ họa (7580101)</option>
                    <option value="Ngôn ngữ Nhật - Hàn - Trung">Ngôn ngữ Nhật - Hàn - Trung (7220209)</option>
                    <option value="Khoa học Sức khỏe & Điều dưỡng">Khoa học Sức khỏe & Điều dưỡng (7720301)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#f37021] hover:bg-[#d95f16] text-white text-xs sm:text-sm font-bold uppercase rounded transition-colors cursor-pointer"
                >
                  Gửi đăng ký tư vấn
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Modal đọc chi tiết bài viết tin tức */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedNews(null)}
        >
          <div
            className="bg-white rounded max-w-2xl w-full overflow-hidden shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#002b5c] text-white px-6 py-4 flex items-center justify-between">
              <span className="text-xs font-bold text-[#f37021] uppercase">
                {selectedNews.category} • {selectedNews.date}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-[#002b5c]">{selectedNews.title}</h3>
              <img
                src={selectedNews.image}
                alt={selectedNews.title}
                className="w-full h-56 object-cover rounded"
              />
              {selectedNews.content.map((p, idx) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                className="px-4 py-1.5 bg-[#002b5c] text-white text-xs font-semibold rounded cursor-pointer"
              >
                Đóng bài viết
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
