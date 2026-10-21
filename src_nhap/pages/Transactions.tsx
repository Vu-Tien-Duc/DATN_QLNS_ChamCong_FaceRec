


// import React, { useState, useEffect, useCallback, useMemo } from 'react';
// import {
//   Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Download,
//   Calendar, MoreVertical, Banknote, CreditCard, Wallet, FileText,
//   Trash2, Loader2, Tag, User, Landmark, AlertCircle,
//   MoreHorizontal, X
// } from 'lucide-react';
// import { apiClient } from '../api/apiClient';
// import { Modal } from '../components/Modal';
// import { toast } from 'react-hot-toast';
// import { useAuth } from '../context/AuthContext';

// export default function Transactions() {
//   const { user } = useAuth();
//   const [transactions, setTransactions] = useState<any[]>([]);
//   const [stats, setStats] = useState({ income: 0, expense: 0 });
//   const [loading, setLoading] = useState(true);
//   const [isModalOpen, setIsModalOpen] = useState(false);

//   // Filter states
//   const [typeFilter, setTypeFilter] = useState('ALL');
//   const [searchTerm, setSearchTerm] = useState('');
//   const [startDate, setStartDate] = useState('');
//   const [endDate, setEndDate] = useState('');

//   // Form state cho phiếu mới
//   const [formData, setFormData] = useState({
//     type: 'INCOME',
//     category: 'Other',
//     amount: '',
//     paymentMethod: 'Bank Transfer',
//     note: '',
//     paymentDate: new Date().toISOString().split('T')[0],
//     partnerName: ''
//   });

//   // 1. Load danh sách giao dịch (có lọc theo ngày) và thống kê từ API
//   const fetchData = useCallback(async () => {
//     try {
//       setLoading(true);
      
//       // Chuẩn bị query params cho việc lọc ngày
//       const params: any = {};
//       if (startDate) params.startDate = startDate;
//       if (endDate) params.endDate = endDate;

//       const [resList, resStats] = await Promise.all([
//         apiClient.get('/transactions', { params }),
//         apiClient.get('/transactions/stats')
//       ]);

//       if (resList.data.success) {
//         setTransactions(resList.data.data);
//       }

//       if (resStats.data.success) {
//         const income = resStats.data.data.find((s: any) => s._id === 'INCOME')?.total || 0;
//         const expense = resStats.data.data.find((s: any) => s._id === 'EXPENSE')?.total || 0;
//         setStats({ income, expense });
//       }
//     } catch (error) {
//       toast.error("Không thể tải dữ liệu tài chính");
//     } finally {
//       setLoading(false);
//     }
//   }, [startDate, endDate]);

//   useEffect(() => { 
//     fetchData(); 
//   }, [fetchData]);

//   // Xóa bộ lọc ngày về mặc định
//   const handleClearDateFilter = () => {
//     setStartDate('');
//     setEndDate('');
//   };

//   // 2. Xử lý tạo phiếu mới
//   const handleCreateTransaction = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       const payload = {
//         ...formData,
//         amount: Number(formData.amount),
//         partner: formData.partnerName ? { name: formData.partnerName } : undefined
//       };

//       const res = await apiClient.post('/transactions', payload);
//       if (res.data.success) {
//         toast.success(`Đã tạo phiếu ${formData.type === 'INCOME' ? 'thu' : 'chi'} thành công`);
//         setIsModalOpen(false);
//         setFormData({ ...formData, amount: '', note: '', partnerName: '' });
//         fetchData();
//       }
//     } catch (error: any) {
//       toast.error(error.response?.data?.message || "Lỗi tạo phiếu");
//     }
//   };

//   // 3. Logic lọc dữ liệu phía client (cho Loại phiếu và Tìm kiếm text)
//   const filteredTransactions = useMemo(() => {
//     return transactions.filter(tr => {
//       const matchesType = typeFilter === 'ALL' || tr.type === typeFilter;
//       const matchesSearch = tr.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//         tr.transactionCode?.toLowerCase().includes(searchTerm.toLowerCase());
//       return matchesType && matchesSearch;
//     });
//   }, [transactions, typeFilter, searchTerm]);

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
//   };

