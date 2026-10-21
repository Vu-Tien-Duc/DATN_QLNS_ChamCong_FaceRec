import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { apiClient } from '../api/apiClient';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  BarChart2,
  TrendingUp,
  Target
} from 'lucide-react';

interface ProjectStatisticsProps {
  projectId: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];

export default function ProjectStatistics({ projectId }: ProjectStatisticsProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tasks?projectId=${projectId}`);
      if (res.data.success) {
        setTasks(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Aggregate data by status
  const statusData = tasks.reduce((acc: any[], task: any) => {
    const statusName = task.status?.name || 'Chưa xác định';
    const existing = acc.find(item => item.name === statusName);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: statusName, value: 1 });
    }
    return acc;
  }, []);

  // Aggregate data by priority
  const priorityData = tasks.reduce((acc: any[], task: any) => {
    const priority = task.priority || 'medium';
    const labelMap: any = {
      highest: 'Rất cao',
      high: 'Cao',
      medium: 'Trung bình',
      low: 'Thấp',
      lowest: 'Rất thấp'
    };
    const name = labelMap[priority] || priority;
    const existing = acc.find(item => item.name === name);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name, value: 1 });
    }
    return acc;
  }, []);

  // Aggregate data by assignee
  const assigneeData = tasks.reduce((acc: any[], task: any) => {
    const assigneeName = task.assignee?.fullName || 'Chưa phân công';
    const existing = acc.find(item => item.name === assigneeName);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: assigneeName, value: 1 });
    }
    return acc;
  }, []);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status?.category === 'done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (loading) return <div className="p-8 text-center text-slate-500">Đang tính toán thống kê...</div>;

  return (
    <div className="space-y-8 p-6 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-slate-200">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xs border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tổng công việc</p>
            <h3 className="text-2xl font-bold text-slate-900">{totalTasks}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hoàn thành</p>
            <h3 className="text-2xl font-bold text-slate-900">{completedTasks}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tỷ lệ hoàn thành</p>
            <h3 className="text-2xl font-bold text-slate-900">{completionRate}%</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xs border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thành viên</p>
            <h3 className="text-2xl font-bold text-slate-900">{assigneeData.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-xs border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Target className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-lg">Trạng thái công việc</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Assignee Workload */}
        <div className="bg-white p-8 rounded-xs border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-lg">Phân bổ nhân sự</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={assigneeData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} width={100} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Stats */}
        <div className="bg-white p-8 rounded-xs border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-8">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-bold text-slate-900 text-lg">Mức độ ưu tiên</h3>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 500 }} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
