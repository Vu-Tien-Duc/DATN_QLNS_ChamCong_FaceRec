import React, { useEffect, useState, useCallback } from 'react';
import { Cpu, RefreshCw, MapPin, Layers } from 'lucide-react';
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
  const [viDo, setViDo] = useState('20.9752');
  const [kinhDo, setKinhDo] = useState('105.7628');
  const [banKinh, setBanKinh] = useState('150');
  const [syncing, setSyncing] = useState(false);
  const [savingCampus, setSavingCampus] = useState(false);

  const loadRuntimeStats = useCallback(async () => {
    try {
      const [v, q, c] = await Promise.all([
        attendanceApi.getVectorIndexStats().catch(() => null),
        attendanceApi.getQueueStats().catch(() => null),
        attendanceApi.getCampusConfig().catch(() => null),
      ]);
      if (v) setVectorStats(v);
      if (q) setQueueStats(q);
      if (c) {
        if (c.vi_do !== undefined && c.vi_do !== null) setViDo(String(c.vi_do));
        if (c.kinh_do !== undefined && c.kinh_do !== null) setKinhDo(String(c.kinh_do));
        if (c.ban_kinh_met !== undefined && c.ban_kinh_met !== null) {
          setBanKinh(String(c.ban_kinh_met));
        }
      }
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

  const handleSaveCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCampus(true);
    try {
      await attendanceApi.updateCampusConfig({
        vi_do: Number(viDo),
        kinh_do: Number(kinhDo),
        ban_kinh_met: Number(banKinh),
      });
      toast.success('Đã cập nhật tọa độ Geofence khuôn viên trường!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Cập nhật tọa độ khuôn viên thất bại.');
    } finally {
      setSavingCampus(false);
    }
  };

  const showVectorAndQueue =
    selectedGroup === 'ALL' || selectedGroup === 'AI' || selectedGroup === 'HE_THONG';
  const showCampusGps = selectedGroup === 'ALL' || selectedGroup === 'GPS';

  if (!showVectorAndQueue && !showCampusGps) {
    return null;
  }

  return (
    <div className={`grid grid-cols-1 ${showVectorAndQueue && showCampusGps ? 'lg:grid-cols-2' : ''} gap-4 mt-6`}>
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

      {showCampusGps && (
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSaveCampus} className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Cấu Hình Tọa Độ Khuôn Viên Trường (GPS Geofence)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cập nhật trực tiếp cấu hình tâm khuôn viên cho Kiosk chấm công
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Vĩ độ (Lat)
                </label>
                <input
                  type="number"
                  step="any"
                  value={viDo}
                  onChange={(e) => setViDo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Kinh độ (Lng)
                </label>
                <input
                  type="number"
                  step="any"
                  value={kinhDo}
                  onChange={(e) => setKinhDo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Bán kính (m)
                </label>
                <input
                  type="number"
                  min={10}
                  value={banKinh}
                  onChange={(e) => setBanKinh(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={savingCampus}>
                {savingCampus ? 'Đang lưu...' : 'Lưu Tọa Độ Khuôn Viên'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
};
