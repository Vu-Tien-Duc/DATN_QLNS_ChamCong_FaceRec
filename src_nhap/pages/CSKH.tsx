import { useState } from 'react';
import {
  Heart,
  Gift,
  MessageCircle,
  Star,
  Calendar,
  Bell,
  CheckCircle2,
  Clock
} from 'lucide-react';

const mockTasks = [
  {
    id: '1',
    type: 'Follow-up',
    student: 'Nguyễn Văn An',
    content: 'Chăm sóc sau 7 ngày nhập học',
    dueDate: 'Hôm nay',
    priority: 'High',
    status: 'Pending'
  },
  {
    id: '2',
    type: 'Birthday',
    student: 'Trần Thị Bình',
    content: 'Gửi lời chúc mừng sinh nhật & voucher 10%',
    dueDate: 'Ngày mai',
    priority: 'Medium',
    status: 'Pending'
  },
  {
    id: '3',
    type: 'Feedback',
    student: 'Lê Văn Đạt',
    content: 'Khảo sát hài lòng giữa khóa (NPS)',
    dueDate: '28/02/2026',
    priority: 'Low',
    status: 'Completed'
  }
];

export default function CSKH() {
  const [tasks] = useState(mockTasks);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900">Chăm sóc khách hàng</h1>
        <p className="text-slate-500">Xây dựng mối quan hệ bền vững với học viên.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-emerald-500 p-6 rounded-xs text-white shadow-lg shadow-emerald-500/20">
          <Bell className="w-8 h-8 mb-4 opacity-80" />
          <p className="text-sm font-medium opacity-80">Việc cần làm hôm nay</p>
          <p className="text-3xl font-bold">12</p>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-100 shadow-sm">
          <Star className="w-8 h-8 mb-4 text-amber-500" />
          <p className="text-sm font-medium text-slate-500">Chỉ số NPS trung bình</p>
          <p className="text-3xl font-bold text-slate-900">8.5 / 10</p>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-100 shadow-sm">
          <Gift className="w-8 h-8 mb-4 text-rose-500" />
          <p className="text-sm font-medium text-slate-500">Sinh nhật trong tuần</p>
          <p className="text-3xl font-bold text-slate-900">05</p>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-100 shadow-sm">
          <Heart className="w-8 h-8 mb-4 text-blue-500" />
          <p className="text-sm font-medium text-slate-500">Tỷ lệ tái đăng ký</p>
          <p className="text-3xl font-bold text-slate-900">32%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-xs shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Lịch nhắc chăm sóc</h2>
            <button className="bg-slate-50 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all">
              Thêm nhắc nhở
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {tasks.map((task) => (
              <div key={task.id} className="p-6 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                <div className={`p-3 rounded-2xl ${task.type === 'Follow-up' ? 'bg-blue-50 text-blue-500' :
                    task.type === 'Birthday' ? 'bg-rose-50 text-rose-500' :
                      'bg-emerald-50 text-emerald-500'
                  }`}>
                  {task.type === 'Follow-up' ? <Clock className="w-5 h-5" /> :
                    task.type === 'Birthday' ? <Gift className="w-5 h-5" /> :
                      <MessageCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900">{task.content}</h3>
                      <p className="text-sm text-slate-500">Học viên: <span className="font-medium text-slate-700">{task.student}</span></p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${task.priority === 'High' ? 'bg-rose-100 text-rose-700' :
                        task.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                      }`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-4">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {task.dueDate}
                    </span>
                    <div className="flex-1" />
                    <button className="text-sm font-bold text-emerald-600 hover:underline">Xử lý ngay</button>
                    <button className="text-sm font-bold text-slate-400 hover:text-slate-600">Bỏ qua</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-xs shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Gửi tin nhắn nhanh</h2>
            <div className="space-y-4">
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all group">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                  <span className="font-medium">Mẫu chúc mừng sinh nhật</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all group">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                  <span className="font-medium">Mẫu nhắc học phí</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
              <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-emerald-50 hover:text-emerald-700 transition-all group">
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                  <span className="font-medium">Mẫu khảo sát hài lòng</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-xs text-white">
            <h3 className="text-lg font-bold mb-2">Mẹo CSKH</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              "Tỷ lệ tái đăng ký tăng 20% khi học viên nhận được ít nhất 1 cuộc gọi hỏi thăm tiến độ vào giữa khóa học."
            </p>
            <button className="mt-6 text-emerald-400 text-sm font-bold hover:underline">Xem thêm tài liệu</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6" /></svg>
  );
}
