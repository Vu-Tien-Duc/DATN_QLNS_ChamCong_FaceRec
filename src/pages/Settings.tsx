import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  MapPin,
  DollarSign,
  Receipt,
  GraduationCap,
  Briefcase,
  Clock,
  Server,
  Layers,
  Edit3,
  X,
  Code2,
  Copy,
  Check,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { Portal } from '../components/ui/Portal';
import { Badge } from '../components/ui/Badge';
import {
  systemConfigApi,
  SystemConfigItem,
} from '../api/systemConfig.api';

// =============================================================================
// GROUP METADATA & HELPER FORMATTERS
// =============================================================================

interface GroupMeta {
  label: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

const GROUP_METAS: Record<string, GroupMeta> = {
  ALL: {
    label: 'Tất Cả Tham Số',
    icon: Layers,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
  },
  AI: {
    label: 'Trí Tuệ Nhân Tạo (AI)',
    icon: Cpu,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/40',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  GPS: {
    label: 'Định Vị & Geofence',
    icon: MapPin,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  TIEN_LUONG: {
    label: 'Tài Chính & Lương',
    icon: DollarSign,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  THUE: {
    label: 'Thuế TNCN',
    icon: Receipt,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
  },
  DAO_TAO: {
    label: 'Đào Tạo & Học Kỳ',
    icon: GraduationCap,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  CHUC_VU: {
    label: 'Chức Vụ & Phụ Cấp',
    icon: Briefcase,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 dark:bg-teal-950/40',
    borderColor: 'border-teal-200 dark:border-teal-800',
  },
  CHAM_CONG: {
    label: 'Quy Chế Điểm Danh',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  HE_THONG: {
    label: 'Hạ Tầng & Vận Hành',
    icon: Server,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
  SYSTEM: {
    label: 'Hệ Thống Chung',
    icon: Server,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
  },
};

function formatCurrencyVN(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '--';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
}

function formatDateTimeVN(isoStr?: string): string {
  if (!isoStr) return '--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================================
// MAIN COMPONENT: Settings
// =============================================================================

export const Settings: React.FC = () => {
  const { user } = useAuthStore();

  // Data States
  const [configs, setConfigs] = useState<SystemConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Draft edits map: key -> modified value
  const [draftValues, setDraftValues] = useState<Record<string, any>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [isBulkSaving, setIsBulkSaving] = useState<boolean>(false);

  // Filters
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // JSON Modal State
  const [editingModalConfig, setEditingModalConfig] = useState<SystemConfigItem | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await systemConfigApi.getConfigs();
      setConfigs(data || []);

      // Khởi tạo draftValues từ server data
      const initialDraft: Record<string, any> = {};
      (data || []).forEach((c) => {
        initialDraft[c.key] = c.value;
      });
      setDraftValues(initialDraft);
    } catch (err: any) {
      console.error('Lỗi khi tải cấu hình hệ thống:', err);
      toast.error(err.response?.data?.message || 'Không thể tải danh sách cấu hình hệ thống.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  // =============================================================================
  // FILTERED CONFIGS & KPIS
  // =============================================================================

  const filteredConfigs = useMemo(() => {
    return configs.filter((c) => {
      // Group filter
      if (selectedGroup !== 'ALL') {
        const groupNorm = (c.group || 'SYSTEM').toUpperCase();
        if (groupNorm !== selectedGroup) return false;
      }

      // Keyword search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const matchKey = (c.key || '').toLowerCase().includes(kw);
        const matchDesc = (c.description || '').toLowerCase().includes(kw);
        const matchVal = JSON.stringify(c.value || '').toLowerCase().includes(kw);
        if (!matchKey && !matchDesc && !matchVal) return false;
      }

      return true;
    });
  }, [configs, selectedGroup, searchKeyword]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = configs.length;
    let baseSalary = 2530000;
    let gpsRadius = 150;
    let aiModel = 'buffalo_s';
    let cosineMin = 0.45;

    configs.forEach((c) => {
      if (c.key === 'LUONG_CO_SO') {
        if (typeof c.value === 'number') baseSalary = c.value;
      } else if (c.key === 'GEOFENCE_TRUONG') {
        if (c.value?.radiusMeters) gpsRadius = c.value.radiusMeters;
        else if (c.value?.ban_kinh_met) gpsRadius = c.value.ban_kinh_met;
      } else if (c.key === 'NGUONG_AI') {
        if (c.value?.model) aiModel = c.value.model;
        if (c.value?.minCosine) cosineMin = c.value.minCosine;
      }
    });

    return {
      totalCount,
      baseSalary,
      gpsRadius,
      aiModel,
      cosineMin,
    };
  }, [configs]);

  // Kiểm tra xem có cấu hình nào bị sửa đổi so với server không
  const hasUnsavedChanges = useMemo(() => {
    return configs.some((c) => {
      return JSON.stringify(draftValues[c.key]) !== JSON.stringify(c.value);
    });
  }, [configs, draftValues]);

  // =============================================================================
  // HANDLERS: UPDATE CONFIG
  // =============================================================================

  const handleValueChange = (key: string, newValue: any) => {
    setDraftValues((prev) => ({
      ...prev,
      [key]: newValue,
    }));
  };

  const handleSaveSingleConfig = async (config: SystemConfigItem) => {
    const key = config.key;
    const value = draftValues[key];

    setSavingKeys((prev) => ({ ...prev, [key]: true }));
    try {
      await systemConfigApi.updateConfig(key, value);
      toast.success(`Cập nhật cấu hình "${key}" thành công!`);
      // Cập nhật lại trong mảng configs cục bộ
      setConfigs((prev) =>
        prev.map((c) => (c.key === key ? { ...c, value, updatedAt: new Date().toISOString() } : c))
      );
    } catch (err: any) {
      console.error(`Lỗi khi lưu cấu hình ${key}:`, err);
      toast.error(err.response?.data?.message || `Không thể lưu cấu hình "${key}".`);
    } finally {
      setSavingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSaveAllChanges = async () => {
    const changedConfigs: Array<{ key: string; value: any }> = [];

    configs.forEach((c) => {
      if (JSON.stringify(draftValues[c.key]) !== JSON.stringify(c.value)) {
        changedConfigs.push({ key: c.key, value: draftValues[c.key] });
      }
    });

    if (changedConfigs.length === 0) {
      toast('Không có thay đổi nào cần lưu.', { icon: 'ℹ️' });
      return;
    }

    setIsBulkSaving(true);
    try {
      await systemConfigApi.bulkUpdateConfigs(changedConfigs);
      toast.success(`Đã lưu thành công ${changedConfigs.length} cấu hình hệ thống!`);
      fetchConfigs();
    } catch (err: any) {
      console.error('Lỗi khi lưu hàng loạt cấu hình:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu thay đổi cấu hình.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleExportJSON = () => {
    const exportData = configs.reduce((acc: any, cur) => {
      acc[cur.key] = {
        value: draftValues[cur.key] !== undefined ? draftValues[cur.key] : cur.value,
        group: cur.group,
        description: cur.description,
      };
      return acc;
    }, {});

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SystemConfig_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file cấu hình JSON thành công!');
  };

  // =============================================================================
  // JSON MODAL EDITOR
  // =============================================================================

  const openJsonEditor = (config: SystemConfigItem) => {
    setEditingModalConfig(config);
    const val = draftValues[config.key] !== undefined ? draftValues[config.key] : config.value;
    setJsonText(JSON.stringify(val, null, 2));
    setJsonError(null);
  };

  const handleJsonModalSave = () => {
    if (!editingModalConfig) return;
    try {
      const parsed = JSON.parse(jsonText);
      handleValueChange(editingModalConfig.key, parsed);
      setEditingModalConfig(null);
      toast.success(`Đã cập nhật giá trị JSON cho "${editingModalConfig.key}". Hãy nhấn Lưu Cấu Hình để hoàn tất.`);
    } catch (e: any) {
      setJsonError(`Lỗi cú pháp JSON: ${e.message}`);
    }
  };

  // =============================================================================
  // RENDER CONFIG INPUT ITEM
  // =============================================================================

  const renderConfigEditor = (config: SystemConfigItem) => {
    const currentVal = draftValues[config.key] !== undefined ? draftValues[config.key] : config.value;
    const isDirty = JSON.stringify(currentVal) !== JSON.stringify(config.value);

    // 1. Boolean (Switch)
    if (typeof currentVal === 'boolean') {
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {currentVal ? 'BẬT (True / Kích Hoạt)' : 'TẮT (False / Vô Hiệu Hóa)'}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={currentVal}
              onChange={(e) => handleValueChange(config.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      );
    }

    // 2. Number đơn giản
    if (typeof currentVal === 'number') {
      let unit = '';
      if (config.key.includes('LUONG') || config.key.includes('GIO')) unit = 'VNĐ';
      else if (config.key.includes('RADIUS') || config.key.includes('MET')) unit = 'mét';
      else if (config.key.includes('PHUT') || config.key.includes('MINUTES')) unit = 'phút';
      else if (config.key.includes('GIAY')) unit = 'giây';
      else if (config.key.includes('NAM')) unit = 'năm';

      return (
        <div className="space-y-1.5">
          <div className="relative">
            <input
              type="number"
              step={config.key.includes('THRESHOLD') || config.key.includes('MARGIN') ? '0.01' : '1'}
              value={currentVal}
              onChange={(e) => handleValueChange(config.key, parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2 text-sm font-semibold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {unit && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                {unit}
              </span>
            )}
          </div>
          {unit === 'VNĐ' && (
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold pl-1">
              ≈ {formatCurrencyVN(currentVal)}
            </p>
          )}
        </div>
      );
    }

    // 3. String đơn giản
    if (typeof currentVal === 'string') {
      return (
        <input
          type="text"
          value={currentVal}
          onChange={(e) => handleValueChange(config.key, e.target.value)}
          className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
        />
      );
    }

    // 4. Object hoặc Array phức tạp (HOC_KY, GEOFENCE_TRUONG, BIEU_THUE_5_BAC, v.v.)
    return (
      <div className="space-y-2">
        <div className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-32 border border-slate-800">
          <pre className="whitespace-pre-wrap">{JSON.stringify(currentVal, null, 2)}</pre>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => openJsonEditor(config)}
          className="w-full text-xs flex items-center justify-center gap-1.5 border-dashed"
        >
          <Code2 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Mở Trình Soạn Thảo Chi Tiết (JSON Editor)</span>
        </Button>
      </div>
    );
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* 1. HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          Cấu Hình 19 Tham Số Hệ Thống Tập Trung
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            CSDL v2.5
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Quản trị toàn bộ tham số vận hành: Ngưỡng AI, Geofence GPS, Lương cơ sở 2.53tr, Thuế TNCN và Thời hạn lưu trữ.
        </p>
      </div>

      {/* 2. BỘ 4 THẺ KPI CẤU HÌNH TỔNG QUAN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Tổng tham số */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-400 dark:hover:border-indigo-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tổng Số Tham Số
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {kpis.totalCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">/ 19 tham số quy định</span>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Đồng bộ 100% CSDL v2.5</span>
          </div>
        </div>

        {/* KPI 2: Mức lương cơ sở */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-400 dark:hover:border-amber-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Lương Cơ Sở Nội Bộ
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {formatCurrencyVN(kpis.baseSalary)}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Khóa: <code className="font-mono text-amber-700 dark:text-amber-300">LUONG_CO_SO</code>
          </div>
        </div>

        {/* KPI 3: Ngưỡng AI InsightFace */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-purple-400 dark:hover:border-purple-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Ngưỡng AI Khớp Mặt
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              {kpis.cosineMin}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Cosine min (512-dim)</span>
          </div>
          <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
            Mô hình: {kpis.aiModel} (FAR = 0.00%)
          </div>
        </div>

        {/* KPI 4: Geofence GPS Trụ sở chính */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-400 dark:hover:border-emerald-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Bán Kính Geofence GPS
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {kpis.gpsRadius} m
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Trụ sở chính DNT</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Thuật toán Haversine Formula
          </div>
        </div>
      </div>

      {/* 3. TABS PHÂN NHÓM & BỘ LỌC TÌM KIẾM */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Search Bar & Action Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm tham số theo mã khóa, mô tả chức năng hoặc giá trị..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfigs}
              disabled={isLoading}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm Mới</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              disabled={configs.length === 0}
              className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <Download className="w-4 h-4" />
              <span>Xuất JSON Backup</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAllChanges}
              disabled={!hasUnsavedChanges || isBulkSaving}
              className={`flex items-center gap-1.5 text-white shadow-md transition-all ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20 animate-pulse'
                  : 'bg-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className={`w-4 h-4 ${isBulkSaving ? 'animate-spin' : ''}`} />
              <span>{isBulkSaving ? 'Đang Lưu...' : 'Lưu Toàn Bộ Thay Đổi'}</span>
            </Button>
          </div>
        </div>

        {/* Group Tabs & Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Object.entries(GROUP_METAS).map(([groupKey, meta]) => {
            const Icon = meta.icon;
            const isSelected = selectedGroup === groupKey;

            return (
              <button
                key={groupKey}
                onClick={() => setSelectedGroup(groupKey)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1.5 self-end sm:self-auto">
          <span>Hiển thị <b>{filteredConfigs.length}</b> / {configs.length} tham số</span>
        </div>
      </div>
    </div>

      {/* 4. CONFIG CARDS GRID */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-3 animate-spin">
            <RefreshCw className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Đang tải dữ liệu 19 tham số cấu hình hệ thống...
          </p>
        </div>
      ) : filteredConfigs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Không tìm thấy tham số cấu hình nào
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            Không có kết quả nào khớp với nhóm cấu hình hoặc từ khóa tìm kiếm hiện tại.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConfigs.map((config) => {
            const groupNorm = (config.group || 'SYSTEM').toUpperCase();
            const meta = GROUP_METAS[groupNorm] || GROUP_METAS.SYSTEM;
            const Icon = meta.icon;

            const currentVal = draftValues[config.key] !== undefined ? draftValues[config.key] : config.value;
            const isDirty = JSON.stringify(currentVal) !== JSON.stringify(config.value);
            const isSaving = savingKeys[config.key] || false;

            return (
              <div
                key={config._id || config.key}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                  isDirty
                    ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bgColor} ${meta.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate max-w-[190px]">
                          {config.key}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    {isDirty && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 shrink-0">
                        Chưa Lưu
                      </span>
                    )}
                  </div>

                  {/* Mô tả chức năng */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 min-h-[36px] line-clamp-2 mt-2 leading-relaxed">
                    {config.description || 'Tham số cấu hình hệ thống vận hành trường.'}
                  </p>

                  {/* Input Editor */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Giá Trị Cấu Hình:
                    </label>
                    {renderConfigEditor(config)}
                  </div>
                </div>

                {/* Card Footer: Metadata & Save button */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    Cập nhật: {formatDateTimeVN(config.updatedAt)}
                  </div>

                  <Button
                    size="sm"
                    disabled={!isDirty || isSaving}
                    onClick={() => handleSaveSingleConfig(config)}
                    className={`text-xs px-3 py-1 flex items-center gap-1 ${
                      isDirty
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Save className={`w-3 h-3 ${isSaving ? 'animate-spin' : ''}`} />
                    <span>{isSaving ? 'Đang lưu...' : 'Lưu'}</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================================= */}
      {/* 5. MODAL: TRÌNH SOẠN THẢO JSON CHI TIẾT */}
      {/* ============================================================================= */}
      {editingModalConfig && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Trình Soạn Thảo JSON: <code className="font-mono text-indigo-600 dark:text-indigo-400">{editingModalConfig.key}</code>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {editingModalConfig.description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingModalConfig(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Chỉnh sửa cấu trúc JSON hợp lệ:</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const formatted = JSON.stringify(JSON.parse(jsonText), null, 2);
                      setJsonText(formatted);
                      setJsonError(null);
                    } catch (e: any) {
                      setJsonError(`Lỗi cú pháp: ${e.message}`);
                    }
                  }}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
                >
                  Tự động căn chỉnh JSON
                </button>
              </div>

              <textarea
                rows={14}
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setJsonError(null);
                  } catch (err: any) {
                    setJsonError(err.message);
                  }
                }}
                className={`w-full p-3 font-mono text-xs rounded-xl bg-slate-900 text-slate-100 border focus:outline-none ${
                  jsonError ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
                }`}
              />

              {jsonError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{jsonError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button variant="outline" onClick={() => setEditingModalConfig(null)}>
                Hủy Bỏ
              </Button>
              <Button
                disabled={Boolean(jsonError)}
                onClick={handleJsonModalSave}
                className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
              >
                Áp Dụng Thay Đổi
              </Button>
            </div>
          </div>
        </div>
      </Portal>
    )}
    </div>
  );
};
