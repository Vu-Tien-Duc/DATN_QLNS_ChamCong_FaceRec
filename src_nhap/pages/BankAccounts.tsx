import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Edit2, Trash2, Landmark, Loader2, X,
  AlertCircle, CheckCircle2, HelpCircle
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { Modal } from '../components/Modal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function BankAccounts() {
  const { hasRole } = useAuth();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    bankName: '',
    accountNumber: '',
    isActive: true,
    note: ''
  });

  const isAdmin = hasRole('admin');

  // Load bank accounts
  const fetchBankAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/bank-accounts');
      if (res.data.success) {
        setBankAccounts(res.data.data || []);
      }
    } catch (error) {
      toast.error('Không thể tải danh sách tài khoản ngân hàng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  // Handle open add modal
  const openAddModal = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      bankName: '',
      accountNumber: '',
      isActive: true,
      note: ''
    });
    setIsModalOpen(true);
  };

  // Handle open edit modal
  const openEditModal = (account: any) => {
    setEditingAccount(account);
    setFormData({
      name: account.name || '',
      bankName: account.bankName || '',
      accountNumber: account.accountNumber || '',
      isActive: account.isActive !== undefined ? account.isActive : true,
      note: account.note || ''
    });
    setIsModalOpen(true);
  };

  // Submit handler for both Add & Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Chỉ quản trị viên mới có quyền thực hiện thao tác này');
      return;
    }

    try {
      if (editingAccount) {
        // Edit flow
        const res = await apiClient.put(`/bank-accounts/${editingAccount._id}`, formData);
        if (res.data.success) {
          toast.success('Cập nhật tài khoản ngân hàng thành công');
          setIsModalOpen(false);
          fetchBankAccounts();
        }
      } else {
        // Add flow
        const res = await apiClient.post('/bank-accounts', formData);
        if (res.data.success) {
          toast.success('Thêm tài khoản ngân hàng mới thành công');
          setIsModalOpen(false);
          fetchBankAccounts();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu tài khoản');
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error('Chỉ quản trị viên mới có quyền thực hiện thao tác này');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản ngân hàng này?')) return;

    try {
      const res = await apiClient.delete(`/bank-accounts/${id}`);
      if (res.data.success) {
        toast.success('Xóa tài khoản ngân hàng thành công');
        fetchBankAccounts();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Lỗi khi xóa tài khoản');
    }
  };

  // Search filter
  const filteredAccounts = useMemo(() => {
    return bankAccounts.filter((account) => {
      const matchesSearch =
        account.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.accountNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.note?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [bankAccounts, searchTerm]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tài Khoản Ngân Hàng</h1>
          <p className="text-slate-500 text-sm">Quản lý danh sách các tài khoản ngân hàng giao dịch của công ty.</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg"
          >
            <Plus className="w-5 h-5" /> Thêm tài khoản mới
          </button>
        )}
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col xl:flex-row gap-4 items-start xl:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hiển thị, tên ngân hàng, số tài khoản..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-20 text-center shadow-sm">
          <Landmark className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold text-lg">Chưa có tài khoản ngân hàng nào phù hợp</p>
          <p className="text-slate-400 text-sm mt-1">Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc thêm mới tài khoản.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.map((account) => (
            <div
              key={account._id}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card top decorative line */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${account.isActive ? 'bg-indigo-500' : 'bg-slate-300'}`} />

              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {account.isActive ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                      </span>
                    ) : (
                      <span className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Tạm khóa
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-900 line-clamp-1">{account.name}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase mt-0.5">{account.bankName}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Số tài khoản</p>
                  <p className="text-xl font-black text-slate-800 font-mono tracking-wide mt-1">{account.accountNumber}</p>
                </div>

                {account.note && (
                  <p className="text-xs text-slate-500 line-clamp-2 italic bg-slate-50/50 p-3 rounded-xl">
                    "{account.note}"
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-50">
                  <button
                    onClick={() => openEditModal(account)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Chỉnh sửa
                  </button>
                  <button
                    onClick={() => handleDelete(account._id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs rounded-xl transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa bỏ
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccount ? 'Chỉnh sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng mới'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Tên hiển thị nội bộ</label>
            <input
              type="text"
              required
              placeholder="VD: TPBank VP Thu Phí, VCB Công Ty..."
              className="form-input-custom w-full mt-1"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Tên ngân hàng</label>
            <input
              type="text"
              required
              placeholder="VD: TPBank, Vietcombank..."
              className="form-input-custom w-full mt-1"
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Số tài khoản</label>
            <input
              type="text"
              required
              placeholder="VD: 0451000..."
              className="form-input-custom w-full mt-1"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Ghi chú (nếu có)</label>
            <textarea
              rows={2}
              placeholder="VD: Tài khoản nhận đóng học phí chi nhánh chính..."
              className="form-input-custom w-full mt-1"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            <input
              type="checkbox"
              id="isActiveCheckbox"
              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <label htmlFor="isActiveCheckbox" className="text-xs font-bold text-slate-600 select-none cursor-pointer">
              Tài khoản đang hoạt động (cho phép hiển thị & giao dịch)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 text-slate-500 font-bold text-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 shadow-lg"
            >
              {editingAccount ? 'Cập nhật tài khoản' : 'Kích hoạt tài khoản'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
