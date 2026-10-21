import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  CreditCard, 
  Wallet, 
  ShieldCheck, 
  User, 
  BookOpen, 
  AlertCircle,
  FileText
} from 'lucide-react';

interface InvoiceFormProps {
  invoice: any; // Đây là object createdEnrollment nhận từ Leads.tsx
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function InvoiceForm({ invoice, onSubmit, onCancel }: InvoiceFormProps) {
  // 1. TRÍCH XUẤT DỮ LIỆU AN TOÀN (Dùng ?? 0 để không bao giờ bị undefined)
  const totalAmount = invoice?.finalFee ?? invoice?.tuitionFee ?? 0;
  const alreadyPaid = invoice?.paidAmount ?? 0;
  const remainingDebt = totalAmount - alreadyPaid;

  // 2. STATE QUẢN LÝ FORM
  const [paymentAmount, setPaymentAmount] = useState<number>(remainingDebt);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'E-Wallet'>('Bank Transfer');
  const [note, setNote] = useState('');

  // Cập nhật lại số tiền nộp khi dữ liệu invoice từ bước 2 bay sang
  useEffect(() => {
    if (invoice) {
      const calcRemaining = (invoice?.finalFee ?? invoice?.tuitionFee ?? 0) - (invoice?.paidAmount ?? 0);
      setPaymentAmount(calcRemaining);
    }
  }, [invoice]);

  // 3. XỬ LÝ HIỂN THỊ TÊN (Đề phòng trường hợp API chưa populate kịp)
  const studentName = typeof invoice?.student === 'object' 
    ? invoice.student.fullName 
    : (invoice?.studentName || "Học viên mới");

  const courseName = typeof invoice?.course === 'object' 
    ? invoice.course.name 
    : (invoice?.courseName || "Chương trình đào tạo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Gửi dữ liệu về hàm handleInvoiceSubmit ở Leads.tsx
    onSubmit({
      amount: Number(paymentAmount),
      method: paymentMethod,
      note: note || `Thu học phí nhập học: ${courseName}`
    });
  };

  // Nếu không có data invoice truyền vào, hiện trạng thái chờ thay vì crash
  if (!invoice) {
    return (
      <div className="p-10 text-center flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Đang chuẩn bị thông tin hóa đơn...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KHỐI TÓM TẮT THÔNG TIN HỌC PHÍ */}
      <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-5">
        <div className="flex justify-between items-start border-b border-slate-200 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <User className="w-3 h-3" /> Học viên
            </div>
            <p className="text-base font-bold text-slate-900">{studentName}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center justify-end gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <BookOpen className="w-3 h-3" /> Khóa học
            </div>
            <p className="text-base font-bold text-indigo-600">{courseName}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng học phí</p>
            <p className="text-lg font-black text-slate-900">
              {totalAmount.toLocaleString('vi-VN')} <span className="text-[10px] font-normal">VND</span>
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã đóng</p>
            <p className="text-lg font-black text-emerald-600">
              {alreadyPaid.toLocaleString('vi-VN')} <span className="text-[10px] font-normal">VND</span>
            </p>
          </div>
          
          <div className="col-span-2 p-5 bg-rose-50 rounded-2xl border border-rose-100 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertCircle className="w-4 h-4 animate-pulse" />
              <span className="font-black uppercase text-[11px] tracking-tighter">Số tiền cần thu</span>
            </div>
            <span className="text-2xl font-black text-rose-600">
              {remainingDebt.toLocaleString('vi-VN')} <span className="text-sm">đ</span>
            </span>
          </div>
        </div>
      </div>

      {/* NHẬP SỐ TIỀN THU THỰC TẾ */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1 uppercase text-[11px] tracking-wider">Số tiền thu đợt này (VND)</label>
          <div className="relative">
            <input
              type="number"
              required
              min={0}
              max={remainingDebt > 0 ? remainingDebt : undefined}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(Number(e.target.value))}
              className="w-full px-6 py-5 bg-white border-2 border-emerald-500 rounded-2xl text-4xl font-black text-emerald-600 focus:ring-8 focus:ring-emerald-500/10 outline-none transition-all"
              placeholder="0"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-end">
              <span className="font-black text-slate-300">VND</span>
              <span className="text-[10px] text-emerald-500 font-bold uppercase">Thu tiền</span>
            </div>
          </div>
        </div>

        {/* PHƯƠNG THỨC THANH TOÁN */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 ml-1 uppercase text-[11px] tracking-wider">Hình thức thanh toán</label>
          <div className="grid grid-cols-3 gap-3">
            {(['Cash', 'Bank Transfer', 'E-Wallet'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl font-bold text-[10px] uppercase transition-all border-2 ${
                  paymentMethod === method 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md' 
                    : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                }`}
              >
                {method === 'Cash' ? <Banknote className="w-5 h-5" /> : method === 'Bank Transfer' ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                {method === 'Cash' ? 'Tiền mặt' : method === 'Bank Transfer' ? 'Chuyển khoản' : 'Ví điện tử'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
           <label className="text-sm font-bold text-slate-700 ml-1 uppercase text-[11px] tracking-wider flex items-center gap-1">
             <FileText className="w-3 h-3" /> Ghi chú nội dung thu tiền
           </label>
           <textarea 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={2}
            placeholder="Ví dụ: Đóng cọc giữ chỗ / Nộp đủ 100% học phí..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
           />
        </div>
      </div>

      {/* FOOTER BUTTONS */}
      <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-slate-50">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-all"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          className="flex-[2] py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Hoàn tất & Nhập học
        </button>
      </div>
    </form>
  );
}