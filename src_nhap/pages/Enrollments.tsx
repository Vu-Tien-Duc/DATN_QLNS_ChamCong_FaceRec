import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Calendar,
  BookOpen,
  Search,
  MoreHorizontal,
  Edit2,
  Trash2,
  Filter
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { EnrollmentForm } from '../components/forms/EnrollmentForm';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

export default function Enrollments() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Load toàn bộ dữ liệu cần thiết
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [resEnrol, resStud, resCour, resClas] = await Promise.all([
        apiClient.get('/enrollments'),
        apiClient.get('/students'),
        apiClient.get('/courses'),
        apiClient.get('/classes')
      ]);

      if (resEnrol.data.success) setEnrollments(resEnrol.data.data);
      if (resStud.data.success) setStudents(resStud.data.data);
      if (resCour.data.success) setCourses(resCour.data.data);
      if (resClas.data.success) setClasses(resClas.data.data);

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error);
      toast.error("Không thể tải danh sách dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // // 2. Xử lý Lưu (Thêm/Sửa)
  // const handleSaveEnrollment = async (formData: any) => {
  //   console.group("🚀 Process: Save Enrollment");
  //   const isEdit = !!editingEnrollment;

  //   try {
  //     const url = isEdit ? `/enrollments/${editingEnrollment._id}` : '/enrollments';
  //     const method = isEdit ? 'put' : 'post';

  //     const res = await apiClient[method](url, formData);

  //     if (res.data.success) {
  //       toast.success(isEdit ? "Cập nhật thành công!" : "Ghi danh mới thành công!");
  //       setIsModalOpen(false);
  //       setEditingEnrollment(null);
  //       loadData();
  //     }
  //   } catch (error: any) {
  //     console.error("❌ Lỗi API:", error.response?.data || error.message);
  //     toast.error(error.response?.data?.message || "Thao tác thất bại");
  //   } finally {
  //     console.groupEnd();
  //   }
  // };

  const handleSaveEnrollment = async (formData: any) => {
    console.group("🚀 [DEBUG] handleSaveEnrollment");

    // 1. Kiểm tra trạng thái chỉnh sửa
    const isEdit = !!editingEnrollment;
    console.log("1. Chế độ:", isEdit ? "EDIT (Cập nhật)" : "CREATE (Thêm mới)");
    console.log("2. Biến editingEnrollment hiện tại:", editingEnrollment);
    console.log("3. Dữ liệu từ Form gửi lên:", formData);

    // CHỐT CHẶN: Kiểm tra nếu là Edit mà không có _id thì sẽ bị crash màn hình
    if (isEdit && (!editingEnrollment || !editingEnrollment._id)) {
      console.error("❌ LỖI NGHIÊM TRỌNG: Đang ở chế độ Edit nhưng không tìm thấy _id!");
      console.groupEnd();
      toast.error("Không tìm thấy ID bản ghi để cập nhật!");
      return; // Dừng lại ngay để không bị trắng màn hình
    }

    try {
      const url = isEdit ? `/enrollments/${editingEnrollment._id}` : '/enrollments';
      const method = isEdit ? 'put' : 'post';

      console.log(`4. Thực thi API: ${method.toUpperCase()} ${url}`);

      // 2. Gọi API
      const res = await apiClient[method](url, formData);

      // 3. Log kết quả trả về
      console.log("5. Phản hồi đầy đủ từ Axios (res):", res);
      console.log("6. Dữ liệu thực tế từ Server (res.data):", res.data);

      if (res.data && res.data.success) {
        console.log("✅ Xử lý thành công!");
        toast.success(isEdit ? "Cập nhật thành công!" : "Ghi danh mới thành công!");
        setIsModalOpen(false);
        setEditingEnrollment(null);
        console.log("7. Đang tải lại danh sách (loadData)...");
        loadData();
      } else {
        console.warn("⚠️ Server trả về thành công giả (success: false):", res.data?.message);
        toast.error(res.data?.message || "Server từ chối yêu cầu");
      }
    } catch (error: any) {
      // 4. Log lỗi chi tiết
      console.error("❌ LỖI GỌI API:");
      if (error.response) {
        // Lỗi từ server trả về (4xx, 5xx)
        console.error("Status:", error.response.status);
        console.error("Data lỗi từ Backend:", error.response.data);
      } else if (error.request) {
        // Lỗi không nhận được phản hồi
        console.error("Không nhận được phản hồi từ Server (Network Error)");
      } else {
        // Lỗi logic trong code xử lý
        console.error("Lỗi cấu hình code:", error.message);
      }
      toast.error(error.response?.data?.message || "Thao tác thất bại");
    } finally {
      console.groupEnd();
    }
  };

  // 3. Xử lý Xóa
  const handleDeleteEnrollment = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đơn ghi danh này? Thao tác này không thể hoàn tác.")) return;

    try {
      const res = await apiClient.delete(`/enrollments/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa đơn ghi danh");
        loadData();
      }
    } catch (error: any) {
      toast.error("Không thể xóa đơn ghi danh này");
    }
  };

  // 4. Logic tìm kiếm local
  const filteredEnrollments = useMemo(() => {
    return enrollments.filter(item =>
      item.student?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.course?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [enrollments, searchTerm]);

  // UI Helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Dropped': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'Reserved': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Quản lý Ghi danh</h1>
          <p className="text-slate-500 text-sm">Theo dõi hợp đồng, tiến độ đóng phí và trạng thái học tập.</p>
        </div>
        <button
          onClick={() => { setEditingEnrollment(null); setIsModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <Plus className="w-5 h-5" />
          Ghi danh mới
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng ghi danh</p>
            <p className="text-2xl font-black text-slate-900">{enrollments.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang học tập</p>
            <p className="text-2xl font-black text-slate-900">{enrollments.filter(e => e.status === 'Active').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã hoàn thành</p>
            <p className="text-2xl font-black text-slate-900">{enrollments.filter(e => e.status === 'Completed').length}</p>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">Danh sách ghi danh</h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm tên học viên hoặc khóa học..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Học viên</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Khóa học & Lớp</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Học phí thực thu</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Trạng thái</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" /></td></tr>
              ) : filteredEnrollments.map((item) => (
                <tr key={item._id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                        {item.student?.fullName?.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{item.student?.fullName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-indigo-500" /> {item.course?.name}
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                        Lớp: {item.class?.name || 'Chưa xếp lớp'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-slate-900">
                      {(item.finalFee ?? 0).toLocaleString('vi-VN')}
                      <span className="text-[10px] font-normal text-slate-400">VNĐ</span>
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border shadow-sm ${getStatusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => { setEditingEnrollment(item); setIsModalOpen(true); }}
                        className="p-2 text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-slate-100"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEnrollment(item._id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl shadow-sm border border-rose-100"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredEnrollments.length === 0 && (
          <div className="py-20 text-center">
            <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-400 font-medium italic">Không tìm thấy dữ liệu ghi danh nào phù hợp.</p>
          </div>
        )}
      </div>

      {/* Modal - Enrollment Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEnrollment(null); }}
        title={editingEnrollment ? "Cập nhật hồ sơ ghi danh" : "Tạo phiếu ghi danh học viên"}
      >
        <EnrollmentForm
          courses={courses}
          classes={classes}
          initialData={editingEnrollment}
          onSubmit={handleSaveEnrollment}
          onCancel={() => { setIsModalOpen(false); setEditingEnrollment(null); }}
        />
      </Modal>
    </div>
  );
}