//   return (
//     <div className="space-y-6">
//       <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
//         <div>
//           <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sổ Quỹ Tiền Mặt</h1>
//           <p className="text-slate-500 text-sm">Nhật ký thu chi và quản lý dòng tiền hệ thống.</p>
//         </div>
//         <div className="flex gap-2">
//           <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all">
//             <Download className="w-4 h-4" /> Xuất báo cáo
//           </button>
//           <button
//             onClick={() => setIsModalOpen(true)}
//             className="flex items-center gap-2 bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
//           >
//             <Plus className="w-5 h-5" /> Tạo phiếu mới
//           </button>
//         </div>
//       </header>

//       {/* Stats Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
//           <div className="relative z-10">
//             <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Tổng thu (Hệ thống)</p>
//             <h2 className="text-4xl font-black">{formatCurrency(stats.income)}</h2>
//             <div className="mt-4 flex items-center gap-2">
//               <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
//                 <ArrowUpRight className="w-3 h-3" /> Thu nhập
//               </span>
//             </div>
//           </div>
//           <Banknote className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" />
//         </div>

//         <div className="bg-rose-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
//           <div className="relative z-10">
//             <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Tổng chi (Hệ thống)</p>
//             <h2 className="text-4xl font-black">{formatCurrency(stats.expense)}</h2>
//             <div className="mt-4 flex items-center gap-2">
//               <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
//                 <ArrowDownRight className="w-3 h-3" /> Chi phí
//               </span>
//             </div>
//           </div>
//           <FileText className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" />
//         </div>
//       </div>

//       {/* Filter Bar */}
//       <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4">
//         {/* Lọc theo loại phiếu */}
//         <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
//           <button onClick={() => setTypeFilter('ALL')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Tất cả</button>
//           <button onClick={() => setTypeFilter('INCOME')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Phiếu thu</button>
//           <button onClick={() => setTypeFilter('EXPENSE')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Phiếu chi</button>
//         </div>

//         {/* Ô tìm kiếm */}
//         <div className="relative flex-1">
//           <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//           <input
//             type="text"
//             placeholder="Tìm kiếm mã phiếu, nội dung..."
//             className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
//             value={searchTerm}
//             onChange={(e) => setSearchTerm(e.target.value)}
//           />
//         </div>

//         {/* Bộ lọc khoảng ngày */}
//         <div className="flex flex-wrap items-center gap-2 shrink-0">
//           <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl">
//             <span className="text-[10px] font-bold text-slate-400 uppercase">Từ</span>
//             <input
//               type="date"
//               className="bg-transparent border-none outline-none text-xs font-bold text-slate-600"
//               value={startDate}
//               onChange={(e) => setStartDate(e.target.value)}
//             />
//           </div>
//           <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl">
//             <span className="text-[10px] font-bold text-slate-400 uppercase">Đến</span>
//             <input
//               type="date"
//               className="bg-transparent border-none outline-none text-xs font-bold text-slate-600"
//               value={endDate}
//               onChange={(e) => setEndDate(e.target.value)}
//             />
//           </div>
//           {(startDate || endDate) && (
//             <button
//               onClick={handleClearDateFilter}
//               className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1.5 bg-rose-50 rounded-xl transition-all"
//             >
//               <X className="w-3.5 h-3.5" /> Xóa lọc ngày
//             </button>
//           )}
//         </div>
//       </div>

