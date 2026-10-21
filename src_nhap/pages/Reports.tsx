import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Download,
  Filter,
  Star
} from 'lucide-react';

const conversionData = [
  { name: 'T1', leads: 400, enroll: 80 },
  { name: 'T2', leads: 300, enroll: 90 },
  { name: 'T3', leads: 500, enroll: 120 },
  { name: 'T4', leads: 450, enroll: 110 },
  { name: 'T5', leads: 600, enroll: 150 },
  { name: 'T6', leads: 550, enroll: 140 },
];

const revenueData = [
  { name: 'T1', revenue: 450, target: 400 },
  { name: 'T2', revenue: 520, target: 450 },
  { name: 'T3', revenue: 480, target: 500 },
  { name: 'T4', revenue: 610, target: 550 },
  { name: 'T5', revenue: 700, target: 600 },
  { name: 'T6', revenue: 680, target: 650 },
];

const staffPerformance = [
  { name: 'Linh Chi', leads: 120, closed: 35, revenue: 450 },
  { name: 'Minh Hoàng', leads: 100, closed: 28, revenue: 380 },
  { name: 'Anh Tuấn', leads: 140, closed: 30, revenue: 410 },
  { name: 'Thu Hà', leads: 90, closed: 25, revenue: 320 },
];

export default function Reports() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Báo cáo & Phân tích</h1>
          <p className="text-slate-500">Dữ liệu chi tiết về hiệu suất kinh doanh và vận hành.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all">
            <Filter className="w-5 h-5" /> Lọc dữ liệu
          </button>
          <button className="flex items-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20">
            <Download className="w-5 h-5" /> Xuất báo cáo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xs shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Doanh thu 6 tháng</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">3.14 tỷ</p>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-bold">
            <TrendingUp className="w-3 h-3 mr-1" /> +15.4% so với kỳ trước
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Tỷ lệ chuyển đổi TB</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">22.5%</p>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-bold">
            <TrendingUp className="w-3 h-3 mr-1" /> +2.1% so với kỳ trước
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Giá mỗi Lead (CPL)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">45,000đ</p>
          <div className="mt-4 flex items-center text-xs text-rose-600 font-bold">
            <TrendingUp className="w-3 h-3 mr-1" /> +5.2% (Tăng chi phí)
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs shadow-sm border border-slate-100">
          <p className="text-sm text-slate-500 font-medium">Lợi nhuận ròng</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">1.25 tỷ</p>
          <div className="mt-4 flex items-center text-xs text-emerald-600 font-bold">
            <TrendingUp className="w-3 h-3 mr-1" /> +12.8% so với kỳ trước
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-xs shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-8">Doanh thu thực tế vs Mục tiêu</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" name="Thực tế" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="target" name="Mục tiêu" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xs shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-8">Phễu chuyển đổi Lead</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={conversionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="leads" name="Tổng Lead" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                <Area type="monotone" dataKey="enroll" name="Chuyển đổi" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xs shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Hiệu suất nhân viên tư vấn</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân viên</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lead xử lý</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Chốt đơn</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Doanh thu (triệu)</th>
                <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Đánh giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffPerformance.map((staff, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4 font-bold text-slate-900">{staff.name}</td>
                  <td className="px-8 py-4 text-slate-600">{staff.leads}</td>
                  <td className="px-8 py-4 text-slate-600">{staff.closed}</td>
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(staff.closed / staff.leads) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700">{Math.round((staff.closed / staff.leads) * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 font-bold text-emerald-600">{staff.revenue}M</td>
                  <td className="px-8 py-4">
                    <div className="flex text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < 4 ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
