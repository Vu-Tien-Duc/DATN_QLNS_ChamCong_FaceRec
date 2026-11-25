import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SearchInput } from '../../components/chung/OTimKiem';
import {
  BookOpen,
  Plus,
  Search,
  Download,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  Building2,
  CheckCircle2,
  XCircle,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { DepartmentSelect } from '../../components/chung/ChonDonVi';
import { Button } from '../../components/chung/NutBam';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/useXacThucStore';
import { departmentApi } from '../../api/phongBan.api';
import { DepartmentItem } from '../../types/index';
import {
  subjectApi,
  SubjectItem,
  CreateSubjectPayload,
  UpdateSubjectPayload,
} from '../../api/monHoc.api';
import { isAdmin, hasRole, canManageSubjects } from '../../utils/phanQuyen';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';
import { ThanhPhanTrang } from '../../components/chung/ThanhPhanTrang';

export const Subjects: React.FC = () => {
  const { user } = useAuthStore();

  // Data States
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter States
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>(''); // '', 'active', 'pause'
  const [selectedCredits, setSelectedCredits] = useState<string>(''); // '', '1', '2', '3', '4', '9',...
  const [availableCredits, setAvailableCredits] = useState<number[]>([]);

  // Modals States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [viewingSubject, setViewingSubject] = useState<SubjectItem | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<SubjectItem | null>(null);

  // Form States (Create & Edit)
  const [formData, setFormData] = useState<CreateSubjectPayload>({
    ma_mon: '',
    ten_mon: '',
    so_tin_chi: 3,
    phong_ban_id: '',
    mo_ta: '',
    kich_hoat: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Role permissions (đồng bộ 100% với quyền LICH:XEP_LICH | HE_THONG:CAU_HINH ở Backend)
  const canManage = useMemo(() => canManageSubjects(user), [user]);

  const canDelete = useMemo(() => {
    return hasRole(user, ['admin', 'bgh']);
  }, [user]);

  // ===========================================================================
  // LOAD DEPARTMENTS
  // ===========================================================================
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await departmentApi.getDepartmentsFlat();
        const depts = res.data || [];
        setDepartments(Array.isArray(depts) ? depts : []);
      } catch (err) {
        console.error('Lỗi khi tải danh sách phòng ban:', err);
      }
    };
    fetchDepartments();
  }, []);

  // ===========================================================================
  // FETCH SUBJECTS LIST
  // ===========================================================================
  const fetchSeqRef = useRef(0);

  const fetchSubjects = useCallback(async () => {
    const reqSeq = ++fetchSeqRef.current;
    setIsLoading(true);
    try {
      let isActiveParam: boolean | undefined = undefined;
      if (selectedStatus === 'active') isActiveParam = true;
      if (selectedStatus === 'pause') isActiveParam = false;

      const res = await subjectApi.getSubjects({
        tim_kiem: searchKeyword.trim() || undefined,
        phong_ban_id: selectedDeptId || undefined,
        kich_hoat: isActiveParam,
        so_tin_chi: selectedCredits || undefined,
        trang: currentPage,
        gioi_han: limit,
      });

      if (reqSeq !== fetchSeqRef.current) return;
      setSubjects(res.subjects || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);

      if (res.availableCredits && res.availableCredits.length > 0) {
        setAvailableCredits((prev) => {
          const merged = Array.from(new Set([...prev, ...(res.availableCredits || [])])).sort((a, b) => a - b);
          return merged;
        });
      }
    } catch (err: any) {
      if (reqSeq !== fetchSeqRef.current) return;
      console.error('Lỗi khi tải danh sách môn học:', err);
      toast.error(err.response?.data?.message || 'Không thể tải danh mục môn học.');
      setSubjects([]);
    } finally {
      if (reqSeq === fetchSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [searchKeyword, selectedDeptId, selectedStatus, selectedCredits, currentPage, limit]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Trích xuất danh sách tất cả số tín chỉ thực tế có trong CSDL (bao gồm 1, 2, 3, 4, 9...)
  const distinctCreditsList = useMemo(() => {
    const set = new Set<number>(availableCredits);
    subjects.forEach((s) => {
      const c = Number(s.so_tin_chi);
      if (!isNaN(c) && c > 0) set.add(c);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [availableCredits, subjects]);

  const displayedSubjects = subjects;

  // ===========================================================================
  // COMPUTED KPIS
  // ===========================================================================
  const kpis = useMemo(() => {
    const total = totalCount || subjects.length;
    const active = subjects.filter((s) => s.kich_hoat).length;
    const totalCredits = subjects.reduce((sum, s) => sum + (Number(s.so_tin_chi) || 0), 0);
    const uniqueDepts = new Set(
      subjects
        .map((s) => {
          if (!s.phong_ban_id) return '';
          return typeof s.phong_ban_id === 'object' ? s.phong_ban_id.id : s.phong_ban_id;
        })
        .filter(Boolean)
    ).size;

    return {
      total,
      active,
      totalCredits,
      totalHours: totalCredits * 15,
      deptCount: uniqueDepts || (departments.length > 0 ? departments.length : 1),
    };
  }, [subjects, totalCount, departments]);

  // Reset filter
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedDeptId('');
    setSelectedStatus('');
    setSelectedCredits('');
    setCurrentPage(1);
    toast.success('Đã làm mới bộ lọc');
  };

  // Phân cấp danh sách Khoa & Bộ Môn
  const hierarchicalDepartments = useMemo(() => {
    const faculties = departments.filter((d) => d.loai_don_vi === 'khoa').sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi'));
    const boMons = departments.filter((d) => d.loai_don_vi === 'bo_mon').sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi'));
    const functional = departments.filter((d) => d.loai_don_vi === 'phong_ban' || !d.loai_don_vi).sort((a, b) => a.ten_phong_ban.localeCompare(b.ten_phong_ban, 'vi'));

    const boMonsByFaculty: Record<string, DepartmentItem[]> = {};
    boMons.forEach((bm) => {
      const pId = typeof bm.don_vi_cha_id === 'object' ? bm.don_vi_cha_id?.id : bm.don_vi_cha_id;
      if (pId) {
        if (!boMonsByFaculty[pId]) boMonsByFaculty[pId] = [];
        boMonsByFaculty[pId].push(bm);
      }
    });

    return { faculties, boMonsByFaculty, functional };
  }, [departments]);

  // Helper lấy tên khoa / bộ môn
  const getDepartmentName = (dept: any) => {
    if (!dept) return 'Chưa phân công';
    if (typeof dept === 'object' && dept.ten_phong_ban) return dept.ten_phong_ban;
    const found = departments.find((d) => d.id === dept);
    return found ? found.ten_phong_ban : 'Chưa phân công';
  };

  const sanitizeExcelCell = (value: unknown): string => {
    const str = String(value ?? '');
    return /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  };

  // ===========================================================================
  // EXPORT EXCEL (.XLSX)
  // ===========================================================================
  const handleExportExcel = () => {
    if (displayedSubjects.length === 0) {
      toast.error('Không có dữ liệu môn học để xuất file Excel.');
      return;
    }

    try {
      const dataRows = displayedSubjects.map((s, idx) => ({
        'STT': idx + 1,
        'Mã Môn Học': sanitizeExcelCell(s.ma_mon || '--'),
        'Tên Môn Học': sanitizeExcelCell(s.ten_mon || '--'),
        'Số Tín Chỉ': s.so_tin_chi || 0,
        'Định Mức Giờ Chuẩn': `${(s.so_tin_chi || 0) * 15} tiết chuẩn`,
        'Khoa / Bộ Môn Phụ Trách': sanitizeExcelCell(getDepartmentName(s.phong_ban_id)),
        'Trạng Thái Giảng Dạy': s.kich_hoat ? 'Đang giảng dạy' : 'Tạm ngưng',
        'Mô Tả / Đề Cương': sanitizeExcelCell(s.mo_ta || ''),
      }));

      const ws = XLSX.utils.json_to_sheet(dataRows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 32 },
        { wch: 12 },
        { wch: 22 },
        { wch: 28 },
        { wch: 22 },
        { wch: 35 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Danh Mục Môn Học');

      const vnDateSlug = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      const fileName = `Danh_Muc_Mon_Hoc_NTU_${vnDateSlug}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Đã xuất Danh mục môn học (.xlsx) thành công!');
    } catch (err) {
      console.error('Lỗi khi xuất file Excel:', err);
      toast.error('Không thể xuất file danh mục môn học.');
    }
  };

  // ===========================================================================
  // MODAL HANDLERS
  // ===========================================================================
  const openCreateModal = () => {
    setFormData({
      ma_mon: '',
      ten_mon: '',
      so_tin_chi: 3,
      phong_ban_id: departments.length > 0 ? departments[0].id : '',
      mo_ta: '',
      kich_hoat: true,
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (subject: SubjectItem) => {
    const deptId =
      typeof subject.phong_ban_id === 'object' && subject.phong_ban_id
        ? subject.phong_ban_id.id
        : (subject.phong_ban_id as string) || '';

    setEditingSubject(subject);
    setFormData({
      ma_mon: subject.ma_mon,
      ten_mon: subject.ten_mon,
      so_tin_chi: subject.so_tin_chi || 3,
      phong_ban_id: deptId,
      mo_ta: subject.mo_ta || '',
      kich_hoat: subject.kich_hoat ?? true,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.ma_mon.trim()) {
      toast.error('Vui lòng nhập mã môn học');
      return;
    }
    if (!formData.ten_mon.trim()) {
      toast.error('Vui lòng nhập tên môn học');
      return;
    }
    if (!formData.so_tin_chi || Number(formData.so_tin_chi) <= 0) {
      toast.error('Số tín chỉ phải lớn hơn 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSubjectPayload = {
        ma_mon: formData.ma_mon.trim().toUpperCase(),
        ten_mon: formData.ten_mon.trim(),
        so_tin_chi: Number(formData.so_tin_chi),
        phong_ban_id: formData.phong_ban_id || null,
        mo_ta: formData.mo_ta?.trim() || '',
        kich_hoat: formData.kich_hoat,
      };

      if (editingSubject) {
        await subjectApi.updateSubject(editingSubject.id, payload);
        toast.success('Cập nhật môn học thành công!');
        setEditingSubject(null);
      } else {
        await subjectApi.createSubject(payload);
        toast.success('Thêm môn học mới thành công!');
        setIsCreateModalOpen(false);
      }

      await fetchSubjects();
    } catch (err: any) {
      console.error('Lỗi lưu môn học:', err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu môn học.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;

    setIsSubmitting(true);
    try {
      await subjectApi.deleteSubject(deletingSubject.id);
      toast.success('Đã xóa môn học thành công!');
      setDeletingSubject(null);
      await fetchSubjects();
    } catch (err: any) {
      console.error('Lỗi xóa môn học:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa môn học này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5" data-purpose="academic-courses-dashboard">
      {/* =========================================================================
          1. PAGE HEADER + ACTIONS
         ========================================================================= */}
      <PageHeader
        title="Quản Lý Học Phần & Môn Học"
        subtitle="Danh mục học phần tín chỉ, số tiết lý thuyết, thực hành theo từng Khoa / Bộ môn."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleResetFilters}
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              type="button"
            >
              Làm mới
            </Button>

            <Button
              onClick={handleExportExcel}
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              title="Xuất danh mục môn học ra file Excel (.xlsx)"
              type="button"
            >
              Xuất Excel
            </Button>

            {canManage && (
              <Button
                onClick={openCreateModal}
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                type="button"
              >
                Thêm môn học
              </Button>
            )}
          </div>
        }
      />

      {/* =========================================================================
          2. UNIFIED WORKSPACE CARD: KPI STRIP + TOOLBAR + DATA TABLE
         ========================================================================= */}
      <CompactStatsBar
        items={[
          {
            label: 'Tổng môn học',
            value: kpis.total,
            unit: 'môn',
            subtext: 'Toàn chương trình đào tạo',
            tone: 'neutral',
            active: selectedStatus === '',
            onClick: () => {
              setSelectedStatus('');
              setCurrentPage(1);
            },
          },
          {
            label: 'Đang giảng dạy',
            value: kpis.active,
            badge: `${kpis.total > 0 ? Math.round((kpis.active / kpis.total) * 100) : 0}%`,
            progress: kpis.total > 0 ? Math.round((kpis.active / kpis.total) * 100) : 0,
            tone: 'success',
            active: selectedStatus === 'active',
            onClick: () => {
              setSelectedStatus((prev) => (prev === 'active' ? '' : 'active'));
              setCurrentPage(1);
            },
          },
          {
            label: 'Tổng tín chỉ',
            value: kpis.totalCredits,
            badge: `${kpis.totalHours} tiết`,
            subtext: 'Khối lượng đào tạo',
            tone: 'warning',
          },
          {
            label: 'Khoa / Bộ môn',
            value: kpis.deptCount,
            unit: 'đơn vị',
            subtext: 'Đang phụ trách môn',
            tone: 'brand',
          },
        ]}
      />

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col" data-purpose="course-table-card">
        <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {/* Text Search input */}
          <SearchInput
            value={searchKeyword}
            onChange={(next) => {
              setSearchKeyword(next);
              setCurrentPage(1);
            }}
            debounceMs={300}
            placeholder="Tìm theo mã môn hoặc tên môn..."
            className="relative flex-1 min-w-[200px]"
          />

          {/* Select: Khoa / Bộ Môn */}
          <div className="w-full sm:w-56 shrink-0">
            <DepartmentSelect
              departments={departments}
              value={selectedDeptId}
              onChange={(deptId) => {
                setSelectedDeptId(deptId);
                setCurrentPage(1);
              }}
              allowAll={true}
              allLabel="-- Tất cả Khoa / Bộ môn --"
              placeholder="Chọn Khoa / Bộ môn..."
              size="sm"
            />
          </div>

          {/* Select: Trạng thái */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 text-xs bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang giảng dạy</option>
            <option value="pause">Tạm ngưng</option>
          </select>

          {/* Select: Số tín chỉ */}
          <select
            value={selectedCredits}
            onChange={(e) => {
              setSelectedCredits(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 pl-3 pr-7 text-xs bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
          >
            <option value="">Tất cả tín chỉ</option>
            {distinctCreditsList.map((c) => (
              <option key={c} value={c}>
                {c} Tín chỉ
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-auto whitespace-nowrap">
            {totalCount || displayedSubjects.length} môn học
          </span>
        </div>

        {/* Strict Zero-Horizontal-Scroll Table */}
        <div className="w-full overflow-x-hidden">
          <table className="w-full table-fixed text-left border-collapse">
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 pl-4 pr-2" scope="col">Mã môn</th>
                <th className="py-2.5 px-3.5" scope="col">Tên môn học</th>
                <th className="py-2.5 px-3.5 text-center" scope="col">Tín chỉ</th>
                <th className="py-2.5 px-3.5 text-center" scope="col">Định mức giờ</th>
                <th className="py-2.5 px-3.5" scope="col">Khoa / Bộ môn</th>
                <th className="py-2.5 px-3.5 text-center" scope="col">Trạng thái</th>
                <th className="py-3 pl-2 pr-4 text-center" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang tải danh sách môn học...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedSubjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <BookOpen className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="text-xs font-semibold text-slate-600">Không tìm thấy môn học nào</span>
                      <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedSubjects.map((sub) => {
                  const credits = Number(sub.so_tin_chi) || 3;
                  const standardHours = credits * 15;
                  const deptName = getDepartmentName(sub.phong_ban_id);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Mã Môn */}
                      <td className="py-3 pl-4 pr-2 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                        {sub.ma_mon}
                      </td>

                      {/* Tên Môn Học + Mô tả */}
                      <td className="py-2.5 px-3.5 truncate leading-snug">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {sub.ten_mon}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {sub.mo_ta || 'Không có mô tả chi tiết'}
                        </div>
                      </td>

                      {/* Số Tín Chỉ */}
                      <td className="py-2.5 px-3.5 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 tabular-nums">
                          {credits} TC
                        </span>
                      </td>

                      {/* Định Mức Giờ Chuẩn */}
                      <td className="py-2.5 px-3.5 text-center text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        {standardHours} tiết
                      </td>

                      {/* Khoa / Bộ Môn Quản Lý */}
                      <td className="py-2.5 px-3.5 text-xs text-slate-700 dark:text-slate-300 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <span className="truncate" title={deptName}>
                            {deptName}
                          </span>
                        </div>
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-2.5 px-3.5 text-center">
                        {sub.kich_hoat ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Đang giảng dạy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Tạm ngưng
                          </span>
                        )}
                      </td>

                      {/* Thao Tác */}
                      <td className="py-3.5 pl-2 pr-6 text-center">
                        <div className="flex items-center justify-center gap-1 text-slate-400">
                          <button
                            onClick={() => setViewingSubject(sub)}
                            className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                            title="Xem chi tiết"
                            type="button"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => openEditModal(sub)}
                              className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                              title="Chỉnh sửa"
                              type="button"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeletingSubject(sub)}
                              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              title="Xóa học phần"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <ThanhPhanTrang
          currentPage={currentPage}
          totalPages={totalPages || 1}
          totalItems={totalCount || displayedSubjects.length}
          pageSize={limit}
          itemLabel="môn học"
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setLimit(newSize);
            setCurrentPage(1);
          }}
        />
      </section>

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA MÔN HỌC
         ========================================================================= */}
      {(isCreateModalOpen || editingSubject) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    {editingSubject ? 'Chỉnh Sửa Môn Học' : 'Thêm Môn Học Mới'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingSubject
                      ? `Cập nhật thông tin mã môn: ${editingSubject.ma_mon}`
                      : 'Khai báo học phần và định mức giảng dạy'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingSubject(null);
                }}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mã môn */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã môn học <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ma_mon}
                    onChange={(e) => setFormData({ ...formData, ma_mon: e.target.value.toUpperCase() })}
                    placeholder="VD: INT2204"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100 uppercase"
                  />
                </div>

                {/* Số tín chỉ */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số tín chỉ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.so_tin_chi}
                    onChange={(e) => setFormData({ ...formData, so_tin_chi: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ~{(Number(formData.so_tin_chi) || 0) * 15} tiết chuẩn giảng dạy
                  </span>
                </div>
              </div>

              {/* Tên môn học */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên môn học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.ten_mon}
                  onChange={(e) => setFormData({ ...formData, ten_mon: e.target.value })}
                  placeholder="VD: Cơ sở dữ liệu & Phân tích"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Khoa / Bộ môn Phân Cấp */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Khoa / Bộ môn phụ trách
                </label>
                <div className="w-full">
                  <DepartmentSelect
                    departments={departments}
                    value={formData.phong_ban_id || ''}
                    onChange={(deptId) => setFormData({ ...formData, phong_ban_id: deptId })}
                    allowAll={true}
                    allLabel="-- Chưa gán khoa / bộ môn --"
                    placeholder="Chọn Khoa / Bộ môn phụ trách..."
                    size="md"
                  />
                </div>
              </div>

              {/* Trạng thái hoạt động */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái giảng dạy</label>
                <div className="flex items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.kich_hoat === true}
                      onChange={() => setFormData({ ...formData, kich_hoat: true })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Đang giảng dạy (Active)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.kich_hoat === false}
                      onChange={() => setFormData({ ...formData, kich_hoat: false })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Tạm ngưng (Pause)</span>
                  </label>
                </div>
              </div>

              {/* Mô tả môn học */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mô tả học phần</label>
                <textarea
                  rows={3}
                  value={formData.mo_ta || ''}
                  onChange={(e) => setFormData({ ...formData, mo_ta: e.target.value })}
                  placeholder="Mục tiêu môn học, đề cương, chuẩn đầu ra..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                ></textarea>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingSubject(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : editingSubject ? 'Lưu Thay Đổi' : 'Thêm Môn Học'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: XEM CHI TIẾT MÔN HỌC
         ========================================================================= */}
      {viewingSubject && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Học Phần Đào Tạo</h3>
                  <p className="text-[11px] text-slate-400 font-mono font-semibold text-indigo-600">
                    {viewingSubject.ma_mon}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubject(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Tên môn học
                </span>
                <p className="text-base font-bold text-slate-900">{viewingSubject.ten_mon}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Số tín chỉ
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                    {viewingSubject.so_tin_chi || 3} Tín chỉ
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Định mức giờ chuẩn
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {(Number(viewingSubject.so_tin_chi) || 3) * 15} tiết chuẩn
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Khoa / Bộ môn phụ trách
                </span>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>{getDepartmentName(viewingSubject.phong_ban_id)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Trạng thái
                </span>
                {viewingSubject.kich_hoat ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Đang giảng dạy trong chương trình
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    Tạm ngưng mở lớp
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Mô tả học phần
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
                  {viewingSubject.mo_ta || 'Không có mô tả chi tiết cho môn học này.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Ngày tạo
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {(viewingSubject as any).tao_luc ? new Date((viewingSubject as any).tao_luc).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Cập nhật gần nhất
                  </span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {(viewingSubject as any).cap_nhat_luc ? new Date((viewingSubject as any).cap_nhat_luc).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setViewingSubject(null)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* =========================================================================
          MODAL: XÁC NHẬN XÓA MÔN HỌC
         ========================================================================= */}
      {deletingSubject && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Xác Nhận Xóa Môn Học</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bạn có chắc chắn muốn xóa học phần{' '}
                  <b className="text-slate-800 dark:text-slate-200 font-mono">{deletingSubject.ma_mon}</b> -{' '}
                  <b className="text-slate-800 dark:text-slate-200">{deletingSubject.ten_mon}</b> khỏi hệ thống?
                </p>
                <p className="text-[11px] text-rose-500 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/50 font-medium">
                  Hành động này sẽ không thể khôi phục và có thể ảnh hưởng đến các lớp học phần và thời khóa biểu liên quan.
                </p>
                <div className="pt-3 flex items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeletingSubject(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleDeleteSubject}
                    className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Đang xóa...' : 'Xóa Học Phần'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
