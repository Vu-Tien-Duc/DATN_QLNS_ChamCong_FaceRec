import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mascot } from 'page-mascot';
import {
  Bot,
  X,
  Send,
  Trash2,
  Sparkles,
  School,
  BookOpen,
  ClipboardList,
  Globe,
  Loader2,
  FileText,
  Paperclip,
  Upload,
  Database,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, AIChatMessage, AIDocumentItem, AIMode, AIProviderInfo } from '../../api/troLyAi.api';
import { useAuthStore } from '../../stores/useXacThucStore';

const DEFAULT_MODES: AIMode[] = [
  {
    id: 'hr_work',
    name: 'Việc trường',
    description: 'Tra cứu lịch dạy hôm nay, ngày phép, giờ chấm công và quy chế ĐH Nguyễn Trãi',
  },
  {
    id: 'research',
    name: 'Học thuật',
    description: 'Gợi ý đề tài NCKH, đề cương chi tiết môn học, ngân hàng câu hỏi Bloom, chuẩn APA',
  },
  {
    id: 'survey',
    name: 'Khảo sát',
    description: 'Thiết kế phiếu khảo sát ý kiến sinh viên, form đánh giá Likert 5 mức độ',
  },
  {
    id: 'rag_doc',
    name: 'Tài liệu (RAG)',
    description: 'Đọc hiểu tài liệu PDF/Word, tra cứu kho tri thức và dịch văn bản từ ảnh',
  },
  {
    id: 'general',
    name: 'Mở rộng',
    description: 'Giải đáp mọi câu hỏi ngoài nghề: lập trình, CNTT, đời sống và kỹ năng mềm',
  },
];

const DEFAULT_QUICK_PROMPTS: Record<string, string[]> = {
  hr_work: [
    'Hôm nay tôi có lịch dạy những ca nào?',
    'Tôi còn bao nhiêu ngày phép năm?',
    'Xem giờ chấm công hôm nay của tôi',
    'Quy định về thời gian đi muộn và về sớm của trường',
  ],
  research: [
    'Gợi ý đề tài NCKH ngành CNTT ứng dụng Trí tuệ Nhân tạo',
    'Soạn đề cương chi tiết học phần Lập trình Web Hiện đại',
    'Tạo 5 câu hỏi trắc nghiệm thang đo Bloom bậc Vận dụng cao',
    'Hướng dẫn cấu trúc trích dẫn tài liệu học thuật chuẩn APA 7th',
  ],
  survey: [
    'Soạn bảng hỏi khảo sát chất lượng giảng dạy thang đo Likert 5 mức độ',
    'Thiết kế form lấy ý kiến sinh viên về cơ sở vật chất phòng thực hành',
    'Khảo sát nhu cầu đào tạo kỹ năng AI ứng dụng cho sinh viên năm cuối',
  ],
  rag_doc: [
    'Tóm tắt các quy định quan trọng nhất trong tài liệu đã chọn',
    'Rút gọn 5 ý chính của tài liệu vừa tải lên',
    'Trích xuất các mốc thời gian và điều kiện áp dụng trong tài liệu',
  ],
  general: [
    'Giải thích sự khác biệt giữa MongoDB và MySQL khi xử lý dữ liệu lớn',
    'Viết hàm xử lý debounce và throttle chuẩn TypeScript',
    'Gợi ý cách phân bổ thời gian hiệu quả giữa giảng dạy và nghiên cứu',
  ],
};

const MODE_ICONS: Record<string, React.ReactNode> = {
  hr_work: <School className="w-3.5 h-3.5" />,
  research: <BookOpen className="w-3.5 h-3.5" />,
  survey: <ClipboardList className="w-3.5 h-3.5" />,
  rag_doc: <FileText className="w-3.5 h-3.5" />,
  general: <Globe className="w-3.5 h-3.5" />,
};

const formatBytesShort = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Component hiển thị nội dung định dạng Markdown cơ bản (Code block, Bold, List, Heading, Table)
 */