//       {/* Table Section */}
//       <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="w-full text-left">
//             <thead>
//               <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
//                 <th className="px-6 py-5">Ngày & Mã</th>
//                 <th className="px-6 py-5">Loại / Hạng mục</th>
//                 <th className="px-6 py-5">Nội dung / Đối tác</th>
//                 <th className="px-6 py-5">Số tiền</th>
//                 <th className="px-6 py-5">Phương thức</th>
//                 <th className="px-6 py-5">Người lập</th>
//                 <th className="px-6 py-5 text-right">Thao tác</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y divide-slate-50">
//               {loading ? (
//                 <tr>
//                   <td colSpan={7} className="py-20 text-center">
//                     <Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" />
//                   </td>
//                 </tr>
//               ) : filteredTransactions.length === 0 ? (
//                 <tr>
//                   <td colSpan={7} className="py-20 text-center text-slate-400 font-bold text-sm">
//                     Không tìm thấy giao dịch nào phù hợp.
//                   </td>
//                 </tr>
//               ) : (
//                 filteredTransactions.map((tr) => (
//                   <tr key={tr._id} className="hover:bg-slate-50/50 transition-colors group">
//                     <td className="px-6 py-4">
//                       <div className="text-sm font-black text-slate-700">{new Date(tr.paymentDate).toLocaleDateString('vi-VN')}</div>
//                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{tr.transactionCode}</div>
//                     </td>
//                     <td className="px-6 py-4">
//                       <div className={`text-[9px] font-black px-2 py-0.5 rounded-md w-fit mb-1 uppercase ${tr.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
//                         {tr.type === 'INCOME' ? 'Thu' : 'Chi'}
//                       </div>
//                       <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
//                         <Tag className="w-3 h-3" /> {tr.category}
//                       </div>
//                     </td>
//                     <td className="px-6 py-4">
//                       <p className="text-sm font-medium text-slate-600 line-clamp-1">{tr.note}</p>
//                       <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
//                         {tr.student?.fullName || tr.partner?.name || '---'}
//                       </p>
//                     </td>
//                     <td className="px-6 py-4 font-black">
//                       <span className={tr.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}>
//                         {tr.type === 'INCOME' ? '+' : '-'}{formatCurrency(tr.amount)}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4">
//                       <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded-lg">
//                         {tr.paymentMethod}
//                       </span>
//                     </td>
//                     {/* Hiển thị Tên người lập từ backend populate('staff') */}
//                     <td className="px-6 py-4">
//                       <span className="text-xs font-semibold text-slate-600">
//                         {tr.staff?.fullName || 'Hệ thống'}
//                       </span>
//                     </td>
//                     <td className="px-6 py-4 text-right">
//                       <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all">
//                         <MoreHorizontal className="w-5 h-5" />
//                       </button>
//                     </td>
//                   </tr>
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* Modal Tạo Phiếu Mới */}
//       <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lập phiếu thu / chi mới">
//         <form onSubmit={handleCreateTransaction} className="space-y-5">
//           <div className="flex bg-slate-100 p-1.5 rounded-2xl">
//             <button type="button" onClick={() => setFormData({ ...formData, type: 'INCOME' })} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${formData.type === 'INCOME' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400'}`}>PHIẾU THU (+)</button>
//             <button type="button" onClick={() => setFormData({ ...formData, type: 'EXPENSE' })} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${formData.type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400'}`}>PHIẾU CHI (-)</button>
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//             <div className="space-y-1">
//               <label className="text-xs font-black text-slate-500 uppercase ml-1">Hạng mục</label>
//               <select
//                 className="form-input-custom w-full"
//                 value={formData.category}
//                 onChange={e => setFormData({ ...formData, category: e.target.value })}
//               >
//                 {/* THU */}
//                 <option value="Tuition">Học phí</option>
//                 <option value="OtherIncome">Thu khác</option>

//                 {/* CHI TIÊU */}
//                 <option value="Salary">Chi lương</option>
//                 <option value="Office Rent">Chi tiền mặt bằng</option>
//                 <option value="Marketing">Chi quảng cáo</option>
//                 <option value="Utilities">Điện / Nước / Thuê nhà</option>
//                 <option value="Equipment">Thiết bị</option>
//                 <option value="Refund">Hoàn phí cho học viên</option>
//                 <option value="Other">Khác</option>
//               </select>
//             </div>
//             <div className="space-y-1">
//               <label className="text-xs font-black text-slate-500 uppercase ml-1">Ngày hạch toán</label>
//               <input type="date" className="form-input-custom w-full" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} />
//             </div>
//           </div>

