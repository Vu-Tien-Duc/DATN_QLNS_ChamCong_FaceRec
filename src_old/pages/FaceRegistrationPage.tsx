import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Sparkles, User, ShieldCheck, ArrowRight, Trash2, Lock } from 'lucide-react';
import { FaceRegistrationModal } from '../components/FaceRegistrationModal';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/apiClient';
import { toast } from 'react-hot-toast';

export default function FaceRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteMyFace = async () => {
    if (
      !window.confirm(
        'CẢNH BÁO PHÁP LÝ (Nghị định 13/2023/NĐ-CP):\nBạn có chắc chắn muốn thực hiện Quyền được xóa dữ liệu cá nhân, hủy bỏ đồng thuận và xóa vĩnh viễn toàn bộ dữ liệu mẫu khuôn mặt 5 góc khỏi hệ thống không?\nSau khi xóa, bạn sẽ không thể thực hiện điểm danh bằng Face ID.'
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await apiClient.delete('/face/my-template');
      if (res.data?.success) {
        toast.success('Đã xóa vĩnh viễn dữ liệu sinh trắc học theo Nghị định 13/2023/NĐ-CP thành công!');
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa dữ liệu khuôn mặt.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Camera className="text-primary-600" size={28} />
            Đăng Ký Khuôn Mặt Sinh Trắc Học (Face ID 5 Góc)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Hệ thống nhận diện khuôn mặt đa góc ArcFace InsightFace chuẩn $L_2$ Centroid 512 chiều mã hóa AES-256-GCM.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
          <ShieldCheck size={16} className="text-emerald-600" />
          <span className="font-semibold">Tuân thủ Nghị định 13/2023/NĐ-CP (Mã hóa At-Rest)</span>
        </div>
      </div>

      {/* Profile summary card */}
      <div className="card p-6 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/50 border border-blue-100/80 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-primary-500/20 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <User size={36} />
              )}
            </div>
            {user?.isFaceRegistered && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full ring-2 ring-white">
                <ShieldCheck size={14} />
              </span>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-lg font-semibold text-slate-800">{user?.fullName || 'Cán bộ / Giảng viên'}</h2>
              <span className="badge badge-info text-xs">{user?.staffCode || 'CB-GV'}</span>
              <span className={`badge ${user?.isFaceRegistered ? 'badge-success' : 'badge-warning'} text-xs`}>
                {user?.isFaceRegistered ? 'Đã kích hoạt Face ID' : 'Chưa có mẫu khuôn mặt'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Email công vụ: <span className="font-medium text-slate-700">{user?.email}</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1 justify-center sm:justify-start">
              <Lock size={12} className="text-indigo-600" />
              <span>Dữ liệu sinh trắc học được mã hóa đối xứng AES-256-GCM và lưu trữ an toàn độc lập.</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            {user?.isFaceRegistered && (
              <button
                onClick={handleDeleteMyFace}
                disabled={isDeleting}
                className="btn border border-rose-200 text-rose-600 hover:bg-rose-50 px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all font-semibold text-xs whitespace-nowrap cursor-pointer"
              >
                <Trash2 size={15} />
                {isDeleting ? 'Đang xóa...' : 'Xóa Face ID (Quyền được xóa)'}
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all font-medium text-sm whitespace-nowrap cursor-pointer"
            >
              <Camera size={18} />
              {user?.isFaceRegistered ? 'Cập Nhật Lại 5 Góc' : 'Bắt Đầu Chụp 5 Góc'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>


      {/* Process explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          {
            step: 'Góc 1',
            title: 'Chính Diện',
            desc: 'Nhìn thẳng vào ống kính',
            icon: '🎯',
            bgColor: 'bg-cyan-50/80',
            borderColor: 'border-cyan-200',
            textColor: 'text-cyan-700',
          },
          {
            step: 'Góc 2',
            title: 'Nghiêng Trái',
            desc: 'Quay mặt sang trái 15°-25°',
            icon: '⬅️',
            bgColor: 'bg-indigo-50/80',
            borderColor: 'border-indigo-200',
            textColor: 'text-indigo-700',
          },
          {
            step: 'Góc 3',
            title: 'Nghiêng Phải',
            desc: 'Quay mặt sang phải 15°-25°',
            icon: '➡️',
            bgColor: 'bg-purple-50/80',
            borderColor: 'border-purple-200',
            textColor: 'text-purple-700',
          },
          {
            step: 'Góc 4',
            title: 'Ngước Lên',
            desc: 'Hơi nâng nhẹ cằm lên trên',
            icon: '⬆️',
            bgColor: 'bg-amber-50/80',
            borderColor: 'border-amber-200',
            textColor: 'text-amber-700',
          },
          {
            step: 'Góc 5',
            title: 'Cúi Xuống',
            desc: 'Hơi hạ nhẹ cằm xuống dưới',
            icon: '⬇️',
            bgColor: 'bg-emerald-50/80',
            borderColor: 'border-emerald-200',
            textColor: 'text-emerald-700',
          },
        ].map((item, index) => (
          <div
            key={index}
            className={`card p-4 rounded-xl border ${item.borderColor} ${item.bgColor} transition-all hover:scale-[1.02] shadow-sm`}
          >
            <div className="text-2xl mb-2">{item.icon}</div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              {item.step}
            </span>
            <h3 className={`text-sm font-bold ${item.textColor} mt-0.5`}>{item.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Guidance and compliance notice */}
      <div className="card p-6 bg-slate-50/80 border border-slate-200 rounded-2xl">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-amber-500" />
          Lưu ý quan trọng khi thu thập dữ liệu khuôn mặt:
        </h3>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
          <li>Ngồi ở nơi có đủ ánh sáng tự nhiên hoặc ánh đèn trắng, tránh ngược sáng hoặc bóng râm che một phần mặt.</li>
          <li>Tháo khẩu trang, kính râm và mũ nón che trán để thuật toán trích xuất đầy đủ 512 đặc trưng hình học.</li>
          <li>Giữ khoảng cách khuôn mặt với camera từ 40cm đến 70cm, giữ tư thế ổn định khoảng 0.5 giây mỗi góc.</li>
          <li>
            Mỗi nhân viên chỉ được đăng ký một khuôn mặt duy nhất. Thuật toán sẽ tự động phát hiện và ngăn chặn trùng lặp sinh trắc học với các tài khoản khác trong toàn trường.
          </li>
          <li>
            <strong>Quyền được rút lại đồng thuận & Xóa dữ liệu (Nghị định 13/2023/NĐ-CP):</strong> Dữ liệu vector đặc trưng khuôn mặt được mã hóa đối xứng AES-256-GCM lưu trữ At-Rest. Bạn có toàn quyền yêu cầu hủy bỏ đồng thuận và xóa vĩnh viễn dữ liệu sinh trắc học khỏi hệ thống bất kỳ lúc nào bằng nút "Xóa Face ID (Quyền được xóa)".
          </li>
        </ul>
      </div>

      {/* Modal Chụp mặt 5 góc */}
      {isModalOpen && user && (
        <FaceRegistrationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          user={user}
          onSuccess={() => {
            setIsModalOpen(false);
            navigate('/users');
          }}
        />
      )}
    </div>
  );
}