const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const renderFormattedText = (text: string) => {
    // Tách các đoạn mã ```lang ... ```
    const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'code', value: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.substring(lastIndex) });
    }

    return parts.map((part, pIdx) => {
      if (part.type === 'code') {
        return (
          <div key={pIdx} className="my-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 text-xs">
            <div className="bg-slate-800 px-3 py-1 font-mono text-[10px] text-slate-400 uppercase tracking-wider flex justify-between">
              <span>{part.lang}</span>
            </div>
            <pre className="p-3 overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">
              <code>{part.value}</code>
            </pre>
          </div>
        );
      }

      // Xử lý các dòng văn bản thường
      const lines = part.value.split('\n');
      return (
        <div key={pIdx} className="space-y-1.5">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={lIdx} className="h-1.5" />;

            // Headings
            if (trimmed.startsWith('### ')) {
              return <h4 key={lIdx} className="font-bold text-sm text-indigo-600 dark:text-indigo-400 mt-2">{trimmed.replace('### ', '')}</h4>;
            }
            if (trimmed.startsWith('## ')) {
              return <h3 key={lIdx} className="font-bold text-base text-indigo-700 dark:text-indigo-300 mt-2.5">{trimmed.replace('## ', '')}</h3>;
            }
            if (trimmed.startsWith('# ')) {
              return <h2 key={lIdx} className="font-extrabold text-lg text-indigo-800 dark:text-indigo-200 mt-3">{trimmed.replace('# ', '')}</h2>;
            }

            // Bullet lists
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              const itemText = trimmed.substring(2);
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-2">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span className="flex-1">{formatInline(itemText)}</span>
                </div>
              );
            }

            // Numbered lists
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-2">
                  <span className="text-indigo-500 font-semibold min-w-[1.2rem]">{numMatch[1]}.</span>
                  <span className="flex-1">{formatInline(numMatch[2])}</span>
                </div>
              );
            }

            // Table rows: | col1 | col2 |
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
              // Bỏ qua dòng phân cách | :--- | :--- |
              if (trimmed.includes('---')) return null;
              const cells = trimmed.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
              return (
                <div key={lIdx} className="grid grid-flow-col auto-cols-fr gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs">
                  {cells.map((cell, cIdx) => (
                    <div key={cIdx} className="font-medium text-slate-700 dark:text-slate-300">
                      {formatInline(cell.trim())}
                    </div>
                  ))}
                </div>
              );
            }

            return <p key={lIdx} className="leading-relaxed">{formatInline(line)}</p>;
          })}
        </div>
      );
    });
  };

  // Định dạng inline: **in đậm**, *in nghiêng*, `inline code`
  const formatInline = (str: string) => {
    const tokens = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return tokens.map((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith('*') && token.endsWith('*')) {
        return <em key={idx} className="italic">{token.slice(1, -1)}</em>;
      }
      if (token.startsWith('`') && token.endsWith('`')) {
        return <code key={idx} className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-mono text-xs">{token.slice(1, -1)}</code>;
      }
      return token;
    });
  };

  return <div className="text-sm">{renderFormattedText(content)}</div>;
};

