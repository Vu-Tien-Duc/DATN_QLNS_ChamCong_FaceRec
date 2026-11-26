import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, RefreshCw, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { attendanceApi } from '../../../api/chamCong.api';
import { Card, CardContent } from '../../../components/chung/TheThongTin';
import { Button } from '../../../components/chung/NutBam';

interface BangDieuKhienAiVaHangDoiProps {
  selectedGroup?: string;
}

export const BangDieuKhienAiVaHangDoi: React.FC<BangDieuKhienAiVaHangDoiProps> = ({
  selectedGroup = 'ALL',
}) => {
  const [vectorStats, setVectorStats] = useState<any>(null);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const loadRuntimeStats = useCallback(async () => {
    try {
      const [v, q] = await Promise.all([
        attendanceApi.getVectorIndexStats().catch(() => null),
        attendanceApi.getQueueStats().catch(() => null),
      ]);
      if (v) setVectorStats(v);
      if (q) setQueueStats(q);
    } catch {
      // ignore initial load error
    }
  }, []);

  useEffect(() => {
    loadRuntimeStats();
  }, [loadRuntimeStats]);

  const handleSyncVector = async () => {
    setSyncing(true);
    try {
      const res = await attendanceApi.syncVectorIndex();
      setVectorStats(res?.stats || res);
      toast.success('Đã đồng bộ lại Vector Index khuôn mặt trong RAM!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đồng bộ Vector Index thất bại.');
    } finally {
      setSyncing(false);
    }
  };

  const showVectorAndQueue =
    selectedGroup === 'ALL' || selectedGroup === 'AI' || selectedGroup === 'HE_THONG';

  if (!showVectorAndQueue) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 mt-6">
      {showVectorAndQueue && (
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trạng Thái Vector Index & Hàng Đợi BullMQ
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đồng bộ cache nhận diện 512D trong RAM và theo dõi job chấm công
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />}
              onClick={handleSyncVector}
              disabled={syncing}
            >
              Đồng Bộ RAM
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 dark:text-slate-400">Tổng Vector RAM</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {vectorStats?.total_vectors ??
                  vectorStats?.stats?.total_vectors ??
                  vectorStats?.totalVectors ??
                  0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Hàng đợi BullMQ
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                {queueStats ? `Đang chờ: ${queueStats.waiting ?? 0} | Lỗi: ${queueStats.failed ?? 0}` : 'Chế độ Fallback'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
};
