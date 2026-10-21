import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, Wallet, CreditCard, Banknote, History, Download,
  CheckCircle2, AlertCircle, Clock, ArrowUpRight, ArrowDownRight,
  Loader2, User, BookOpen, Calendar, ChevronDown, ChevronUp,
  Trash2,
  Edit2
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Tuition() {
  const { user: currentUser, hasRole } = useAuth();
  const isInvestor = hasRole('investor') || hasRole('shareholder');
  const [tuitions, setTuitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modal States
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedTuition, setSelectedTuition] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [historyCache, setHistoryCache] = useState<Record<string, any[]>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);

  const [isEditTransactionOpen, setIsEditTransactionOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Form Thu phí State
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'Bank Transfer',
    note: ''
  });

  // 1. Load danh sách công nợ học phí
  const fetchTuitions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tuitions');
      if (res.data.success) {
        setTuitions(res.data.data);
      }
    } catch (error) {
      toast.error("Lỗi khi tải danh sách công nợ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTuitions();
  }, [fetchTuitions]);

  // 2. Lấy lịch sử giao dịch của 1 hồ sơ học phí cụ thể
  const fetchHistory = async (tuitionId: string) => {
    try {
      const res = await apiClient.get(`/transactions?tuition=${tuitionId}`);
      if (res.data.success) {
        setPaymentHistory(res.data.data);
      }
    } catch (error) {
      toast.error("Không thể tải lịch sử giao dịch");
    }
  };

  // 3. Xử lý Thu phí (API Collect)
  const handleCollectFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentForm.amount <= 0) return toast.error("Số tiền thu phải lớn hơn 0");

    try {
      const res = await apiClient.post(`/tuitions/${selectedTuition._id}/collect`, {
        amount: paymentForm.amount,
        method: paymentForm.method,
        note: paymentForm.note,
        staff: currentUser?._id // Người thực hiện thu tiền
      });

      if (res.data.success) {
        toast.success("Đã ghi nhận phiếu thu và cập nhật công nợ!");
        setIsPaymentModalOpen(false);
        setPaymentForm({ amount: 0, method: 'Bank Transfer', note: '' });
        
        // Refresh history cache if expanded
        if (expandedRowId === selectedTuition._id) {
            const histRes = await apiClient.get(`/transactions?tuition=${selectedTuition._id}`);
            if (histRes.data.success) {
                setHistoryCache(prev => ({ ...prev, [selectedTuition._id]: histRes.data.data }));
            }
        }
        
        fetchTuitions(); // Reload lại danh sách nợ
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi khi thực hiện giao dịch");
    }
  };

  const toggleExpandRow = async (tuitionId: string) => {
    if (expandedRowId === tuitionId) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(tuitionId);
    
    // Fetch history if not cached
    if (!historyCache[tuitionId]) {
      setLoadingHistoryId(tuitionId);
      try {
        const res = await apiClient.get(`/transactions?tuition=${tuitionId}`);
        if (res.data.success) {
          setHistoryCache(prev => ({ ...prev, [tuitionId]: res.data.data }));
        }
      } catch (e) {
        toast.error("Không thể tải chi tiết đóng học phí");
      } finally {
        setLoadingHistoryId(null);
      }
    }
  };

  // --- Logic Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filteredData = useMemo(() => {
    return tuitions.filter(item => {
      const matchesSearch = item.student?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.course?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tuitions, searchTerm, statusFilter]);

  // Tính toán thống kê từ dữ liệu thực tế
  const stats = useMemo(() => {
    const totalCollected = tuitions.reduce((sum, t) => sum + (t.paidAmount || 0), 0);
    const totalDebt = tuitions.reduce((sum, t) => sum + (t.debtAmount || 0), 0);
    const overdueCount = tuitions.filter(t => t.status !== 'Paid' && t.dueDate && new Date(t.dueDate) < new Date()).length;
    return { totalCollected, totalDebt, overdueCount };
  }, [tuitions]);


  // 1. Thêm hàm xử lý xóa
  const handleDeleteTuition = async (id: string, name: string) => {
    if (!window.confirm(`CẢNH BÁO: Bạn đang xóa hồ sơ học phí của [${name}].\nHành động này sẽ XÓA TẤT CẢ phiếu thu (giao dịch) liên quan đến hồ sơ này. Bạn có chắc chắn không?`)) {
      return;
    }

    const toastId = toast.loading("Đang xóa dữ liệu tài chính...");
    try {
      const res = await apiClient.delete(`/tuitions/${id}`);
      if (res.data.success) {
        toast.success("Đã xóa sạch hồ sơ và các giao dịch!", { id: toastId });
        fetchTuitions(); // Tải lại danh sách
      }
    } catch (error: any) {
      toast.error("Lỗi khi xóa dữ liệu", { id: toastId });
    }
  };




  // 4. Xử lý Cập nhật Giao dịch (Sửa lỗi nhập nhầm)
  // const handleUpdateTransaction = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   const toastId = toast.loading("Đang cập nhật hạch toán...");
  //   try {
  //     const res = await apiClient.put(`/tuitions/transactions/${editingTransaction._id}`, {
  //       amount: Number(editingTransaction.amount),
  //       method: editingTransaction.paymentMethod,
  //       note: editingTransaction.note
  //     });

  //     if (res.data.success) {
  //       toast.success("Đã sửa phiếu thu và cập nhật lại công nợ!", { id: toastId });
  //       setIsEditTransactionOpen(false);
  //       // Quan trọng: Tải lại cả lịch sử và danh sách tổng
  //       fetchHistory(selectedTuition._id);
  //       fetchTuitions();
  //     }
  //   } catch (error) {
  //     toast.error("Lỗi khi cập nhật giao dịch", { id: toastId });
  //   }
  // };


  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    console.group("📝 [DEBUG] CẬP NHẬT PHIẾU THU");

    // 1. Kiểm tra dữ liệu trong state trước khi gửi
    console.log("1. ID giao dịch:", editingTransaction?._id);
    console.log("2. Dữ liệu gốc trong state:", editingTransaction);

    const payload = {
      amount: Number(editingTransaction.amount),
      method: editingTransaction.paymentMethod,
      note: editingTransaction.note
    };

    console.log("3. Payload gửi lên (đã ép kiểu):", payload);

    const toastId = toast.loading("Đang cập nhật hạch toán...");

    try {
      const url = `/tuitions/transactions/${editingTransaction._id}`;
      console.log("4. Gọi API PUT:", url);

      // THỰC THI GỌI API
      const res = await apiClient.put(url, payload);

      console.log("5. Kết quả trả về thành công:", res.data);

      if (res.data.success) {
        toast.success("Đã sửa phiếu thu thành công!", { id: toastId });
        setIsEditTransactionOpen(false);
        fetchHistory(selectedTuition._id);
        fetchTuitions();
      }
    } catch (error: any) {
      // 6. LOG CHI TIẾT LỖI
      console.error("❌ LỖI GIAO DỊCH TÀI CHÍNH:");

      if (error.response) {
        // Lỗi trả về từ Server (Backend)
        console.error("Mã lỗi HTTP:", error.response.status);
        console.error("Dữ liệu lỗi từ Backend:", error.response.data);

        // Nếu lỗi 404 là sai Route, lỗi 500 là sập logic Backend
        if (error.response.status === 404) {
          console.warn("⚠️ Gợi ý: Hãy kiểm tra lại Route ở Backend xem đã có '/transactions/:transactionId' chưa.");
        }
      } else {
        // Lỗi kết nối hoặc lỗi code Frontend
        console.error("Thông tin lỗi:", error.message);
      }

      toast.error(error.response?.data?.message || "Lỗi khi cập nhật giao dịch", { id: toastId });
    } finally {
      console.groupEnd();
    }
  };

  // 5. Xử lý Xóa Giao dịch
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa phiếu thu này? Công nợ học viên sẽ tăng lên tương ứng.")) return;
    try {
      const res = await apiClient.delete(`/tuitions/transactions/${transactionId}`);
      if (res.data.success) {
        toast.success("Đã xóa phiếu thu");
        fetchHistory(selectedTuition._id);
        fetchTuitions();
      }
    } catch (error) { toast.error("Lỗi khi xóa"); }
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tài chính & Học phí</h1>
          <p className="text-slate-500 text-sm">Hệ thống quản lý công nợ và phiếu thu học viên tự động.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
          <Download className="w-4 h-4" /> Xuất báo cáo
        </button>
      </header>

      {/* Stats Cards - Dynamic Data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-600 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">Tổng tiền đã thu</p>
            <h2 className="text-2xl font-black">{formatCurrency(stats.totalCollected)}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-2 py-0.5 rounded-lg">
              <ArrowUpRight className="w-3 h-3" /> <span>Dòng tiền vào</span>
            </div>
          </div>
          <Wallet className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
        </div>

        <div className="bg-rose-600 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-rose-100 text-[10px] font-black uppercase tracking-widest mb-1">Tổng nợ còn lại</p>
            <h2 className="text-2xl font-black">{formatCurrency(stats.totalDebt)}</h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-white/20 w-fit px-2 py-0.5 rounded-lg">
              <AlertCircle className="w-3 h-3" /> <span>Cần truy thu</span>
            </div>
          </div>
          <ArrowDownRight className="absolute -right-4 -bottom-4 w-24 h-24 text-white/10" />
        </div>

        <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Công nợ quá hạn</p>
            <h2 className="text-2xl font-black">{stats.overdueCount} <span className="text-sm font-normal text-slate-400 uppercase">Học viên</span></h2>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-rose-500/40 w-fit px-2 py-0.5 rounded-lg text-rose-100">
              <Clock className="w-3 h-3" /> <span>Ưu tiên xử lý</span>
            </div>
          </div>
          <History className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xs shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm học viên, khóa học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-2xl font-bold text-slate-600 text-sm outline-none"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="Paid">Đã đóng đủ</option>
            <option value="Partially Paid">Đóng một phần</option>
            <option value="Unpaid">Chưa đóng</option>
          </select>
        </div>
      </div>

      {/* Tuition Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-6 py-5">Học viên & Khóa học</th>
                <th className="px-6 py-5">Chi tiết học phí</th>
                <th className="px-6 py-5">Thanh toán</th>
                <th className="px-6 py-5 text-center">Trạng thái</th>
                <th className="px-6 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-500" /></td></tr>
              ) : filteredData.map((t) => (
                <React.Fragment key={t._id}>
                <tr className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => toggleExpandRow(t._id)}>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                            {expandedRowId === t._id ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />}
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 text-sm">{t.student?.fullName}</div>
                            <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter mt-0.5">{t.course?.name}</div>
                            {(t.enrollment?.note || t.note) && (
                                <div className="text-[10px] text-slate-400 mt-1 italic flex items-center gap-1 max-w-[200px] truncate" title={t.enrollment?.note || t.note}>
                                    • {t.enrollment?.note || t.note}
                                </div>
                            )}
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                       <div className="font-black text-indigo-600 text-[15px]">{formatCurrency(t.totalAmount)}</div>
                       {(t.enrollment?.discount || 0) > 0 && (
                         <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-tighter">
                           <span className="line-through text-slate-400">{formatCurrency(t.enrollment?.tuitionFee || t.course?.price || t.totalAmount)}</span>
                           <span className="text-rose-500">- {formatCurrency(t.enrollment?.discount)}</span>
                         </div>
                       )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 min-w-[140px]">
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">Đã thu:</span>
                         <span className="font-bold text-emerald-600">{formatCurrency(t.paidAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">Còn nợ:</span>
                         <span className="font-bold text-amber-600">{formatCurrency(t.debtAmount)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden flex">
                         <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${t.totalAmount > 0 ? (t.paidAmount / t.totalAmount) * 100 : 0}%`}}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${t.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                      t.status === 'Partially Paid' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-rose-100 text-rose-700 border-rose-200'
                      }`}>
                      {t.status === 'Paid' ? 'Hoàn thành' : t.status === 'Partially Paid' ? 'Còn nợ' : 'Chưa đóng'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* NÚT XÓA MỚI */}
                      {/* <button
                        onClick={() => handleDeleteTuition(t._id, t.student?.fullName)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm border border-slate-100"
                        title="Xóa hồ sơ nợ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button> */}

                      {!isInvestor && (
                        <>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {/* NÚT EDIT */}
                            {/* <button
                              onClick={() => { setEditingTransaction(t); setIsEditTransactionOpen(true); }}
                              className="p-2 text-blue-500 hover:bg-white rounded-lg shadow-sm"
                              title="Sửa phiếu thu"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button> */}

                            {/* NÚT DELETE */}
                            <button
                              onClick={() => handleDeleteTuition(t._id, t.student?.fullName)}
                              className="p-2 text-rose-500 hover:bg-white rounded-lg shadow-sm"
                              title="Xóa hồ sơ học phí"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedTuition(t);
                              setPaymentForm({ ...paymentForm, amount: t.debtAmount });
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all"
                          >
                            Thu phí
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* EXPANDED CONTENT - TRANSACTION HISTORY */}
                {expandedRowId === t._id && (
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <td colSpan={5} className="p-0">
                      <div className="p-6 bg-slate-100/50 shadow-inner">
                        <div className="flex items-center gap-2 mb-4">
                           <History className="w-4 h-4 text-indigo-500" />
                           <h4 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Chi tiết đóng học phí</h4>
                        </div>
                        
                        {loadingHistoryId === t._id ? (
                           <div className="py-8 text-center"><Loader2 className="animate-spin w-6 h-6 text-indigo-500 mx-auto" /></div>
                        ) : historyCache[t._id]?.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             {historyCache[t._id].map((tr, index) => (
                                <div key={tr._id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-lg font-black text-emerald-600">{formatCurrency(tr.amount)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mt-1">
                                                <Calendar className="w-3 h-3" /> {new Date(tr.paymentDate).toLocaleDateString('vi-VN')}
                                            </p>
                                        </div>
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                                            {tr.paymentMethod}
                                        </span>
                                    </div>
                                    {tr.note && <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 mt-3">"{tr.note}"</p>}
                                </div>
                             ))}
                           </div>
                        ) : (
                           <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                               <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Chưa có lịch sử nộp tiền</p>
                           </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL SỬA GIAO DỊCH (EDIT TRANSACTION) --- */}
      <Modal isOpen={isEditTransactionOpen} onClose={() => setIsEditTransactionOpen(false)} title="Chỉnh sửa phiếu thu">
        <form onSubmit={handleUpdateTransaction} className="space-y-6">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700 italic">Lưu ý: Sau khi bạn thay đổi số tiền này, hệ thống sẽ tự động tính toán lại số tiền nợ (Debt) của học viên.</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tiền mới (VND)</label>
              <input type="number" className="w-full px-6 py-4 bg-slate-50 border-2 border-indigo-500 rounded-2xl text-2xl font-black text-indigo-600 outline-none" value={editingTransaction?.amount || 0} onChange={e => setEditingTransaction({ ...editingTransaction, amount: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú sửa đổi</label>
              <textarea rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" value={editingTransaction?.note || ''} onChange={e => setEditingTransaction({ ...editingTransaction, note: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsEditTransactionOpen(false)} className="flex-1 py-4 bg-slate-100 font-bold rounded-2xl">Hủy</button>
            <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl uppercase tracking-widest">Cập nhật hạch toán</button>
          </div>
        </form>
      </Modal>

      {/* Modal Thu phí (API Collect) */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Lập phiếu thu học phí"
      >
        <form onSubmit={handleCollectFee} className="space-y-6">
          <div className="p-5 bg-slate-900 rounded-[2rem] text-white">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Số tiền học viên đang nợ</p>
            <p className="text-3xl font-black text-emerald-400">{formatCurrency(selectedTuition?.debtAmount || 0)}</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><User className="w-4 h-4 text-indigo-400" /></div>
              <p className="text-sm font-bold">{selectedTuition?.student?.fullName}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tiền thực thu (VND)</label>
              <input
                type="number"
                required
                className="w-full px-6 py-4 bg-slate-50 border-2 border-emerald-500 rounded-2xl text-2xl font-black text-emerald-600 outline-none focus:ring-4 focus:ring-emerald-500/10"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Phương thức thanh toán</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'Cash', icon: Banknote, label: 'Tiền mặt' },
                  { id: 'Bank Transfer', icon: CreditCard, label: 'Chuyển khoản' },
                  { id: 'E-Wallet', icon: Wallet, label: 'Ví điện tử' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, method: m.id })}
                    className={`flex flex-col items-center gap-2 p-3 border-2 rounded-2xl transition-all ${paymentForm.method === m.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400'
                      }`}
                  >
                    <m.icon className="w-5 h-5" />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú phiếu thu</label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="VD: Nộp học phí đợt 1..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl">Hủy</button>
            <button type="submit" className="flex-[2] py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-600 uppercase tracking-widest">Xác nhận nộp tiền</button>
          </div>
        </form>
      </Modal>

      {/* Modal Lịch sử giao dịch */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Nhật ký thu tiền: ${selectedTuition?.student?.fullName}`}
      >
        <div className="space-y-6">
          <div className="p-5 bg-indigo-50 rounded-xs border border-indigo-100 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Khóa học</p>
              <p className="text-sm font-bold text-indigo-900">{selectedTuition?.course?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Đã nộp</p>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(selectedTuition?.paidAmount || 0)}</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {paymentHistory.map((tr, index) => (
              <div key={tr._id} className="relative pl-8 pb-6 last:pb-0">
                {index !== paymentHistory.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100"></div>
                )}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-emerald-100 border-4 border-white flex items-center justify-center z-10 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm group hover:border-emerald-200 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(tr.amount)}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(tr.paymentDate).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest">
                      {tr.paymentMethod}
                    </span>
                  </div>
                  {tr.note && <p className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">"{tr.note}"</p>}
                </div>
              </div>
            ))}

            {!loading && paymentHistory.length === 0 && (
              <div className="py-12 text-center bg-slate-50 rounded-xs border-2 border-dashed border-slate-100">
                <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Chưa có dữ liệu giao dịch</p>
              </div>
            )}
          </div>

          <button onClick={() => setIsHistoryModalOpen(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest shadow-xl">Đóng nhật ký</button>
        </div>
      </Modal>
    </div>
  );
}