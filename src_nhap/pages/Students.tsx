import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import {
  Search,
  Filter,
  GraduationCap,
  MoreHorizontal,
  Mail,
  Phone,
  Plus,
  Loader2,
  Calendar,
  MapPin,
  User,
  Trash2,
  Edit2,
  BookOpen,
  Award,
  LayoutGrid,
  List,
  ShieldCheck,
  UserPlus,
  X,
  Tag,
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { StudentForm } from '../components/forms/StudentForm';
import { UserForm } from '../components/forms/UserForm';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { exportStudentsToExcel, exportStudentsToCSV } from '../utils/studentExport';

const generateEmail = (name: string) => {
  if (!name) return '';
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, '') + '@deepcode.vn';
};

// Mapping trạng thái học viên
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  trial: { label: 'Học thử', color: 'bg-blue-100 text-blue-700' },
  studying: { label: 'Đang học', color: 'bg-emerald-100 text-emerald-700' },
  pause: { label: 'Bảo lưu', color: 'bg-amber-100 text-amber-700' },
  graduated: { label: 'Tốt nghiệp', color: 'bg-purple-100 text-purple-700' },
  withdrawn: { label: 'Thôi học', color: 'bg-rose-100 text-rose-700' },
};

export default function Students() {
  const { user: currentUser, hasRole } = useAuthStore();
  const isParent = hasRole('parent');
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [selectedForUser, setSelectedForUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [parentModalOpen, setParentModalOpen] = useState(false);
  const [selectedStudentForParent, setSelectedStudentForParent] = useState<any>(null);
  const [parentUsers, setParentUsers] = useState<any[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [assigningParent, setAssigningParent] = useState(false);

  const [testAccountModalOpen, setTestAccountModalOpen] = useState(false);
  const [selectedStudentForTestAcc, setSelectedStudentForTestAcc] = useState<any>(null);
  const [testAccForm, setTestAccForm] = useState({ email: '', password: '', fullName: '' });
  const [creatingTestAcc, setCreatingTestAcc] = useState(false);

  // Trạng thái xuất file cho Sale
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>('all');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [exporting, setExporting] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient.get('/roles');
      if (res.data.success) setRoles(res.data.data);
    } catch (error) { console.error("Lỗi tải vai trò:", error); }
  }, []);

  // Tải danh sách khóa học để làm bộ lọc và tag
  const fetchCourses = useCallback(async () => {
    try {
      const res = await apiClient.get('/courses');
      if (res.data.success) {
        setCourses(Array.isArray(res.data.data) ? res.data.data : []);
      }
    } catch (error) {
      console.error("Lỗi tải danh sách khóa học:", error);
    }
  }, []);

  // 1. Lấy danh sách học viên
  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedCourse !== 'all') params.append('courseId', selectedCourse);

      const res = await apiClient.get(`/students?${params.toString()}`);
      if (res.data.success) {
        setStudents(res.data.data || []);
      }
    } catch (error: any) {
      toast.error("Không thể tải danh sách học viên");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCourse]);

  const fetchParentUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/students/parents/list');
      if (res.data.success) setParentUsers(res.data.data);
    } catch (err) { console.error('Lỗi tải phụ huynh:', err); }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchRoles();
    fetchParentUsers();
    fetchCourses();
  }, [fetchStudents, fetchRoles, fetchParentUsers, fetchCourses]);

  // Đếm số lượng học viên theo từng khóa học
  const courseStudentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(st => {
      if (st.courses && Array.isArray(st.courses)) {
        st.courses.forEach((c: any) => {
          const id = String(c._id);
          counts[id] = (counts[id] || 0) + 1;
        });
      }
    });
    return counts;
  }, [students]);

  // Bộ lọc học viên (theo từ khóa, khóa học và trạng thái)
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Lọc theo khóa học
      if (selectedCourse !== 'all') {
        const hasCourse = student.courses?.some(
          (c: any) => String(c._id) === selectedCourse || c.name === selectedCourse || c.courseCode === selectedCourse
        );
        if (!hasCourse) return false;
      }
      // 2. Lọc theo trạng thái
      if (selectedStatusFilter !== 'all' && student.status !== selectedStatusFilter) {
        return false;
      }
      // 3. Lọc theo từ khóa tìm kiếm
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = student.fullName?.toLowerCase().includes(q);
        const matchCode = student.studentCode?.toLowerCase().includes(q);
        const matchPhone = student.phone?.toLowerCase().includes(q);
        const matchEmail = student.email?.toLowerCase().includes(q);
        const matchCourse = student.courses?.some(
          (c: any) => c.name?.toLowerCase().includes(q) || c.courseCode?.toLowerCase().includes(q)
        );
        if (!matchName && !matchCode && !matchPhone && !matchEmail && !matchCourse) {
          return false;
        }
      }
      return true;
    });
  }, [students, selectedCourse, selectedStatusFilter, searchTerm]);

  // 2. Thêm hoặc cập nhật học viên
  const handleSaveStudent = async (data: any) => {
    try {
      const isEdit = !!editingStudent;
      const res = isEdit
        ? await apiClient.put(`/students/${editingStudent._id}`, data)
        : await apiClient.post('/students', data);

      if (res.data.success) {
        toast.success(isEdit ? "Cập nhật thành công" : "Thêm học viên thành công");
        setIsModalOpen(false);
        setEditingStudent(null);
        fetchStudents();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Thao tác thất bại");
    }
  };

  // 3. Xóa học viên
  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa hồ sơ học viên này?")) return;
    try {
      const res = await apiClient.delete(`/students/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa học viên");
        fetchStudents();
      }
    } catch (error) {
      toast.error("Lỗi khi xóa dữ liệu");
    }
  };

  const handleAssignParent = async (parentId: string | null) => {
    if (!selectedStudentForParent) return;
    try {
      setAssigningParent(true);
      await apiClient.patch(`/students/${selectedStudentForParent._id}/assign-parent`, { parentAccountId: parentId });
      toast.success(parentId ? 'Đã gán phụ huynh thành công!' : 'Đã gỡ liên kết phụ huynh');
      setParentModalOpen(false);
      setSelectedStudentForParent(null);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gán phụ huynh thất bại');
    } finally {
      setAssigningParent(false);
    }
  };

  const handleDownload = async () => {
    try {
      setExporting(true);
      let targetList: any[] = [];
      if (exportScope === 'filtered') {
        targetList = filteredStudents;
      } else {
        // Tải toàn bộ danh sách học viên không phân trang từ server
        const res = await apiClient.get('/students?limit=all');
        if (res.data?.success && Array.isArray(res.data.data)) {
          targetList = res.data.data;
        } else {
          targetList = students;
        }
      }

      if (!targetList || targetList.length === 0) {
        toast.error('Không có dữ liệu học viên để xuất');
        return;
      }

      if (exportFormat === 'xlsx') {
        exportStudentsToExcel(targetList, 'Danh_Sach_Hoc_Vien_Sale');
        toast.success(`Đã xuất thành công file Excel (${targetList.length} học viên)!`);
      } else {
        exportStudentsToCSV(targetList, 'Danh_Sach_Hoc_Vien_Sale');
        toast.success(`Đã xuất thành công file CSV (${targetList.length} học viên)!`);
      }
      setIsExportModalOpen(false);
    } catch (err: any) {
      console.error('Lỗi xuất dữ liệu học viên:', err);
      toast.error('Có lỗi xảy ra khi tải dữ liệu học viên');
    } finally {
      setExporting(false);
    }
  };

  const handleCreateTestAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingTestAcc(true);
      const payload = {
        email: testAccForm.email,
        password: testAccForm.password,
        fullName: testAccForm.fullName,
        name: testAccForm.fullName
      };
      const res = await fetch('https://test.deepcode.vn/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Tạo tài khoản Test thành công");
        try {
          await apiClient.put(`/students/${selectedStudentForTestAcc._id}`, { email: testAccForm.email });
          fetchStudents();
        } catch (e) {
          console.error("Lỗi đồng bộ email học viên", e);
        }
        setTestAccountModalOpen(false);
      } else {
        toast.error(data.message || "Tạo tài khoản thất bại");
      }
    } catch (err: any) {
      toast.error("Lỗi khi kết nối đến server Test");
    } finally {
      setCreatingTestAcc(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Quản lý Học viên</h1>
          <p className="text-slate-500">Quản lý hồ sơ chi tiết, quá trình học tập và thông tin phụ huynh.</p>
        </div>
        {!isParent && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-white text-slate-700 font-bold px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer"
              title="Tải full thông tin học viên + phụ huynh và liên hệ cho Sale"
            >
              <Download className="w-5 h-5 text-emerald-600" />
              <span>Tải dữ liệu Sale</span>
            </button>
            <button
              onClick={() => { setEditingStudent(null); setIsModalOpen(true); }}
              className="flex items-center justify-center gap-2 bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Thêm học viên
            </button>
          </div>
        )}
      </header>

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên học viên, mã HV, điện thoại, email, tên khóa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Lọc theo khóa học dropdown */}
          <div className="min-w-[220px]">
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">Tất cả khóa học ({students.length})</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.code ? `(${c.code})` : ''} - ({courseStudentCounts[c._id] || 0} HV)
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo trạng thái */}
          <div className="min-w-[160px]">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(STATUS_MAP).map(([statusKey, cfg]) => (
                <option key={statusKey} value={statusKey}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-end md:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'grid' ? "bg-white shadow-xs text-emerald-600" : "text-slate-400 hover:text-slate-600"
              )}
              title="Chế độ lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white shadow-xs text-emerald-600" : "text-slate-400 hover:text-slate-600"
              )}
              title="Chế độ danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Course Filter Tag Bar */}
        <div className="bg-white px-4 py-3 rounded-xl shadow-xs border border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 shrink-0 mr-1">
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
            <span>Lọc nhanh khóa học:</span>
          </div>

          <button
            onClick={() => setSelectedCourse('all')}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
              selectedCourse === 'all'
                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            Tất cả ({students.length})
          </button>

          {courses.map((course) => {
            const isSelected = selectedCourse === course._id;
            const count = courseStudentCounts[course._id] || 0;
            return (
              <button
                key={course._id}
                onClick={() => setSelectedCourse(isSelected ? 'all' : course._id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-200"
                    : "bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border-indigo-200/80"
                )}
                title={`${course.name} (${count} học viên)`}
              >
                <BookOpen className="w-3 h-3 opacity-80" />
                <span className="truncate max-w-[160px]">{course.name}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  isSelected ? "bg-white/25 text-white" : "bg-white text-indigo-600 border border-indigo-200"
                )}>
                  {count}
                </span>
              </button>
            );
          })}

          {(selectedCourse !== 'all' || selectedStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCourse('all');
                setSelectedStatusFilter('all');
                setSearchTerm('');
              }}
              className="shrink-0 ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu học viên...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 mb-1">Không tìm thấy học viên nào</h3>
          <p className="text-sm text-slate-400 mb-4">
            Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn bộ lọc khóa học.
          </p>
          {(selectedCourse !== 'all' || selectedStatusFilter !== 'all' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCourse('all');
                setSelectedStatusFilter('all');
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
            >
              <X className="w-3.5 h-3.5" />
              Xóa tất cả bộ lọc
            </button>
          )}
        </div>
      ) : (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <div key={student._id} className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col justify-between">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white font-bold text-xl mr-4 shadow-lg shadow-emerald-200 shrink-0">
                        {student.avatar ? <img src={student.avatar} alt="avatar" className="w-full h-full object-cover rounded-2xl" /> : student.fullName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight group-hover:text-emerald-600 transition-colors">
                          {student.fullName}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                          ID: {student.studentCode || 'Chưa cấp mã'}
                        </p>
                      </div>
                    </div>
                    {!isParent && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingStudent(student); setIsModalOpen(true); }}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Sửa hồ sơ"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student._id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Xóa hồ sơ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter border ${STATUS_MAP[student.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_MAP[student.status]?.label || student.status}
                      </span>
                    </div>

                    <div className="space-y-2 pt-2">
                      <div className="flex items-center text-sm text-slate-700 gap-2">
                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                        <a href={`tel:${student.phone}`} className="font-semibold hover:text-emerald-600 transition-colors">
                          {student.phone || 'Chưa có SĐT'}
                        </a>
                      </div>
                      <div className="flex items-center text-sm text-slate-600 gap-2">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="truncate">{student.email || 'Chưa có email'}</span>
                      </div>
                      <div className="flex items-center text-xs text-slate-500 gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Nhập học: {new Date(student.enrollmentDate).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>

                    {/* Khung thông tin phụ huynh cho Sale */}
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-violet-500" />
                          PH: {student.parentName || student.parentAccountId?.fullName || 'Chưa cập nhật'}
                        </span>
                        {student.parentRelationship && (
                          <span className="text-[10px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                            {student.parentRelationship === 'Father' ? 'Bố' : student.parentRelationship === 'Mother' ? 'Mẹ' : student.parentRelationship === 'Guardian' ? 'Giám hộ' : student.parentRelationship}
                          </span>
                        )}
                      </div>
                      {(student.parentPhone || student.parentAccountId?.phone) && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <a href={`tel:${student.parentPhone || student.parentAccountId?.phone}`} className="font-semibold text-emerald-600 hover:underline">
                            {student.parentPhone || student.parentAccountId?.phone}
                          </a>
                        </div>
                      )}
                      {student.parentAccountId ? (
                        <div className="text-[10px] text-violet-700 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Đã liên kết Portal Phụ huynh</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">
                          Chưa liên kết Portal
                        </div>
                      )}
                    </div>

                    {/* Tag Buttons: Khóa học tham gia */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Khóa học tham gia ({student.courses?.length || 0}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {student.courses && student.courses.length > 0 ? (
                          student.courses.map((c: any) => {
                            const isSelected = selectedCourse === c._id;
                            return (
                              <button
                                key={c._id || c.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCourse(isSelected ? 'all' : c._id);
                                }}
                                title={`Lọc học viên theo khóa: ${c.name}${c.courseCode ? ` (${c.courseCode})` : ''}`}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                                  isSelected
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-200"
                                    : "bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:border-indigo-300"
                                )}
                              >
                                <span className="truncate max-w-[150px]">{c.name}</span>
                                {c.courseCode && (
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.2 rounded font-bold uppercase",
                                    isSelected ? "bg-indigo-500 text-white" : "bg-white text-indigo-600 border border-indigo-200"
                                  )}>
                                    {c.courseCode}
                                  </span>
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa đăng ký khóa học nào</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-col gap-2 border-t border-slate-100">
                  <div className="flex justify-between gap-3">
                    <a href={`mailto:${student.email}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:shadow-xs transition-all"><Mail className="w-3.5 h-3.5 text-blue-500" /></a>
                    <a href={`tel:${student.phone}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:shadow-xs transition-all"><Phone className="w-3.5 h-3.5 text-emerald-500" /></a>
                  </div>
                  {!isParent && (
                    <>
                      <button
                        onClick={() => {
                          setSelectedForUser({ fullName: student.fullName, email: student.email, department: 'student', role: roles.find(r => r.name.toLowerCase() === 'student')?._id, _studentId: student._id });
                          setIsUserModalOpen(true);
                        }}
                        className="w-full py-2.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Kích hoạt tài khoản học viên
                      </button>
                      <button
                        onClick={() => { setSelectedStudentForParent(student); setParentModalOpen(true); }}
                        className="w-full py-2.5 bg-violet-50 text-violet-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-violet-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        {student.parentAccountId ? 'Thay đổi Phụ huynh' : 'Gán Phụ huynh'}
                      </button>
                      <button
                        onClick={() => { 
                          setSelectedStudentForTestAcc(student);
                          const suggestedEmail = (student.email && student.email.includes('@deepcode.vn')) ? student.email : generateEmail(student.fullName || '');
                          setTestAccForm({ email: suggestedEmail, fullName: student.fullName || '', password: '123456' });
                          setTestAccountModalOpen(true);
                        }}
                        className="w-full py-2.5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Tạo tài khoản Test
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-12">STT</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Học viên</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Khóa học tham gia</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Phụ huynh</th>
                    {!isParent && <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map((student, index) => (
                    <tr key={student._id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-4 text-center text-xs font-bold text-slate-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                            {student.avatar ? (
                              <img src={student.avatar} alt="avatar" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              student.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5">
                              {student.fullName}
                              {student.studentCode && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                  {student.studentCode}
                                </span>
                              )}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs">
                              {student.phone && (
                                <a href={`tel:${student.phone}`} className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {student.phone}
                                </a>
                              )}
                              {student.email && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[150px]">
                                  {student.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                          {student.courses && student.courses.length > 0 ? (
                            student.courses.map((c: any) => {
                              const isSelected = selectedCourse === c._id;
                              return (
                                <button
                                  key={c._id || c.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCourse(isSelected ? 'all' : c._id);
                                  }}
                                  title={`Lọc theo khóa: ${c.name}${c.courseCode ? ` (${c.courseCode})` : ''}`}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer",
                                    isSelected
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                      : "bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 border-indigo-200 hover:border-indigo-300"
                                  )}
                                >
                                  <BookOpen className="w-3 h-3 opacity-70 shrink-0" />
                                  <span className="truncate max-w-[140px]">{c.name}</span>
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">Chưa đăng ký</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-tighter border ${STATUS_MAP[student.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_MAP[student.status]?.label || student.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const pName = student.parentName || student.parentAccountId?.fullName;
                          const pPhone = student.parentPhone || student.parentAccountId?.phone;
                          const relationship = student.parentRelationship;
                          if (!pName && !pPhone && !student.parentAccountId) {
                            return <span className="text-xs text-slate-400 italic">Chưa cập nhật</span>;
                          }
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900">{pName || 'Phụ huynh'}</span>
                                {relationship && (
                                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium">
                                    {relationship === 'Father' ? 'Bố' : relationship === 'Mother' ? 'Mẹ' : relationship === 'Guardian' ? 'Giám hộ' : relationship}
                                  </span>
                                )}
                              </div>
                              {pPhone && (
                                <a href={`tel:${pPhone}`} className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {pPhone}
                                </a>
                              )}
                              {student.parentAccountId ? (
                                <span className="inline-block text-[10px] font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100">
                                  ✓ Portal: {student.parentAccountId.email || 'Đã liên kết'}
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] text-slate-400">Chưa liên kết portal</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {!isParent && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex gap-1 justify-end items-center">
                            <button
                              onClick={() => {
                                setSelectedStudentForTestAcc(student);
                                const suggestedEmail = (student.email && student.email.includes('@deepcode.vn')) ? student.email : generateEmail(student.fullName || '');
                                setTestAccForm({ email: suggestedEmail, fullName: student.fullName || '', password: '123456' });
                                setTestAccountModalOpen(true);
                              }}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Tạo tài khoản Test"
                            >
                              <BookOpen className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setSelectedStudentForParent(student); setParentModalOpen(true); }}
                              className="p-2 text-violet-600 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer"
                              title="Gán phụ huynh"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedForUser({ fullName: student.fullName, email: student.email, department: 'student', role: roles.find(r => r.name.toLowerCase() === 'student')?._id, _studentId: student._id });
                                setIsUserModalOpen(true);
                              }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Kích hoạt tài khoản"
                            >
                              <ShieldCheck className="w-5 h-5" />
                            </button>
                            <button onClick={() => { setEditingStudent(student); setIsModalOpen(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg cursor-pointer" title="Sửa"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(student._id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingStudent(null); }} title={editingStudent ? "Cập nhật hồ sơ học viên" : "Thêm hồ sơ học viên mới"}>
        <StudentForm initialData={editingStudent} onSubmit={handleSaveStudent} onCancel={() => { setIsModalOpen(false); setEditingStudent(null); }} />
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Kích hoạt tài khoản học viên">
        <UserForm
          initialData={selectedForUser}
          roles={roles}
          onSuccess={async (payload) => {
            if (selectedForUser?._studentId && payload?.email && !selectedForUser.email) {
              try {
                await apiClient.put(`/students/${selectedForUser._studentId}`, { email: payload.email });
              } catch (e) {
                console.error("Lỗi khi đồng bộ email về Student", e);
              }
            }
            setIsUserModalOpen(false);
            toast.success("Đã kích hoạt tài khoản hệ thống cho học viên");
            fetchStudents();
            setTimeout(() => window.location.reload(), 1000);
          }}
          onCancel={() => setIsUserModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={parentModalOpen} onClose={() => { setParentModalOpen(false); setSelectedStudentForParent(null); setParentSearch(''); }} title={`Gán Phụ huynh → ${selectedStudentForParent?.fullName || ''}`}>
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Chọn tài khoản phụ huynh để liên kết với học viên này.</p>
          <input
            type="text"
            placeholder="Tìm phụ huynh theo tên, email..."
            value={parentSearch}
            onChange={e => setParentSearch(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 text-sm"
          />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {parentUsers.filter(p =>
              p.fullName?.toLowerCase().includes(parentSearch.toLowerCase()) ||
              p.email?.toLowerCase().includes(parentSearch.toLowerCase())
            ).map(parent => (
              <button
                key={parent._id}
                onClick={() => handleAssignParent(parent._id)}
                disabled={assigningParent}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm shrink-0">
                  {parent.fullName?.charAt(0) || 'P'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{parent.fullName}</p>
                  <p className="text-xs text-slate-400 truncate">{parent.email}</p>
                </div>
                {(selectedStudentForParent?.parentAccountId?._id || selectedStudentForParent?.parentAccountId) === parent._id && (
                  <span className="text-[10px] font-black text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full shrink-0">Đang gán</span>
                )}
              </button>
            ))}
            {parentUsers.length === 0 && (
              <p className="text-center py-8 text-slate-400 text-sm">Chưa có tài khoản phụ huynh nào. Hãy tạo tài khoản với role = parent trước.</p>
            )}
          </div>
          {(selectedStudentForParent?.parentAccountId?._id || selectedStudentForParent?.parentAccountId) && (
            <button
              onClick={() => handleAssignParent(null)}
              disabled={assigningParent}
              className="w-full py-2.5 border border-rose-200 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-all"
            >
              Gỡ liên kết phụ huynh hiện tại
            </button>
          )}
        </div>
      </Modal>

      <Modal isOpen={testAccountModalOpen} onClose={() => setTestAccountModalOpen(false)} title="Tạo tài khoản trang Test">
        <form onSubmit={handleCreateTestAccount} className="space-y-4">
          <p className="text-sm text-slate-500">
            Tạo nhanh tài khoản cho học viên <strong className="text-slate-800">{selectedStudentForTestAcc?.fullName}</strong> trên hệ thống Test (test.deepcode.vn).
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên</label>
            <input required type="text" value={testAccForm.fullName} onChange={e => setTestAccForm({...testAccForm, fullName: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
            <input required type="email" value={testAccForm.email} onChange={e => setTestAccForm({...testAccForm, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu (mặc định)</label>
            <input required type="text" minLength={6} value={testAccForm.password} onChange={e => setTestAccForm({...testAccForm, password: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" />
          </div>
          <div className="pt-2">
            <button disabled={creatingTestAcc} type="submit" className="w-full py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex justify-center items-center gap-2">
              {creatingTestAcc ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
              Tạo tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Tải full thông tin học viên + phụ huynh cho Sale */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Tải Dữ Liệu Học Viên & Phụ Huynh (Dành cho Sale)"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Xuất toàn bộ thông tin học viên, thông tin phụ huynh và các đầu mối liên hệ để đội ngũ Tư vấn / Sale nắm bắt và chăm sóc khách hàng.
          </p>

          {/* 1. Chọn phạm vi xuất dữ liệu */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Chọn phạm vi dữ liệu
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all cursor-pointer relative",
                  exportScope === 'all'
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800">Toàn bộ học viên</span>
                  {exportScope === 'all' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500">Tải toàn bộ cơ sở dữ liệu học viên (không giới hạn phân trang)</p>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('filtered')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all cursor-pointer relative",
                  exportScope === 'filtered'
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-slate-800">Theo bộ lọc hiện tại</span>
                  {exportScope === 'filtered' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500">
                  Chỉ tải {filteredStudents.length} học viên theo từ khóa/khóa học đang lọc
                </p>
              </button>
            </div>
          </div>

          {/* 2. Chọn định dạng file */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              2. Chọn định dạng tệp tải về
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('xlsx')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3",
                  exportFormat === 'xlsx'
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <FileSpreadsheet className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">Excel (.xlsx)</span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Khuyên dùng</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Định dạng bảng tính chuẩn, tự căn chỉnh cột, bảo toàn số 0 đầu của SĐT và CCCD.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={cn(
                  "p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3",
                  exportFormat === 'csv'
                    ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <FileText className="w-7 h-7 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">CSV (.csv)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Chuẩn UTF-8 BOM tiếng Việt, mở trực tiếp bằng Excel hoặc Google Sheets.</p>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Tóm tắt các trường thông tin trong tệp xuất */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-2">
            <span className="font-bold text-slate-700 block">Danh mục 29 trường thông tin được tổng hợp trong file:</span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-600">
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <strong className="text-emerald-700 block mb-1">👤 Hồ sơ Học viên</strong>
                <p className="leading-relaxed text-[11px]">Mã HV, Họ tên, Giới tính, Ngày sinh, SĐT, Email, CCCD, Địa chỉ, Trạng thái, Ngày nhập học, Danh sách khóa học, Lớp, Trường học, Chuyên ngành, Điểm test...</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <strong className="text-violet-700 block mb-1">👨‍👩‍👧 Phụ huynh & Liên hệ</strong>
                <p className="leading-relaxed text-[11px]">Họ tên Phụ huynh, Mối quan hệ, Số điện thoại Phụ huynh, Email Phụ huynh, Trạng thái liên kết tài khoản Portal Phụ huynh...</p>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-slate-100">
                <strong className="text-indigo-700 block mb-1">💼 Bán hàng & CSKH</strong>
                <p className="leading-relaxed text-[11px]">Khách hàng tiềm năng (Lead nguồn), Số điện thoại Lead, Nhân viên CSKH/Sale phụ trách, Người giới thiệu, Ghi chú đặc điểm, Ngày tạo hồ sơ...</p>
              </div>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={exporting}
              onClick={() => setIsExportModalOpen(false)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 text-sm transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 text-sm disabled:opacity-50 cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tổng hợp dữ liệu...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Tải xuống ngay ({exportScope === 'filtered' ? filteredStudents.length : 'Toàn bộ'} HV)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {!loading && students.length === 0 && (
        <div className="text-center py-20 bg-white rounded-xs border border-dashed border-slate-200">
          <GraduationCap className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Không tìm thấy học viên nào</h3>
        </div>
      )}
    </div>
  );
}
