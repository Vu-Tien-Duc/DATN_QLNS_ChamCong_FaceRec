import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
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
import { isAdmin, hasRole } from '../../utils/phanQuyen';
import { Portal } from '../../components/chung/CongDichChuyen';
import { PageHeader } from '../../components/chung/TieuDeTrang';
import { CompactStatsBar } from '../../components/chung/ThanhThongKeGon';

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
    code: '',
    name: '',
    credits: 3,
    departmentId: '',
    description: '',
    isActive: true,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Role permissions
  const canManage = useMemo(() => {
    return hasRole(user, ['admin', 'bgh', 'truong_khoa']);
  }, [user]);

  const canDelete = useMemo(() => {
    return isAdmin(user);
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
  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    try {
      let isActiveParam: boolean | undefined = undefined;
      if (selectedStatus === 'active') isActiveParam = true;
      if (selectedStatus === 'pause') isActiveParam = false;

      const res = await subjectApi.getSubjects({
        search: searchKeyword.trim() || undefined,
        departmentId: selectedDeptId || undefined,
        isActive: isActiveParam,
        credits: selectedCredits || undefined,
        page: currentPage,
        limit,
      });

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
      console.error('Lỗi khi tải danh sách môn học:', err);
      toast.error(err.response?.data?.message || 'Không thể tải danh mục môn học.');
      setSubjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchKeyword, selectedDeptId, selectedStatus, selectedCredits, currentPage, limit]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  // Trích xuất danh sách tất cả số tín chỉ thực tế có trong CSDL (bao gồm 1, 2, 3, 4, 9...)
  const distinctCreditsList = useMemo(() => {
    const set = new Set<number>(availableCredits);
    subjects.forEach((s) => {
      const c = Number(s.credits);
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
    const active = subjects.filter((s) => s.isActive).length;
    const totalCredits = subjects.reduce((sum, s) => sum + (Number(s.credits) || 0), 0);
    const uniqueDepts = new Set(
      subjects
        .map((s) => {
          if (!s.departmentId) return '';
          return typeof s.departmentId === 'object' ? s.departmentId._id : s.departmentId;
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
    const faculties = departments.filter((d) => d.type === 'khoa').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const boMons = departments.filter((d) => d.type === 'bomon').sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const functional = departments.filter((d) => d.type === 'phongban' || !d.type).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    const boMonsByFaculty: Record<string, DepartmentItem[]> = {};
    boMons.forEach((bm) => {
      const pId = typeof bm.parentId === 'object' ? bm.parentId?._id : bm.parentId;
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
    if (typeof dept === 'object' && dept.name) return dept.name;
    const found = departments.find((d) => d._id === dept);
    return found ? found.name : 'Chưa phân công';
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
        'Mã Môn Học': s.code || '--',
        'Tên Môn Học': s.name || '--',
        'Số Tín Chỉ': s.credits || 0,
        'Định Mức Giờ Chuẩn': `${(s.credits || 0) * 15} tiết chuẩn`,
        'Khoa / Bộ Môn Phụ Trách': getDepartmentName(s.departmentId),
        'Trạng Thái Giảng Dạy': s.isActive ? 'Đang giảng dạy' : 'Tạm ngưng',
        'Mô Tả / Đề Cương': s.description || '',
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

      const fileName = `Danh_Muc_Mon_Hoc_NTU_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      code: '',
      name: '',
      credits: 3,
      departmentId: departments.length > 0 ? departments[0]._id : '',
      description: '',
      isActive: true,
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (subject: SubjectItem) => {
    const deptId =
      typeof subject.departmentId === 'object' && subject.departmentId
        ? subject.departmentId._id
        : (subject.departmentId as string) || '';

    setEditingSubject(subject);
    setFormData({
      code: subject.code,
      name: subject.name,
      credits: subject.credits || 3,
      departmentId: deptId,
      description: subject.description || '',
      isActive: subject.isActive ?? true,
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('Vui lòng nhập mã môn học');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên môn học');
      return;
    }
    if (!formData.credits || Number(formData.credits) <= 0) {
      toast.error('Số tín chỉ phải lớn hơn 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateSubjectPayload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        credits: Number(formData.credits),
        departmentId: formData.departmentId || null,
        description: formData.description?.trim() || '',
        isActive: formData.isActive,
      };

      if (editingSubject) {
        await subjectApi.updateSubject(editingSubject._id, payload);
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
      await subjectApi.deleteSubject(deletingSubject._id);
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
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs overflow-hidden flex flex-col" data-purpose="course-table-card">
        <CompactStatsBar
          embedded
          items={[
            { label: 'Tổng môn học', value: kpis.total, unit: 'môn', tone: 'neutral' },
            { label: 'Đang giảng dạy', value: kpis.active, unit: 'môn', tone: 'success' },
            { label: 'Tổng tín chỉ', value: kpis.totalCredits, badge: `${kpis.totalHours} tiết`, tone: 'warning' },
            { label: 'Khoa / Bộ môn', value: kpis.deptCount, unit: 'đơn vị', tone: 'brand' },
          ]}
        />
        <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2">
          {/* Text Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-brand-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-colors"
              placeholder="Tìm theo mã môn hoặc tên môn..."
              type="text"
            />
          </div>

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
            className="h-9 pl-3 pr-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
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
            className="h-9 pl-3 pr-7 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200 font-medium cursor-pointer"
          >
            <option value="">Tất cả tín chỉ</option>
            {distinctCreditsList.map((c) => (
              <option key={c} value={c}>
                {c} Tín chỉ
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 ml-auto text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium whitespace-nowrap">
              {displayedSubjects.length} / {totalCount || displayedSubjects.length} môn
            </span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-9 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-lg px-2.5 focus:outline-none font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              aria-label="Số môn mỗi trang"
            >
              <option value="10">10 / trang</option>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
            </select>
          </div>
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
                <th className="py-3 px-3" scope="col">Tên môn học</th>
                <th className="py-3 px-3 text-center" scope="col">Tín chỉ</th>
                <th className="py-3 px-3 text-center" scope="col">Định mức giờ</th>
                <th className="py-3 px-3" scope="col">Khoa / Bộ môn</th>
                <th className="py-3 px-3 text-center" scope="col">Trạng thái</th>
                <th className="py-3 pl-2 pr-4 text-center" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
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
                      <span className="text-sm font-semibold text-slate-600">Không tìm thấy môn học nào</span>
                      <p className="text-xs text-slate-400">Thử thay đổi từ khóa tìm kiếm hoặc bỏ bớt các bộ lọc</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedSubjects.map((sub) => {
                  const credits = Number(sub.credits) || 3;
                  const standardHours = credits * 15;
                  const deptName = getDepartmentName(sub.departmentId);

                  return (
                    <tr key={sub._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Mã Môn */}
                      <td className="py-3 pl-4 pr-2 text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400">
                        {sub.code}
                      </td>

                      {/* Tên Môn Học + Mô tả */}
                      <td className="py-3 px-3 truncate leading-snug">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {sub.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {sub.description || 'Không có mô tả chi tiết'}
                        </div>
                      </td>

                      {/* Số Tín Chỉ */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 tabular-nums">
                          {credits} TC
                        </span>
                      </td>

                      {/* Định Mức Giờ Chuẩn */}
                      <td className="py-3 px-3 text-center text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                        {standardHours} tiết
                      </td>

                      {/* Khoa / Bộ Môn Quản Lý */}
                      <td className="py-3 px-3 text-sm text-slate-700 dark:text-slate-300 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                          <span className="truncate" title={deptName}>
                            {deptName}
                          </span>
                        </div>
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-3 px-3 text-center">
                        {sub.isActive ? (
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
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span>
              Trang <b className="text-slate-800 dark:text-slate-200">{currentPage}</b> / {totalPages || 1} (Tổng cộng{' '}
              {totalCount || displayedSubjects.length} môn học)
            </span>
          </div>
          <div className="flex items-center gap-1 select-none">
            {/* Prev Button */}
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                currentPage <= 1
                  ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
              }`}
              type="button"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Current Page Indicator */}
            <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center justify-center">
              {currentPage}
            </span>

            {/* Next Button */}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                currentPage >= totalPages
                  ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
              }`}
              type="button"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          MODAL: THÊM MỚI / CHỈNH SỬA MÔN HỌC
         ========================================================================= */}
      {(isCreateModalOpen || editingSubject) && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
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
                      ? `Cập nhật thông tin mã môn: ${editingSubject.code}`
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
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
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
                    max="30"
                    required
                    value={formData.credits}
                    onChange={(e) => setFormData({ ...formData, credits: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ~{(Number(formData.credits) || 0) * 15} tiết chuẩn giảng dạy
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
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                    value={formData.departmentId || ''}
                    onChange={(deptId) => setFormData({ ...formData, departmentId: deptId })}
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
                      checked={formData.isActive === true}
                      onChange={() => setFormData({ ...formData, isActive: true })}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-slate-700 font-medium">Đang giảng dạy (Active)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={formData.isActive === false}
                      onChange={() => setFormData({ ...formData, isActive: false })}
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
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Chi Tiết Học Phần Đào Tạo</h3>
                  <p className="text-[11px] text-slate-400 font-mono font-semibold text-indigo-600">
                    {viewingSubject.code}
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
                <p className="text-base font-bold text-slate-900">{viewingSubject.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Số tín chỉ
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                    {viewingSubject.credits || 3} Tín chỉ
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Định mức giờ chuẩn
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {(Number(viewingSubject.credits) || 3) * 15} tiết chuẩn
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Khoa / Bộ môn phụ trách
                </span>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span>{getDepartmentName(viewingSubject.departmentId)}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Trạng thái
                </span>
                {viewingSubject.isActive ? (
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
                  {viewingSubject.description || 'Không có mô tả chi tiết cho môn học này.'}
                </p>
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
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Xác Nhận Xóa Môn Học</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bạn có chắc chắn muốn xóa học phần{' '}
                  <b className="text-slate-800 dark:text-slate-200 font-mono">{deletingSubject.code}</b> -{' '}
                  <b className="text-slate-800 dark:text-slate-200">{deletingSubject.name}</b> khỏi hệ thống?
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