//           <div className="space-y-1">
//             <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tiền giao dịch</label>
//             <div className="relative">
//               <input type="number" required placeholder="0" className="w-full px-6 py-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl text-2xl font-black text-indigo-600 outline-none focus:border-indigo-500" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
//               <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">VND</span>
//             </div>
//           </div>

//           <div className="space-y-1">
//             <label className="text-xs font-black text-slate-500 uppercase ml-1">Đối tác / Tên người nộp (nhận)</label>
//             <div className="relative">
//               <input className="form-input-custom w-full pl-10" placeholder="VD: Công ty Điện lực, Nguyễn Văn A..." value={formData.partnerName} onChange={e => setFormData({ ...formData, partnerName: e.target.value })} />
//               <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
//             </div>
//           </div>

//           <div className="space-y-1">
//             <label className="text-xs font-black text-slate-500 uppercase ml-1">Phương thức</label>
//             <select className="form-input-custom w-full" value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}>
//               <option value="Bank Transfer">Chuyển khoản</option>
//               <option value="Cash">Tiền mặt</option>
//               <option value="E-Wallet">Ví điện tử</option>
//             </select>
//           </div>

//           <div className="space-y-1">
//             <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú chi tiết</label>
//             <textarea rows={2} className="form-input-custom w-full" placeholder="Nội dung diễn giải giao dịch..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
//           </div>