export const AiChatBox: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>('hr_work');
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modes, setModes] = useState<AIMode[]>(DEFAULT_MODES);
  const [quickPrompts, setQuickPrompts] = useState<Record<string, string[]>>(DEFAULT_QUICK_PROMPTS);
  const [showPrompts, setShowPrompts] = useState(true);
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('gemini');

  // Đính kèm tệp trực tiếp trong tin nhắn (Ảnh OCR / PDF / Word)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  // Kho tài liệu RAG
  const [ragDocuments, setRagDocuments] = useState<AIDocumentItem[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [canUploadSchoolWide, setCanUploadSchoolWide] = useState(false);
  const [showRagPanel, setShowRagPanel] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isUploadingRag, setIsUploadingRag] = useState(false);
  const [ragUploadScope, setRagUploadScope] = useState<'ca_nhan' | 'toan_truong'>('ca_nhan');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const ragFileInputRef = useRef<HTMLInputElement>(null);
  const createdBlobUrlsRef = useRef<string[]>([]);
  const { user } = useAuthStore();
  const lastUserIdRef = useRef<string | undefined>(user?.id);

  const isPendingImage = Boolean(pendingFile && pendingFile.type.startsWith('image/'));

  // Scroll xuống cuối tin nhắn
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const revokeAllSessionBlobUrls = useCallback(() => {
    createdBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    createdBlobUrlsRef.current = [];
  }, []);

  // Chỉ thu hồi toàn bộ ObjectURL khi unmount component (giữ ảnh hiển thị nguyên vẹn trong lịch sử chat)
  useEffect(() => {
    return () => {
      revokeAllSessionBlobUrls();
    };
  }, [revokeAllSessionBlobUrls]);

  // Lắng nghe sự kiện mở nhanh Trợ lý AI & Kho tài liệu RAG từ Sidebar
  useEffect(() => {
    const handleOpenFromSidebar = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setIsOpen(true);
      if (detail?.openRag) {
        setShowRagPanel(true);
      }
    };
    window.addEventListener('ntu:open-ai-hub', handleOpenFromSidebar);
    return () => window.removeEventListener('ntu:open-ai-hub', handleOpenFromSidebar);
  }, []);

  // Reset lịch sử & tài liệu RAG khi đổi tài khoản đăng nhập
  useEffect(() => {
    if (lastUserIdRef.current !== user?.id) {
      lastUserIdRef.current = user?.id;
      revokeAllSessionBlobUrls();
      setMessages([]);
      setSelectedDocIds([]);
      setRagDocuments([]);
      setPendingFile(null);
      setPendingPreviewUrl(null);
      setShowPrompts(true);
    }
  }, [user?.id, revokeAllSessionBlobUrls]);

  // Tải danh sách modes khi khởi tạo
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const modesRes = await aiApi.getModes();
        if (modesRes.success && modesRes.data) {
          setModes(modesRes.data.modes || DEFAULT_MODES);
          if (modesRes.data.quickPrompts) {
            setQuickPrompts(modesRes.data.quickPrompts);
          }
        }
      } catch (err) {
        console.warn('Lỗi khi tải metadata AI:', err);
      }
    };

    fetchMetadata();
  }, []);

  // Tải danh sách providers & tài liệu RAG khi mở hộp thoại chat
  const fetchRagDocuments = useCallback(async () => {
    if (!user) return;
    setIsLoadingDocs(true);
    try {
      const [docRes, provRes] = await Promise.all([
        aiApi.getDocuments().catch(() => null),
        aiApi.getProviders().catch(() => null),
      ]);
      if (docRes?.success && docRes.data) {
        setRagDocuments(docRes.data.documents || []);
        setCanUploadSchoolWide(Boolean(docRes.data.canUploadSchoolWide));
      }
      if (provRes?.success && provRes.data) {
        const list = provRes.data.providers || [];
        setProviders(list);
        const def = provRes.data.defaultProvider || 'gemini';
        const firstConfigured = list.find((p) => p.id === def && p.isConfigured) || list.find((p) => p.isConfigured);
        if (firstConfigured) {
          setSelectedProvider(firstConfigured.id);
        }
      }
    } catch (err) {
      console.warn('Không thể tải dữ liệu AI & RAG:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchRagDocuments();
    }
  }, [isOpen, user, fetchRagDocuments]);

  // Tin nhắn chào mừng ban đầu
  useEffect(() => {
    if (messages.length === 0) {
      const greetingName = user?.ho_ten ? `Thầy/Cô ${user.ho_ten}` : 'Thầy/Cô';
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Dạ chào ${greetingName}! Em là **Trợ lý AI Đa Năng Đại học Nguyễn Trãi (NTU AI Hub)**.\n\nEm có thể hỗ trợ Thầy/Cô:\n- 🏫 **Tra cứu việc trường:** Lịch dạy hôm nay, số ngày phép năm còn lại, giờ chấm công và quy chế.\n- 📚 **Học thuật & NCKH:** Gợi ý đề tài nghiên cứu, đề cương chi tiết học phần, câu hỏi trắc nghiệm Bloom.\n- 📄 **Đọc tài liệu (RAG) & Ảnh:** Tải tài liệu PDF/Word lên kho tri thức, tóm tắt ý chính hoặc gửi/dán ảnh để trích xuất & dịch tiếng Việt.\n- 📋 **Khảo sát & Mở rộng:** Soạn bảng hỏi Likert 5 mức độ và giải đáp CNTT, đời sống.\n\n*Thầy/Cô hãy chọn chế độ phía trên, bấm nút kẹp ghim (📎) hoặc dán ảnh trực tiếp vào ô chat nhé!*`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          provider: 'ntu_ai_hub',
        },
      ]);
    }
  }, [user, messages.length]);

  const clearPendingAttachment = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      createdBlobUrlsRef.current = createdBlobUrlsRef.current.filter((u) => u !== pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const attachChatFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dung lượng tệp vượt quá giới hạn cho phép (tối đa 10MB).');
      return;
    }

    const lowerName = file.name.toLowerCase();
    const validExt = /\.(png|jpe?g|webp|pdf|docx?|txt|md)$/i.test(lowerName) || file.type.startsWith('image/');
    if (!validExt) {
      toast.error('Chỉ hỗ trợ ảnh (PNG, JPG, WEBP) hoặc tài liệu (PDF, DOCX, DOC, TXT, MD).');
      return;
    }

    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
      createdBlobUrlsRef.current = createdBlobUrlsRef.current.filter((u) => u !== pendingPreviewUrl);
    }

    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      createdBlobUrlsRef.current.push(objectUrl);
      setPendingPreviewUrl(objectUrl);
    } else {
      setPendingPreviewUrl(null);
    }
    setSelectedMode('rag_doc');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachChatFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          e.preventDefault();
          const ext = item.type.split('/')[1] || 'png';
          const pastedFile = new File([blob], `anh_dan_${Date.now()}.${ext}`, { type: item.type });
          attachChatFile(pastedFile);
          toast.success('Đã đính kèm ảnh từ clipboard!');
          break;
        }
      }
    }
  };

  const handleUploadRagDocument = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Tài liệu RAG tối đa 10MB.');
      return;
    }
    setIsUploadingRag(true);
    try {
      const res = await aiApi.uploadDocument(file, {
        scope: canUploadSchoolWide ? ragUploadScope : 'ca_nhan',
      });
      if (res.success && res.data) {
        const isDuplicate = Boolean((res as any).isDuplicate);
        toast.success(
          isDuplicate
            ? res.message || `Tài liệu "${res.data.tieu_de}" đã có sẵn trong Kho RAG.`
            : `Đã nạp "${res.data.tieu_de}" (${res.data.tong_so_doan || 0} đoạn) vào Kho RAG!`
        );
        setRagDocuments((prev) => [res.data, ...prev.filter((d) => d.id !== res.data.id)]);
        setSelectedDocIds((prev) => Array.from(new Set([...prev, res.data.id])));
        setSelectedMode('rag_doc');
        setShowRagPanel(true);
      } else {
        throw new Error(res.message || 'Nạp tài liệu thất bại.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không thể nạp tài liệu vào Kho RAG.');
    } finally {
      setIsUploadingRag(false);
      if (ragFileInputRef.current) ragFileInputRef.current.value = '';
    }
  };

  const handleDeleteRagDocument = async (docId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Xóa tài liệu "${title}" khỏi kho AI RAG?`)) return;
    try {
      const res = await aiApi.deleteDocument(docId);
      if (res.success) {
        toast.success('Đã xóa tài liệu khỏi kho RAG.');
        setRagDocuments((prev) => prev.filter((d) => d.id !== docId));
        setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không thể xóa tài liệu.');
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Gửi tin nhắn (văn bản hoặc kèm ảnh / PDF / Word)
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend !== undefined ? textToSend : inputMessage).trim();
    const fileToSend = pendingFile;

    if ((!content && !fileToSend) || isLoading) return;

    const displayContent =
      content ||
      (fileToSend?.type.startsWith('image/')
        ? 'Hãy đọc văn bản trong ảnh này và chuyển/dịch sang Tiếng Việt.'
        : 'Hãy phân tích và rút gọn các ý chính của tài liệu đính kèm.');

    const userMessage: AIChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayContent,
      mode: selectedMode,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      attachmentPreview: fileToSend
        ? {
            type: fileToSend.type.startsWith('image/') ? 'image' : 'document',
            name: fileToSend.name,
            size: fileToSend.size,
            imageUrl: pendingPreviewUrl || undefined,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    // Giữ imageUrl trên userMessage hiển thị trong phiên chat, chỉ reset state input
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';

    setIsLoading(true);
    setShowPrompts(false);

    const historyPayload = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const activeProv = providers.find((p) => p.id === selectedProvider);
      const res = await aiApi.chat({
        message: content,
        mode: selectedMode,
        provider: selectedProvider,
        model: activeProv?.model,
        history: historyPayload,
        documentIds: selectedDocIds,
        useRag: true,
        file: fileToSend,
      });

      if (res.success && res.data) {
        const assistantMessage: AIChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.data.reply,
          mode: res.data.mode,
          provider: res.data.provider,
          model: res.data.model,
          sources: res.data.sources,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(res.message || 'Không thể nhận phản hồi từ AI.');
      }
    } catch (err: any) {
      const errText = err.response?.data?.message || err.message || 'Lỗi mạng';
      const errorMessage: AIChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Dạ rất tiếc, đã xảy ra lỗi trong quá trình xử lý: "${errText}". Thầy/Cô vui lòng thử lại sau ít giây.`,
        isError: true,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    revokeAllSessionBlobUrls();
    setMessages([]);
    setShowPrompts(true);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const activeModeMeta = modes.find((m) => m.id === selectedMode) || modes[0];
  const activeQuickPrompts = quickPrompts[selectedMode] || DEFAULT_QUICK_PROMPTS[selectedMode] || [];

  return (
    <>
      {/* 1. Floating Action Mascot Button (Góc dưới bên phải) */}
      {!isOpen && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end">
          <div
            onClick={() => setIsOpen(true)}
            className="group relative cursor-pointer flex flex-col items-center transition-transform hover:scale-105 active:scale-95"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsOpen(true);
              }
            }}
            aria-label="Mở Trợ lý AI NTU Pug Mascot"
          >
            {/* Mascot Character with shadow & pulse indicator */}
            <div className="relative filter drop-shadow-2xl">
              <Mascot
                directions="/mascots/pug-directions.webp"
                reactions="/mascots/pug-reactions.webp"
                size={88}
                label="Trợ lý AI NTU Pug Mascot"
              />
              <span className="absolute top-1 right-2 flex h-3.5 w-3.5 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
              </span>
            </div>

            {/* Tooltip khi chưa mở */}
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Trợ lý AI NTU • Nhấn để trò chuyện!</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Cửa Sổ Chat Floating Window */}
      {isOpen && (
        <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 w-[94vw] sm:w-[470px] h-[650px] max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
          {/* Pug Mascot perched on top of the chat window */}
          <div className="absolute -top-[60px] right-6 pointer-events-auto filter drop-shadow-xl z-10">
            <Mascot
              directions="/mascots/pug-directions.webp"
              reactions="/mascots/pug-reactions.webp"
              size={76}
              label="Trợ lý AI NTU Pug Mascot"
            />
          </div>

          {/* Header */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 rounded-t-3xl">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">
                    Trợ Lý AI ĐH Nguyễn Trãi
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold font-mono shrink-0">
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {activeModeMeta?.description || 'Hỗ trợ tra cứu đào tạo, NCKH và tài liệu RAG'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearHistory}
                title="Xóa đoạn chat"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ"
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Thanh Chọn Model AI Đã Liên Kết & Trạng Thái Kho Tri Thức RAG */}
          <div className="bg-slate-50/90 dark:bg-slate-850/70 px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Model AI:
              </span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 outline-none focus:border-blue-500 truncate max-w-[230px] cursor-pointer"
                title="Chọn mô hình AI đã liên kết trong Cấu hình tham số"
              >
                {(providers.length > 0
                  ? providers
                  : [
                      {
                        id: 'gemini',
                        name: 'Google Gemini',
                        model: 'gemini-2.5-flash',
                        isConfigured: true,
                        description: '',
                      },
                    ]
                ).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.isConfigured ? '🟢' : '⚪'} {p.name} ({p.model})
                  </option>
                ))}
              </select>
            </div>

            <div
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/60 text-[10px] font-semibold whitespace-nowrap shrink-0"
              title="Số tài liệu RAG toàn trường đang được liên kết tự động (quản lý tại Cấu hình tham số)"
            >
              <Database className="w-3 h-3 shrink-0" />
              <span>RAG: {ragDocuments.length} tài liệu</span>
            </div>
          </div>

          {/* Danh Sách Tin Nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Hiển thị tệp đính kèm trong tin nhắn người dùng */}
                    {isUser && msg.attachmentPreview && (
                      <div className="mb-1.5">
                        {msg.attachmentPreview.type === 'image' && msg.attachmentPreview.imageUrl ? (
                          <img
                            src={msg.attachmentPreview.imageUrl}
                            alt={msg.attachmentPreview.name}
                            className="max-h-40 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs object-contain bg-white"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[200px] font-medium">
                              {msg.attachmentPreview.name}
                            </span>
                            {msg.attachmentPreview.size && (
                              <span className="text-[10px] opacity-75">
                                ({formatBytesShort(msg.attachmentPreview.size)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-tr-sm shadow-xs'
                          : msg.isError
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-tl-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-sm shadow-xs'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                    </div>

                    {/* Nguồn trích dẫn RAG */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <span
                            key={`${src.documentId}-${sIdx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/70 text-[10px] font-medium"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[160px]">{src.title}</span>
                            {src.page && <span className="font-mono opacity-80">Tr.{src.page}</span>}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 font-mono">
                      <span>{msg.timestamp}</span>
                      {msg.provider && (
                        <>
                          <span>•</span>
                          <span className="uppercase tracking-wider">
                            {msg.provider === 'offline_mock' ? 'Offline CSDL' : msg.provider}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Trạng thái đang tải */}
            {isLoading && (
              <div className="flex items-center gap-2.5 text-slate-500 dark:text-slate-400">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-2xl rounded-tl-sm shadow-xs flex items-center gap-2 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Trợ lý AI đang đọc tài liệu & tổng hợp câu trả lời...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Gợi Ý Câu Hỏi Nhanh (Quick Prompts) — Tự ẩn khi đang mở Kho RAG để không ép nhỏ khung chat */}
          {showPrompts && !showRagPanel && activeQuickPrompts.length > 0 && !pendingFile && (
            <div className="px-3 py-2 bg-slate-50/90 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-1.5">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Gợi ý câu hỏi nhanh:</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {activeQuickPrompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(promptText)}
                    disabled={isLoading}
                    className="text-left text-[11px] bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-300 border border-slate-200/80 dark:border-slate-700 px-2.5 py-1 rounded-full transition-colors shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Xem trước Tệp Đính Kèm + Gợi ý thao tác nhanh cho Ảnh / PDF / Word */}
          {pendingFile && (
            <div className="px-3 py-2 bg-blue-50/70 dark:bg-blue-950/30 border-t border-blue-100 dark:border-blue-900/60 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isPendingImage && pendingPreviewUrl ? (
                    <img
                      src={pendingPreviewUrl}
                      alt={pendingFile.name}
                      className="w-10 h-10 rounded-lg object-cover border border-blue-200 dark:border-blue-800 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {pendingFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {isPendingImage ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                      <span>{isPendingImage ? 'Ảnh OCR / Dịch' : 'Tài liệu phân tích'}</span>
                      <span>•</span>
                      <span>{formatBytesShort(pendingFile.size)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isPendingImage && (
                    <button
                      type="button"
                      disabled={isUploadingRag}
                      onClick={() => handleUploadRagDocument(pendingFile)}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Lưu tài liệu này vào Kho tri thức RAG để hỏi đáp nhiều lần"
                    >
                      + Lưu Kho RAG
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearPendingAttachment}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                    title="Gỡ tệp đính kèm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(isPendingImage
                  ? [
                      'Đọc chữ trong ảnh và dịch sang Tiếng Việt',
                      'Trích xuất nguyên văn văn bản từ ảnh',
                      'Tóm tắt nội dung chính trong ảnh',
                    ]
                  : [
                      'Phân tích & rút gọn 5 ý chính của tài liệu này',
                      'Lập dàn ý chi tiết từ tài liệu này',
                      'Lọc các mốc thời gian & điều kiện quan trọng',
                    ]
                ).map((quickAction) => (
                  <button
                    key={quickAction}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSendMessage(quickAction)}
                    className="text-[11px] bg-white dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    {quickAction}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input & Gửi Tin Nhắn */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-3xl">
            <input
              ref={chatFileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.txt,.md"
              onChange={handleChatFileChange}
              className="hidden"
            />
            <div className="relative flex items-end bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-1.5 border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={isLoading}
                title="Đính kèm Ảnh (OCR/Dịch) hoặc Tài liệu (PDF, Word, TXT)"
                className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                rows={1}
                placeholder={
                  pendingFile
                    ? 'Nhập yêu cầu xử lý tệp hoặc nhấn Gửi ngay...'
                    : `Hỏi ${activeModeMeta?.name.toLowerCase()} hoặc dán ảnh (Ctrl+V)...`
                }
                className="flex-1 bg-transparent border-0 outline-none resize-none px-1.5 py-1 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 max-h-24 min-h-[32px]"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={(!inputMessage.trim() && !pendingFile) || isLoading}
                className={`p-2 rounded-xl transition-all flex-shrink-0 cursor-pointer ${
                  (inputMessage.trim() || pendingFile) && !isLoading
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                    : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
                aria-label="Gửi tin nhắn"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 px-1 font-mono">
              <span>Gemini Vision & RAG • Groq • DeepSeek</span>
              <button
                type="button"
                onClick={() => setShowPrompts((p) => !p)}
                className="text-blue-600 dark:text-blue-400 hover:underline font-sans cursor-pointer"
              >
                {showPrompts ? 'Thu gọn gợi ý' : 'Hiện gợi ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
