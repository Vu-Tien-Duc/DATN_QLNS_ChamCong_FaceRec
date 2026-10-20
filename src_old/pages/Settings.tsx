import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, Save, Loader2, AlertCircle, Check,
  Bell, Shield, Clock, Globe, Eye, EyeOff, Lock,
} from 'lucide-react';
import { apiClient } from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface SystemConfig {
  workStartTime?: string;
  workEndTime?: string;
  lateThresholdMinutes?: number;
  allowFaceCheckIn?: boolean;
  allowQRCheckIn?: boolean;
  allowManualCheckIn?: boolean;
  maxLeavePerMonth?: number;
  notifyOnLate?: boolean;
  notifyOnAbsent?: boolean;
}

export default function Settings() {
  const { user } = useAuth();

  const [config, setConfig] = useState<SystemConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'password'>('system');

  // Change password
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/system/config');
      setConfig(res.data?.data || res.data || {});
    } catch {
      setConfig({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.put('/system/config', config);
      toast.success('Cài đặt hệ thống đã được lưu');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPwd || !newPwd) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    if (newPwd !== confirmPwd) { toast.error('Mật khẩu mới không khớp'); return; }
    if (newPwd.length < 6) { toast.error('Mật khẩu mới ít nhất 6 ký tự'); return; }
    setPwdLoading(true);
    try {
      await apiClient.put('/auth/change-password', { oldPassword: oldPwd, newPassword: newPwd });
      toast.success('Đổi mật khẩu thành công!');
      setOldPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Đổi mật khẩu thất bại');
    } finally {
      setPwdLoading(false);
    }
  };

  const TABS = [
    { key: 'system', label: 'Hệ thống', icon: SettingsIcon },
    { key: 'password', label: 'Đổi mật khẩu', icon: Lock },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Cài đặt</h1>
        <p className="text-slate-500 text-sm mt-1">Cấu hình hệ thống và thông tin cá nhân</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Config Tab */}
      {activeTab === 'system' && (
        <div className="card p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-6">
              {/* Work Hours */}
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <Clock size={16} className="text-blue-600" />
                  Giờ làm việc
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label">Giờ bắt đầu</label>
                    <input type="time" className="form-input" value={config.workStartTime ?? '07:00'} onChange={(e) => setConfig({ ...config, workStartTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Giờ kết thúc</label>
                    <input type="time" className="form-input" value={config.workEndTime ?? '17:00'} onChange={(e) => setConfig({ ...config, workEndTime: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ngưỡng trễ (phút)</label>
                    <input type="number" min={0} max={60} className="form-input" value={config.lateThresholdMinutes ?? 15} onChange={(e) => setConfig({ ...config, lateThresholdMinutes: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Check-in Methods */}
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <Shield size={16} className="text-blue-600" />
                  Phương thức chấm công
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'allowFaceCheckIn', label: '🤖 Nhận diện khuôn mặt (FaceID)', desc: 'Cho phép chấm công bằng camera AI' },
                    { key: 'allowQRCheckIn', label: '📷 QR Code', desc: 'Chấm công qua mã QR được tạo tự động' },
                    { key: 'allowManualCheckIn', label: '✍️ Thủ công', desc: 'Tự khai báo giờ vào/ra (cần phê duyệt)' },
                  ].map((m) => (
                    <label key={m.key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
                        checked={config[m.key as keyof SystemConfig] as boolean ?? true}
                        onChange={(e) => setConfig({ ...config, [m.key]: e.target.checked })}
                      />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{m.label}</p>
                        <p className="text-xs text-slate-500">{m.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Notifications */}
              <div>
                <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                  <Bell size={16} className="text-blue-600" />
                  Thông báo
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'notifyOnLate', label: 'Thông báo khi đi trễ', desc: 'Gửi cảnh báo khi nhân viên check-in muộn' },
                    { key: 'notifyOnAbsent', label: 'Thông báo vắng mặt', desc: 'Gửi thông báo cuối ngày cho nhân viên vắng' },
                  ].map((n) => (
                    <label key={n.key} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300"
                        checked={config[n.key as keyof SystemConfig] as boolean ?? false}
                        onChange={(e) => setConfig({ ...config, [n.key]: e.target.checked })}
                      />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{n.label}</p>
                        <p className="text-xs text-slate-500">{n.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Lưu cài đặt
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Change Password Tab */}
      {activeTab === 'password' && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Lock size={22} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Đổi mật khẩu</h3>
              <p className="text-sm text-slate-500">Cập nhật mật khẩu đăng nhập của bạn</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <div className="relative">
                <input type={showOldPwd ? 'text' : 'password'} className="form-input pr-10" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} placeholder="••••••••" required />
                <button type="button" onClick={() => setShowOldPwd(!showOldPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showOldPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>
              <div className="relative">
                <input type={showNewPwd ? 'text' : 'password'} className="form-input pr-10" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Ít nhất 6 ký tự" required />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>
              <input type="password" className="form-input" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Nhập lại mật khẩu mới" required />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
              )}
            </div>
            <button type="submit" disabled={pwdLoading || (!!confirmPwd && newPwd !== confirmPwd)} className="btn-primary w-full justify-center">
              {pwdLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Cập nhật mật khẩu
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
