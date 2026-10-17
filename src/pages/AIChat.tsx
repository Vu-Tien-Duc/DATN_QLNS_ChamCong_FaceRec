import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Send, Bot, User, Trash2, Cpu, HelpCircle,
  Clock, ShieldAlert, CheckCircle2, ChevronRight, Zap, RefreshCw
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { AiChatMessage } from '../types';
import toast from 'react-hot-toast';

const SUGGESTED_QUESTIONS = [
  { text: 'Hạn mức nghỉ phép năm của giảng viên là bao nhiêu ngày?', mode: 'policy' },
  { text: 'Mức giảm trừ gia cảnh và biểu thuế TNCN năm 2026 quy định thế nào?', mode: 'policy' },
  { text: 'Định mức giờ giảng chuẩn và đơn giá thù lao vượt giờ của trường?', mode: 'policy' },
  { text: 'Tôi đã chấm công được bao nhiêu ngày trong tháng này?', mode: 'attendance' },
  { text: 'Quy tắc bán kính Geofence và thời gian cooldown chống quét lặp?', mode: 'policy' },
];

export default function AIChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Xin chào ${user?.fullName || 'Thầy/Cô'}! Tôi là Trợ lý Trí tuệ Nhân tạo hỗ trợ tra cứu công, lịch giảng dạy và giải đáp toàn diện Quy chế Nhà trường năm 2026. Tôi có thể hỗ trợ gì cho Thầy/Cô hôm nay?`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      agentMode: 'policy',
      provider: 'Gemini / Multi-LLM',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<'attendance' | 'policy' | 'academic'>('policy');
  const [provider, setProvider] = useState<'auto' | 'gemini' | 'claude' | 'deepseek' | 'local'>('auto');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: AiChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/ai/chat', {
        question: textToSend,
        agentMode,
        provider,
      });

      if (res.data?.success && res.data?.data) {
        const aiAnswer = res.data.data.answer || res.data.message || 'Không có phản hồi từ hệ thống.';
        const aiMsg: AiChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiAnswer,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          agentMode: res.data.data.agentMode || agentMode,
          provider: res.data.data.provider || provider,
          data: res.data.data,
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(res.data?.message || 'Lỗi xử lý câu hỏi');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Hệ thống AI tạm thời gián đoạn. Vui lòng thử lại sau.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Thông báo:** ${errorMsg}`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-new',
        sender: 'ai',
        text: 'Cuộc trò chuyện đã được làm mới. Bạn có thắc mắc gì về quy chế nhà trường hoặc dữ liệu chấm công?',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base sm:text-lg">Trợ Lý AI Thông Minh</h2>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active v2.5
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Tra cứu chấm công & Giải đáp quy chế đào tạo, định mức lương 2026
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Agent Mode Selector */}
          <select
            value={agentMode}
            onChange={(e) => setAgentMode(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800/80 text-slate-200 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="policy">Chế độ: Quy Chế 2026</option>
            <option value="attendance">Chế độ: Tra Cứu Công</option>
            <option value="academic">Chế độ: Học Thuật & ĐT</option>
          </select>

          {/* Model Provider */}
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800/80 text-slate-200 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="auto">LLM: Tự Động (Auto)</option>
            <option value="gemini">Google Gemini</option>
            <option value="claude">Anthropic Claude</option>
            <option value="deepseek">DeepSeek</option>
            <option value="local">Local Ollama</option>
          </select>

          <button
            onClick={clearChat}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors"
            title="Xóa đoạn chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-slate-800 text-white'
                  : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={`max-w-[85%] sm:max-w-[75%] space-y-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {msg.data?.disambiguation && (
                  <div className="mt-3 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                    <p className="font-bold mb-1">Cán bộ trùng khớp:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {msg.data.matches?.map((m: any, i: number) => (
                        <li key={i}>{m.fullName} ({m.department || 'Bộ môn'})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className={`flex items-center gap-2 px-1 text-[11px] text-slate-400 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <span>{msg.timestamp}</span>
                {msg.sender === 'ai' && msg.provider && (
                  <span className="font-semibold text-indigo-600">• {msg.provider}</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Bot className="w-4 h-4 animate-bounce" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-slate-500 text-sm">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>AI đang tra cứu CSDL & suy luận phản hồi...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      {messages.length <= 3 && (
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 font-semibold shrink-0 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Gợi ý:
          </span>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setAgentMode(q.mode as any);
                handleSend(q.text);
              }}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 whitespace-nowrap transition-colors border border-slate-200"
            >
              {q.text}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1.5 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              agentMode === 'policy'
                ? 'Hỏi về quy chế đào tạo, định mức giờ giảng, biểu thuế TNCN 2026...'
                : 'Tra cứu thông tin công, giờ dạy, lịch làm việc cán bộ...'
            }
            className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