//           <div className="flex gap-3 pt-4">
//             <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold">Hủy bỏ</button>
//             <button type="submit" className={`flex-[2] py-4 rounded-2xl text-white font-black shadow-xl transition-all ${formData.type === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'}`}>
//               {formData.type === 'INCOME' ? 'XÁC NHẬN THU TIỀN' : 'XÁC NHẬN CHI TIỀN'}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </div>
//   );
// }

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, ArrowUpRight, ArrowDownRight, Download,
  Calendar, MoreVertical, Banknote, CreditCard, Wallet, FileText,
  Trash2, Loader2, Tag, User, Landmark, AlertCircle,
  MoreHorizontal, X, Edit2
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Transactions() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({ income: 0, expense: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Bank accounts (company)
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ name: '', bankName: '', accountNumber: '' });
  // Edit transaction (admin)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);

  // Filter states
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form state cho phiếu mới
  const [formData, setFormData] = useState({
    type: 'INCOME',
    category: 'Other',
    amount: '',
    paymentMethod: 'Bank Transfer',
    // fundKind: 'Cash' | 'Bank', bankAccountId when Bank
    fundKind: 'Cash',
    bankAccountId: '',
    note: '',
    paymentDate: new Date().toISOString().split('T')[0],
    partnerName: ''
  });

  // 1. Load danh sách giao dịch (có lọc theo ngày) và thống kê từ API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const [resList, resStats] = await Promise.all([
        apiClient.get('/transactions', { params }),
        apiClient.get('/transactions/stats')
      ]);

      if (resList.data.success) {
        setTransactions(resList.data.data);
      }

      if (resStats.data.success) {
        const income = resStats.data.data.find((s: any) => s._id === 'INCOME')?.total || 0;
        const expense = resStats.data.data.find((s: any) => s._id === 'EXPENSE')?.total || 0;
        setStats({ income, expense });
      }
    } catch (error) {
      toast.error("Không thể tải dữ liệu tài chính");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { 
    fetchData(); 
    // load bank accounts for selection
    (async () => {
      try {
        const res = await apiClient.get('/bank-accounts');
        if (res.data.success) setBankAccounts(res.data.data || []);
      } catch (err) {
        // ignore
      }
    })();
  }, [fetchData]);

  // Xóa bộ lọc ngày về mặc định
  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // 2. Xử lý tạo phiếu mới
  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...formData,
        amount: Number(formData.amount),
        partner: formData.partnerName ? { name: formData.partnerName } : undefined
      };

      // attach fund info: for INCOME -> fundTo, for EXPENSE -> fundFrom
      const fund = {
        kind: formData.fundKind === 'Bank' ? 'BANK' : 'CASH',
        bankAccount: formData.bankAccountId || undefined
      };
      if (formData.type === 'INCOME') payload.fundTo = fund;
      else payload.fundFrom = fund;

      const res = await apiClient.post('/transactions', payload);
      if (res.data.success) {
        toast.success(`Đã tạo phiếu ${formData.type === 'INCOME' ? 'thu' : 'chi'} thành công`);
        setIsModalOpen(false);
        setFormData({ ...formData, amount: '', note: '', partnerName: '' });
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Lỗi tạo phiếu");
    }
  };

  // Mở modal edit (chỉ admin thấy nút)
  const openEditModal = (tr: any) => {
    setEditingTransaction({
      _id: tr._id,
      amount: tr.amount,
      note: tr.note || '',
      paymentMethod: tr.paymentMethod,
      category: tr.category,
      fundKind: tr.fundFrom?.kind === 'BANK' || tr.fundTo?.kind === 'BANK' ? 'Bank' : 'Cash',
      bankAccountId: tr.fundFrom?.bankAccount?._id || tr.fundTo?.bankAccount?._id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;
    try {
      const payload: any = {
        amount: Number(editingTransaction.amount),
        note: editingTransaction.note,
        paymentMethod: editingTransaction.paymentMethod,
        category: editingTransaction.category
      };
      const fund = { kind: editingTransaction.fundKind === 'Bank' ? 'BANK' : 'CASH', bankAccount: editingTransaction.bankAccountId || null };
      // Decide whether to set fundFrom or fundTo based on original transaction type
      const original = transactions.find(t => t._id === editingTransaction._id);
      if (original?.type === 'INCOME') payload.fundTo = fund;
      else payload.fundFrom = fund;

      const res = await apiClient.put(`/transactions/${editingTransaction._id}`, payload);
      if (res.data.success) {
        toast.success('Đã cập nhật giao dịch');
        setIsEditModalOpen(false);
        setEditingTransaction(null);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật giao dịch');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    try {
      const res = await apiClient.delete(`/transactions/${id}`);
      if (res.data.success) {
        toast.success('Đã xóa giao dịch');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi xóa giao dịch');
    }
  };

  // Tạo tài khoản ngân hàng công ty (Admin)
  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...bankForm };
      const res = await apiClient.post('/bank-accounts', payload);
      if (res.data.success) {
        toast.success('Đã tạo tài khoản ngân hàng');
        setIsBankModalOpen(false);
        setBankForm({ name: '', bankName: '', accountNumber: '' });
        // reload list
        const list = await apiClient.get('/bank-accounts');
        if (list.data.success) setBankAccounts(list.data.data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi tạo tài khoản');
    }
  };

  // 3. Logic lọc dữ liệu phía client (cho Loại phiếu và Tìm kiếm text)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tr => {
      const matchesType = typeFilter === 'ALL' || tr.type === typeFilter;
      const matchesSearch = tr.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tr.transactionCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [transactions, typeFilter, searchTerm]);

  // Tính toán Tổng thu & Tổng chi dựa theo kỳ lọc được chọn hiện tại
  const periodStats = useMemo(() => {
    return filteredTransactions.reduce((acc, tr) => {
      if (tr.type === 'INCOME') acc.income += tr.amount;
      if (tr.type === 'EXPENSE') acc.expense += tr.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const isInvestor = hasRole('investor') || hasRole('shareholder');

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sổ Quỹ Tiền Mặt</h1>
          <p className="text-slate-500 text-sm">Nhật ký thu chi và quản lý dòng tiền hệ thống.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" /> Xuất báo cáo
          </button>
          {!isInvestor && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" /> Tạo phiếu mới
            </button>
          )}
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Tổng thu (Hệ thống)</p>
            <h2 className="text-4xl font-black">{formatCurrency(stats.income)}</h2>
            <div className="mt-4 flex items-center gap-2">
              <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Thu nhập
              </span>
            </div>
          </div>
          <Banknote className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" />
        </div>

        <div className="bg-rose-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
          <div className="relative z-10">
            <p className="text-rose-100 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Tổng chi (Hệ thống)</p>
            <h2 className="text-4xl font-black">{formatCurrency(stats.expense)}</h2>
            <div className="mt-4 flex items-center gap-2">
              <span className="bg-white/20 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3" /> Chi phí
              </span>
            </div>
          </div>
          <FileText className="absolute -right-6 -bottom-6 w-40 h-40 text-white/10 group-hover:scale-110 transition-transform duration-500" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center">
        {/* Lọc theo loại phiếu */}
        <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
          <button onClick={() => setTypeFilter('ALL')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>Tất cả</button>
          <button onClick={() => setTypeFilter('INCOME')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Phiếu thu</button>
          <button onClick={() => setTypeFilter('EXPENSE')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase transition-all ${typeFilter === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Phiếu chi</button>
        </div>

        {/* Ô tìm kiếm */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm mã phiếu, nội dung..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Bộ lọc khoảng ngày & Phần thống kê theo kỳ lọc */}
        <div className="flex flex-col gap-2 shrink-0 w-full xl:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Từ</span>
              <input
                type="date"
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-600"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Đến</span>
              <input
                type="date"
                className="bg-transparent border-none outline-none text-xs font-bold text-slate-600"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={handleClearDateFilter}
                className="flex items-center gap-1 text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1.5 bg-rose-50 rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" /> Xóa lọc ngày
              </button>
            )}
          </div>

          {/* 2 hàng thông tin tổng thu và tổng chi khi filter theo ngày */}
          {(startDate || endDate) && (
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5 text-xs font-bold text-slate-500">
              <div className="flex justify-between items-center gap-6">
                <span>Tổng thu (kỳ lọc):</span>
                <span className="text-emerald-600 font-black">{formatCurrency(periodStats.income)}</span>
              </div>
              <div className="flex justify-between items-center gap-6 border-t border-slate-200/60 pt-1.5">
                <span>Tổng chi (kỳ lọc):</span>
                <span className="text-rose-600 font-black">{formatCurrency(periodStats.expense)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                <th className="px-6 py-5">Ngày & Mã</th>
                <th className="px-6 py-5">Loại / Hạng mục</th>
                <th className="px-6 py-5">Nội dung / Đối tác</th>
                <th className="px-6 py-5">Số tiền</th>
                <th className="px-6 py-5">Phương thức</th>
                <th className="px-6 py-5">Người lập</th>
                <th className="px-6 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-500 w-10 h-10" />
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold text-sm">
                    Không tìm thấy giao dịch nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tr) => (
                  <tr key={tr._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-slate-700">{new Date(tr.paymentDate).toLocaleDateString('vi-VN')}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{tr.transactionCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-[9px] font-black px-2 py-0.5 rounded-md w-fit mb-1 uppercase ${tr.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tr.type === 'INCOME' ? 'Thu' : 'Chi'}
                      </div>
                      <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {tr.category}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-600 line-clamp-1">{tr.note}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                        {tr.student?.fullName || tr.partner?.name || '---'}
                      </p>
                    </td>
                    <td className="px-6 py-4 font-black">
                      <span className={tr.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}>
                        {tr.type === 'INCOME' ? '+' : '-'}{formatCurrency(tr.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-500 border border-slate-200 px-2 py-1 rounded-lg">
                        {tr.paymentMethod}
                      </span>
                      {/* Hiển thị quỹ nguồn/đích */}
                      <div className="text-[10px] text-slate-400 mt-1">
                        {tr.fundFrom?.kind === 'BANK' && tr.fundFrom?.bankAccount ? (
                          <span>Chi từ: {tr.fundFrom.bankAccount.name || tr.fundFrom.bankAccount.accountNumber}</span>
                        ) : tr.fundFrom ? (
                          <span>Chi từ: Tiền mặt</span>
                        ) : null}

                        {tr.fundTo?.kind === 'BANK' && tr.fundTo?.bankAccount ? (
                          <div>Thu vào: {tr.fundTo.bankAccount.name || tr.fundTo.bankAccount.accountNumber}</div>
                        ) : tr.fundTo ? (
                          <div>Thu vào: Tiền mặt</div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-slate-600">
                        {tr.staff?.fullName || 'Hệ thống'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hasRole('admin') ? (
                          <>
                            <button onClick={() => openEditModal(tr)} className="p-2 text-blue-500 hover:bg-white rounded-lg shadow-sm" title="Sửa giao dịch"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteTransaction(tr._id)} className="p-2 text-rose-500 hover:bg-white rounded-lg shadow-sm" title="Xóa giao dịch"><Trash2 className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all">
                            <MoreHorizontal className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tạo Phiếu Mới */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Lập phiếu thu / chi mới">
        <form onSubmit={handleCreateTransaction} className="space-y-5">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button type="button" onClick={() => setFormData({ ...formData, type: 'INCOME' })} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${formData.type === 'INCOME' ? 'bg-white text-emerald-600 shadow-lg' : 'text-slate-400'}`}>PHIẾU THU (+)</button>
            <button type="button" onClick={() => setFormData({ ...formData, type: 'EXPENSE' })} className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${formData.type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-lg' : 'text-slate-400'}`}>PHIẾU CHI (-)</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Hạng mục</label>
              <select
                className="form-input-custom w-full"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {/* THU */}
                <option value="Tuition">Học phí</option>
                <option value="OtherIncome">Thu khác</option>

                {/* CHI TIÊU */}
                <option value="Salary">Chi lương</option>
                <option value="Office Rent">Chi tiền mặt bằng</option>
                <option value="Marketing">Chi quảng cáo</option>
                <option value="Utilities">Điện / Nước / Thuê nhà</option>
                <option value="Equipment">Thiết bị</option>
                <option value="Refund">Hoàn phí cho học viên</option>
                <option value="Other">Khác</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Ngày hạch toán</label>
              <input type="date" className="form-input-custom w-full" value={formData.paymentDate} onChange={e => setFormData({ ...formData, paymentDate: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tiền giao dịch</label>
            <div className="relative">
              <input type="number" required placeholder="0" className="w-full px-6 py-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl text-2xl font-black text-indigo-600 outline-none focus:border-indigo-500" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">VND</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Đối tác / Tên người nộp (nhận)</label>
            <div className="relative">
              <input className="form-input-custom w-full pl-10" placeholder="VD: Công ty Điện lực, Nguyễn Văn A..." value={formData.partnerName} onChange={e => setFormData({ ...formData, partnerName: e.target.value })} />
              <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Phương thức</label>
            <select className="form-input-custom w-full" value={formData.paymentMethod} onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}>
              <option value="Bank Transfer">Chuyển khoản</option>
              <option value="Cash">Tiền mặt</option>
              <option value="E-Wallet">Ví điện tử</option>
            </select>
          </div>

          {/* Fund selection: cho biết tiền vào quỹ nào / chi từ quỹ nào */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Quỹ</label>
              <select className="form-input-custom w-full" value={formData.fundKind} onChange={e => setFormData({ ...formData, fundKind: e.target.value })}>
                <option value="Cash">Tiền mặt</option>
                <option value="Bank">Tài khoản ngân hàng</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Tài khoản ngân hàng (nếu có)</label>
              <select className="form-input-custom w-full" value={formData.bankAccountId} onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}>
                <option value="">-- Chọn tài khoản --</option>
                {bankAccounts.map(b => (
                  <option key={b._id} value={b._id}>{b.name} — {b.bankName} ({b.accountNumber})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                navigate('/bank-accounts');
              }}
              className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline"
            >
              <Landmark className="w-3.5 h-3.5" /> Quản lý tài khoản ngân hàng
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú chi tiết</label>
            <textarea rows={2} className="form-input-custom w-full" placeholder="Nội dung diễn giải giao dịch..." value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold">Hủy bỏ</button>
            <button type="submit" className={`flex-[2] py-4 rounded-2xl text-white font-black shadow-xl transition-all ${formData.type === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'}`}>
              {formData.type === 'INCOME' ? 'XÁC NHẬN THU TIỀN' : 'XÁC NHẬN CHI TIỀN'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal quản lý / tạo tài khoản ngân hàng */}
      <Modal isOpen={isBankModalOpen} onClose={() => setIsBankModalOpen(false)} title="Tài khoản ngân hàng công ty">
        <div className="space-y-4">
          <form onSubmit={handleCreateBankAccount} className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Tên hiển thị</label>
              <input className="form-input-custom w-full" value={bankForm.name} onChange={e => setBankForm({ ...bankForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Ngân hàng</label>
              <input className="form-input-custom w-full" value={bankForm.bankName} onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tài khoản</label>
              <input className="form-input-custom w-full" value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsBankModalOpen(false)} className="flex-1 py-3 bg-slate-100 rounded-2xl font-bold">Hủy</button>
              <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white rounded-2xl font-black">Tạo tài khoản</button>
            </div>
          </form>

          <div className="pt-4">
            <h4 className="text-sm font-black">Danh sách tài khoản</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {bankAccounts.map(b => (
                <li key={b._id} className="border p-3 rounded-lg">
                  <div className="font-bold">{b.name}</div>
                  <div className="text-xs">{b.bankName} — {b.accountNumber}</div>
                </li>
              ))}
              {bankAccounts.length === 0 && <li className="text-slate-400">Chưa có tài khoản</li>}
            </ul>
          </div>
        </div>
      </Modal>

      {/* Modal SỬA GIAO DỊCH (Admin) */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingTransaction(null); }} title="Chỉnh sửa giao dịch">
        <form onSubmit={handleUpdateTransaction} className="space-y-4">
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tiền (VND)</label>
            <input type="number" className="form-input-custom w-full" value={editingTransaction?.amount || ''} onChange={e => setEditingTransaction({ ...editingTransaction, amount: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Phương thức</label>
            <select className="form-input-custom w-full" value={editingTransaction?.paymentMethod || 'Bank Transfer'} onChange={e => setEditingTransaction({ ...editingTransaction, paymentMethod: e.target.value })}>
              <option value="Bank Transfer">Chuyển khoản</option>
              <option value="Cash">Tiền mặt</option>
              <option value="E-Wallet">Ví điện tử</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Quỹ</label>
            <select className="form-input-custom w-full" value={editingTransaction?.fundKind || 'Cash'} onChange={e => setEditingTransaction({ ...editingTransaction, fundKind: e.target.value })}>
              <option value="Cash">Tiền mặt</option>
              <option value="Bank">Tài khoản ngân hàng</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Tài khoản ngân hàng (nếu có)</label>
            <select className="form-input-custom w-full" value={editingTransaction?.bankAccountId || ''} onChange={e => setEditingTransaction({ ...editingTransaction, bankAccountId: e.target.value })}>
              <option value="">-- Chọn tài khoản --</option>
              {bankAccounts.map(b => (<option key={b._id} value={b._id}>{b.name} — {b.bankName} ({b.accountNumber})</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú</label>
            <textarea className="form-input-custom w-full" rows={2} value={editingTransaction?.note || ''} onChange={e => setEditingTransaction({ ...editingTransaction, note: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingTransaction(null); }} className="flex-1 py-3 bg-slate-100 rounded-2xl font-bold">Hủy</button>
            <button type="submit" className="flex-2 py-3 bg-indigo-600 text-white rounded-2xl font-black">Cập nhật</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}