import React from 'react';
import { 
  MoreHorizontal, 
  MessageSquare, 
  Paperclip, 
  Calendar,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface TaskCardProps {
  task: any;
  onClick?: () => void;
}

const PriorityIcon = ({ priority }: { priority: string }) => {
  switch (priority) {
    case 'highest': return <ArrowUp className="w-3 h-3 text-red-600" />;
    case 'high': return <ArrowUp className="w-3 h-3 text-red-400" />;
    case 'medium': return <Minus className="w-3 h-3 text-orange-400" />;
    case 'low': return <ArrowDown className="w-3 h-3 text-emerald-400" />;
    case 'lowest': return <ArrowDown className="w-3 h-3 text-emerald-600" />;
    default: return <Minus className="w-3 h-3 text-slate-400" />;
  }
};

const TypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'bug': return <div className="w-3 h-3 bg-red-500 rounded-sm" title="Bug" />;
    case 'story': return <div className="w-3 h-3 bg-emerald-500 rounded-sm" title="Story" />;
    case 'epic': return <div className="w-3 h-3 bg-purple-500 rounded-sm" title="Epic" />;
    default: return <div className="w-3 h-3 bg-blue-500 rounded-sm" title="Task" />;
  }
};

export default function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group select-none mb-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <TypeIcon type={task.type} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
            {task.key}
          </span>
        </div>
        <button className="p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-slate-100">
          <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      <h4 className="text-sm font-semibold text-slate-800 mb-3 line-clamp-2 leading-snug">
        {task.title}
      </h4>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-3 text-slate-400">
          <PriorityIcon priority={task.priority} />
          {task.points > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {task.points}
            </span>
          )}
          {task.comments?.length > 0 && (
            <div className="flex items-center gap-1 text-[10px]">
              <MessageSquare className="w-3 h-3" />
              {task.comments.length}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
              <Calendar className="w-3 h-3" />
              {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
            </div>
          )}
          <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden border border-white">
            <img 
              src={task.assignee?.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} 
              alt={task.assignee?.fullName} 
              className="w-full h-full object-cover"
              title={task.assignee?.fullName || 'Chưa phân công'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
