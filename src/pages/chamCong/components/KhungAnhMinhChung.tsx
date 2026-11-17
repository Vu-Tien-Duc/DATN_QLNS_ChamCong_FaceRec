import React, { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { attendanceApi } from '../../../api/chamCong.api';

interface KhungAnhMinhChungProps {
  logId: string;
  initialUrl?: string;
  checkInTimeText: string;
  resolveMediaUrl: (url?: string) => string;
}

export const KhungAnhMinhChung: React.FC<KhungAnhMinhChungProps> = ({
  logId,
  initialUrl,
  checkInTimeText,
  resolveMediaUrl,
}) => {
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>(initialUrl ? [initialUrl] : []);
  const [loading, setLoading] = useState(false);
  const [brokenMap, setBrokenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    setEvidenceUrls(initialUrl ? [initialUrl] : []);
    setBrokenMap({});

    if (!logId) return;
    setLoading(true);
    attendanceApi
      .getAttendanceEvidence(logId)
      .then((res: any) => {
        if (!active || !res) return;
        const urls: string[] = [];
        if (res.anh_minh_chung || res.evidenceUrl || res.url) {
          urls.push(res.anh_minh_chung || res.evidenceUrl || res.url);
        }
        if (Array.isArray(res.luot_quet || res.punches || res.items)) {
          const arr = res.luot_quet || res.punches || res.items;
          arr.forEach((p: any) => {
            const u = p?.anh_minh_chung || p?.evidencePhoto || p?.capturedImage;
            if (u && !urls.includes(u)) urls.push(u);
          });
        }
        if (urls.length > 0) setEvidenceUrls(urls);
      })
      .catch(() => {
        // Fallback to initialUrl if evidence endpoint has no records
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [logId, initialUrl]);

  const validUrls = evidenceUrls.filter((u) => !brokenMap[u]);

  if (loading && validUrls.length === 0) {
    return (
      <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-400 text-xs flex items-center justify-center gap-2">
        <Camera className="w-4 h-4 animate-pulse" />
        Đang tải ảnh minh chứng...
      </div>
    );
  }

  if (validUrls.length === 0) {
    return (
      <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
        Không có ảnh minh chứng cho lượt chấm công này.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {validUrls.map((url, idx) => (
        <div
          key={`${url}-${idx}`}
          className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black flex items-center justify-center max-h-72"
        >
          <img
            src={resolveMediaUrl(url)}
            alt={`Ảnh minh chứng ${idx + 1}`}
            className="max-h-72 w-auto object-contain"
            onError={() => setBrokenMap((prev) => ({ ...prev, [url]: true }))}
          />
          <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-mono">
            Thời điểm: {checkInTimeText}
          </div>
        </div>
      ))}
    </div>
  );
};
