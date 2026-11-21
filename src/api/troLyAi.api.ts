import { apiClient, ApiResponse } from './apiClient';

export interface AIMode {
  id: 'hr_work' | 'research' | 'survey' | 'rag_doc' | 'general';
  name: string;
  description: string;
  icon?: string;
}

export interface AIProviderInfo {
  id: string;
  name: string;
  model: string;
  isConfigured: boolean;
  description: string;
}

export interface AIRagSource {
  documentId: string;
  title: string;
  page?: number | null;
  chunkIndex?: number;
  score?: number;
}

export interface AIAttachmentMeta {
  type: 'image' | 'document';
  fileName: string;
  fileType?: string;
  mimeType?: string;
  size: number;
  charCount?: number;
  isScannedPdf?: boolean;
}

export interface AIDocumentChunk {
  id: string;
  thu_tu: number;
  noi_dung_chunk: string;
  so_tu: number;
}

export interface AIDocumentItem {
  id: string;
  tieu_de: string;
  ten_tep_goc: string;
  loai_tep: 'pdf' | 'docx' | 'doc' | 'txt' | 'md';
  mime_type?: string | null;
  kich_thuoc_byte: number;
  ma_bam_sha256?: string | null;
  pham_vi: 'ca_nhan' | 'toan_truong';
  tom_tat?: string | null;
  tong_ky_tu: number;
  tong_so_doan: number;
  phuong_thuc_trich_xuat?: 'text_parser' | 'gemini_ocr';
  mo_hinh_embedding?: string;
  trang_thai: 'dang_xu_ly' | 'san_sang' | 'loi';
  thong_bao_loi?: string | null;
  duong_dan?: string | null;
  tao_luc?: string;
  cap_nhat_luc?: string;
  nguoi_tai_id?: {
    id: string;
    ho_ten?: string;
    vai_tro_chinh?: string;
  } | string;
}

export interface AIDocumentDetail extends AIDocumentItem {
  xem_truoc_phan_doan?: AIDocumentChunk[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
  provider?: string;
  model?: string;
  timestamp: string;
  isError?: boolean;
  sources?: AIRagSource[];
  attachmentPreview?: {
    type: 'image' | 'document';
    name: string;
    imageUrl?: string;
    size?: number;
  };
}

export interface AIChatPayload {
  message: string;
  mode?: string;
  history?: Array<{ role: string; content: string }>;
  provider?: string;
  model?: string;
  documentIds?: string[];
  useRag?: boolean;
  file?: File | null;
}

export interface AIChatResponseData {
  reply: string;
  mode: string;
  modeMeta?: AIMode;
  provider: string;
  model: string;
  tokens?: number;
  sources?: AIRagSource[];
  attachmentMeta?: AIAttachmentMeta | null;
  fallbackErrors?: Array<{ provider: string; error: string }>;
}

export const aiApi = {
  chat: async (payload: AIChatPayload): Promise<ApiResponse<AIChatResponseData>> => {
    if (payload.file) {
      const formData = new FormData();
      formData.append('tin_nhan', payload.message || '');
      if (payload.mode) formData.append('che_do', payload.mode);
      if (payload.history) formData.append('lich_su', JSON.stringify(payload.history));
      if (payload.provider) formData.append('nha_cung_cap', payload.provider);
      if (payload.model) formData.append('mo_hinh', payload.model);
      if (payload.documentIds && payload.documentIds.length > 0) {
        formData.append('danh_sach_tai_lieu_id', JSON.stringify(payload.documentIds));
      }
      if (payload.useRag !== undefined) {
        formData.append('dung_rag', String(payload.useRag));
      }
      formData.append('file', payload.file);

      const response = await apiClient.post<ApiResponse<AIChatResponseData>>('/tro-ly-ai/tro-chuyen', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      return response.data;
    }

    const jsonPayload = {
      tin_nhan: payload.message || '',
      ...(payload.mode ? { che_do: payload.mode } : {}),
      ...(payload.history ? { lich_su: payload.history } : {}),
      ...(payload.provider ? { nha_cung_cap: payload.provider } : {}),
      ...(payload.model ? { mo_hinh: payload.model } : {}),
      ...(payload.documentIds && payload.documentIds.length > 0
        ? { danh_sach_tai_lieu_id: payload.documentIds }
        : {}),
      ...(payload.useRag !== undefined ? { dung_rag: payload.useRag } : {}),
    };
    const response = await apiClient.post<ApiResponse<AIChatResponseData>>('/tro-ly-ai/tro-chuyen', jsonPayload, {
      timeout: 45000,
    });
    return response.data;
  },

  getModes: async (): Promise<
    ApiResponse<{ modes: AIMode[]; quickPrompts: Record<string, string[]>; defaultMode: string }>
  > => {
    const response = await apiClient.get<
      ApiResponse<{ modes: AIMode[]; quickPrompts: Record<string, string[]>; defaultMode: string }>
    >('/tro-ly-ai/che-do');
    return response.data;
  },

  getProviders: async (): Promise<
    ApiResponse<{ defaultProvider: string; providers: AIProviderInfo[] }>
  > => {
    const response = await apiClient.get<
      ApiResponse<{ defaultProvider: string; providers: AIProviderInfo[] }>
    >('/tro-ly-ai/nha-cung-cap');
    return response.data;
  },

  getDocuments: async (): Promise<
    ApiResponse<{ documents: AIDocumentItem[]; canUploadSchoolWide: boolean }>
  > => {
    const response = await apiClient.get<
      ApiResponse<{ documents: AIDocumentItem[]; canUploadSchoolWide: boolean }>
    >('/tro-ly-ai/tai-lieu');
    return response.data;
  },

  uploadDocument: async (
    file: File,
    options?: { title?: string; scope?: 'ca_nhan' | 'toan_truong' }
  ): Promise<ApiResponse<AIDocumentItem>> => {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.title?.trim()) formData.append('tieu_de', options.title.trim());
    if (options?.scope) formData.append('pham_vi', options.scope);

    const response = await apiClient.post<ApiResponse<AIDocumentItem>>('/tro-ly-ai/tai-lieu', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return response.data;
  },

  getDocumentDetail: async (id: string): Promise<ApiResponse<AIDocumentDetail>> => {
    const response = await apiClient.get<ApiResponse<AIDocumentDetail>>(`/tro-ly-ai/tai-lieu/${id}`);
    return response.data;
  },

  deleteDocument: async (
    id: string
  ): Promise<ApiResponse<{ deletedId: string; tieu_de: string }>> => {
    const response = await apiClient.delete<
      ApiResponse<{ deletedId: string; tieu_de: string }>
    >(`/tro-ly-ai/tai-lieu/${id}`);
    return response.data;
  },
};
