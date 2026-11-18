import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bot,
  KeyRound,
  Database,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  FileText,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { aiApi, AIDocumentDetail, AIDocumentItem, AIProviderInfo } from '../../../api/troLyAi.api';
import { systemConfigApi } from '../../../api/cauHinhHeThong.api';
import { Card, CardContent } from '../../../components/chung/TheThongTin';
import { Button } from '../../../components/chung/NutBam';
import { Portal } from '../../../components/chung/CongDichChuyen';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const QuanLyAiVaTaiLieuRag: React.FC = () => {
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [defaultProvider, setDefaultProvider] = useState('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [showKeys, setShowKeys] = useState(false);
  const [savingAiConfig, setSavingAiConfig] = useState(false);

  const [documents, setDocuments] = useState<AIDocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadScope, setUploadScope] = useState<'toan_truong' | 'ca_nhan'>('toan_truong');
  const [selectedDocDetail, setSelectedDocDetail] = useState<AIDocumentDetail | null>(null);
  const [loadingDocDetail, setLoadingDocDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAiSettingsAndDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const [provRes, cfgList, docRes] = await Promise.all([
        aiApi.getProviders().catch(() => null),
        systemConfigApi.getConfigs().catch(() => []),
        aiApi.getDocuments().catch(() => null),
      ]);

      if (provRes?.success && provRes.data) {
        setProviders(provRes.data.providers || []);
        if (provRes.data.defaultProvider) {
          setDefaultProvider(provRes.data.defaultProvider);
        }
      }

      const map: Record<string, string> = {};
      for (const item of cfgList) {
        const k = String(item.key || item.khoa_cau_hinh || '').toUpperCase();
        if (k) map[k] = String(item.value ?? item.gia_tri ?? '');
      }
      if (map.AI_DEFAULT_PROVIDER) setDefaultProvider(map.AI_DEFAULT_PROVIDER);
      if (map.GEMINI_API_KEY) setGeminiKey(map.GEMINI_API_KEY);
      if (map.GEMINI_MODEL) setGeminiModel(map.GEMINI_MODEL);
      if (map.GROQ_API_KEY) setGroqKey(map.GROQ_API_KEY);
      if (map.GROQ_MODEL) setGroqModel(map.GROQ_MODEL);
      if (map.DEEPSEEK_API_KEY) setDeepseekKey(map.DEEPSEEK_API_KEY);
      if (map.DEEPSEEK_MODEL) setDeepseekModel(map.DEEPSEEK_MODEL);

      if (docRes?.success && docRes.data) {
        setDocuments(docRes.data.documents || []);
      }
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadAiSettingsAndDocs();
  }, [loadAiSettingsAndDocs]);

  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAiConfig(true);
    try {
      const payload: Array<{ key: string; value: string }> = [
        { key: 'AI_DEFAULT_PROVIDER', value: defaultProvider },
        { key: 'GEMINI_MODEL', value: geminiModel.trim() || 'gemini-2.5-flash' },
        { key: 'GROQ_MODEL', value: groqModel.trim() || 'llama-3.3-70b-versatile' },
        { key: 'DEEPSEEK_MODEL', value: deepseekModel.trim() || 'deepseek-chat' },
      ];
      if (geminiKey.trim()) payload.push({ key: 'GEMINI_API_KEY', value: geminiKey.trim() });
      if (groqKey.trim()) payload.push({ key: 'GROQ_API_KEY', value: groqKey.trim() });
      if (deepseekKey.trim()) payload.push({ key: 'DEEPSEEK_API_KEY', value: deepseekKey.trim() });

      await systemConfigApi.bulkUpdateConfigs(payload);
      const provRes = await aiApi.getProviders();
      if (provRes?.success && provRes.data) {
        setProviders(provRes.data.providers || []);
      }
      toast.success('Đã lưu cấu hình Model AI & API Key vào hệ thống!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lưu cấu hình AI thất bại.');
    } finally {
      setSavingAiConfig(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Tài liệu RAG tối đa 10MB.');
      return;
    }
    setUploadingDoc(true);
    try {
      const res = await aiApi.uploadDocument(file, { scope: uploadScope });
      if (res.success && res.data) {
        setDocuments((prev) => [res.data, ...prev]);
        toast.success(`Đã nạp tài liệu "${res.data.tieu_de}" vào Kho tri thức RAG!`);
      } else {
        toast.error(res.message || 'Nạp tài liệu thất bại.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải tài liệu lên Kho RAG.');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (doc: AIDocumentItem) => {
    if (!window.confirm(`Xóa tài liệu "${doc.tieu_de}" khỏi Kho tri thức RAG?`)) return;
    try {
      const res = await aiApi.deleteDocument(doc._id);
      if (res.success) {
        setDocuments((prev) => prev.filter((d) => d._id !== doc._id));
        if (selectedDocDetail?._id === doc._id) setSelectedDocDetail(null);
        toast.success('Đã xóa tài liệu khỏi Kho tri thức RAG.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xóa tài liệu.');
    }
  };

  const handleViewDocumentChunks = async (doc: AIDocumentItem) => {
    const docId = doc._id || (doc as any).id;
    setSelectedDocDetail(doc);
    setLoadingDocDetail(true);
    try {
      const res = await aiApi.getDocumentDetail(docId);
      if (res.success && res.data) {
        setSelectedDocDetail(res.data);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải các phân đoạn tài liệu.');
    } finally {
      setLoadingDocDetail(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* 1. Cấu hình liên kết Model AI & API Key */}
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSaveAiConfig} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Liên Kết Model AI &amp; Cấu Hình API Key
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quản lý kết nối Gemini, Groq, DeepSeek cho Trợ lý AI toàn trường
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeys((p) => !p)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                {showKeys ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showKeys ? 'Ẩn Key' : 'Hiện Key'}</span>
              </button>
            </div>

            {/* Trạng thái các nhà cung cấp */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-xl border text-xs ${
                    p.isConfigured
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                    <span className="truncate">{p.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        p.isConfigured ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {p.model}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nhà cung cấp AI mặc định
                </label>
                <select
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="gemini">Google Gemini (Khuyên dùng - Hỗ trợ OCR Ảnh &amp; RAG)</option>
                  <option value="groq">Groq Cloud (Llama 3.3 Tốc độ cao)</option>
                  <option value="deepseek">DeepSeek AI</option>
                  <option value="offline_mock">Offline CSDL Engine (Nội bộ)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Google Gemini API Key
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showKeys ? 'text' : 'password'}
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy... (Để trống nếu giữ nguyên key trong .env)"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Model Gemini
                  </label>
                  <input
                    type="text"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    placeholder="gemini-2.5-flash"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Groq Cloud API Key
                  </label>
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_... (Tùy chọn)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Model Groq
                  </label>
                  <input
                    type="text"
                    value={groqModel}
                    onChange={(e) => setGroqModel(e.target.value)}
                    placeholder="llama-3.3-70b-versatile"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    DeepSeek API Key
                  </label>
                  <input
                    type={showKeys ? 'text' : 'password'}
                    value={deepseekKey}
                    onChange={(e) => setDeepseekKey(e.target.value)}
                    placeholder="sk-... (Tùy chọn)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Model DeepSeek
                  </label>
                  <input
                    type="text"
                    value={deepseekModel}
                    onChange={(e) => setDeepseekModel(e.target.value)}
                    placeholder="deepseek-chat"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={savingAiConfig}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                {savingAiConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Model AI'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Quản lý Kho Tài Liệu Tri Thức RAG (tai_lieu_rag & phan_doan_tai_lieu) */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Kho Tài Liệu Tri Thức RAG ({documents.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Nạp quy chế, văn bản PDF/Word để Trợ lý AI tự động tra cứu &amp; trích dẫn
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={uploadScope}
                onChange={(e) => setUploadScope(e.target.value as 'toan_truong' | 'ca_nhan')}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5"
              >
                <option value="toan_truong">Phạm vi: Toàn trường</option>
                <option value="ca_nhan">Phạm vi: Cá nhân</option>
              </select>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadDocument(f);
                }}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                disabled={uploadingDoc}
                onClick={() => fileInputRef.current?.click()}
                leftIcon={
                  uploadingDoc ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )
                }
              >
                {uploadingDoc ? 'Đang băm vector...' : 'Tải Tài Liệu RAG'}
              </Button>
            </div>
          </div>

          {loadingDocs ? (
            <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách tài liệu RAG...
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              Chưa có tài liệu nào trong Kho tri thức RAG. Hãy nhấn <strong>Tải Tài Liệu RAG</strong> để nạp PDF, Word hoặc TXT.
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {documents.map((doc) => {
                const chunkCount = Number(doc.tong_so_doan ?? (doc as any).so_doan ?? 0);
                return (
                  <div
                    key={doc._id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {doc.trang_thai === 'loi' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {doc.tieu_de}
                        </p>
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                            doc.pham_vi === 'toan_truong'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {doc.pham_vi === 'toan_truong' ? 'Toàn trường' : 'Cá nhân'}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-mono font-semibold">{doc.loai_tep}</span>
                        {doc.mime_type && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px]">{doc.mime_type}</span>
                          </>
                        )}
                        {chunkCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{chunkCount} đoạn vector</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{formatBytes(doc.kich_thuoc_byte)}</span>
                        {doc.ma_bam_sha256 && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[10px]" title={`SHA-256: ${doc.ma_bam_sha256}`}>
                              SHA: {doc.ma_bam_sha256.slice(0, 10)}…
                            </span>
                          </>
                        )}
                        {((doc as any).nguoi_tai?.ho_ten ||
                          (typeof doc.nguoi_tai_id === 'object' && doc.nguoi_tai_id?.ho_ten)) && (
                          <>
                            <span>•</span>
                            <span>
                              Người tải:{' '}
                              {(doc as any).nguoi_tai?.ho_ten ||
                                (typeof doc.nguoi_tai_id === 'object' ? doc.nguoi_tai_id?.ho_ten : '')}
                            </span>
                          </>
                        )}
                      </div>
                      {doc.trang_thai === 'loi' && doc.thong_bao_loi && (
                        <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg px-2 py-1">
                          Lỗi xử lý: {doc.thong_bao_loi}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleViewDocumentChunks(doc)}
                        title="Xem các phân đoạn đã băm vector"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc)}
                        title="Xóa tài liệu RAG"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDocDetail && (
        <Portal>
          <div
            onClick={() => setSelectedDocDetail(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedDocDetail.tieu_de}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {selectedDocDetail.ten_tep_goc} • {selectedDocDetail.tong_so_doan || 0} phân đoạn •{' '}
                      {selectedDocDetail.tong_ky_tu || 0} ký tự
                      {((selectedDocDetail as any).nguoi_tai?.ho_ten ||
                        (typeof selectedDocDetail.nguoi_tai_id === 'object' && selectedDocDetail.nguoi_tai_id?.ho_ten))
                        ? ` • Người tải: ${
                            (selectedDocDetail as any).nguoi_tai?.ho_ten ||
                            (typeof selectedDocDetail.nguoi_tai_id === 'object'
                              ? selectedDocDetail.nguoi_tai_id?.ho_ten
                              : '')
                          }`
                        : ''}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDocDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3 text-xs">
                {selectedDocDetail.trang_thai === 'loi' && selectedDocDetail.thong_bao_loi && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300">
                    <span className="font-bold block mb-0.5">Thông báo lỗi trích xuất / embedding:</span>
                    {selectedDocDetail.thong_bao_loi}
                  </div>
                )}
                {(selectedDocDetail.mime_type || selectedDocDetail.ma_bam_sha256) && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 font-sans block">MIME Type:</span>
                      <span className="text-slate-700 dark:text-slate-200">{selectedDocDetail.mime_type || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-sans block">SHA-256:</span>
                      <span className="text-slate-700 dark:text-slate-200 break-all">{selectedDocDetail.ma_bam_sha256 || '—'}</span>
                    </div>
                  </div>
                )}
                {selectedDocDetail.tom_tat && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <span className="font-semibold text-slate-900 dark:text-white block mb-1">Tóm tắt tài liệu:</span>
                    {selectedDocDetail.tom_tat}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>
                    Các phân đoạn vector ({selectedDocDetail.xem_truoc_phan_doan?.length || 0}/
                    {selectedDocDetail.tong_so_doan || 0})
                  </span>
                  {selectedDocDetail.mo_hinh_embedding && (
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedDocDetail.mo_hinh_embedding}
                    </span>
                  )}
                </div>

                {loadingDocDetail ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải phân đoạn nội dung...</span>
                  </div>
                ) : !selectedDocDetail.xem_truoc_phan_doan?.length ? (
                  <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                    Chưa có phân đoạn nội dung nào được lưu cho tài liệu này.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedDocDetail.xem_truoc_phan_doan.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                          <span>Đoạn #{Number(chunk.thu_tu ?? 0) + 1}</span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">{chunk.so_tu || 0} từ</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {chunk.noi_dung_chunk}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
