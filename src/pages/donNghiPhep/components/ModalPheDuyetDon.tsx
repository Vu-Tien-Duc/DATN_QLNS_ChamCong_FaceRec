import React from 'react';
import { CheckCircle2, Paperclip, X, XCircle } from 'lucide-react';
import { Portal } from '../../../components/chung/CongDichChuyen';
import { Button } from '../../../components/chung/NutBam';
import { LeaveRequestData } from '../../../api/donNghiPhep.api';

interface ModalPheDuyetDonProps {
  isOpen: boolean;
  selectedRequest: LeaveRequestData | null;
  approvalAction: 'APPROVE' | 'REJECT';
  approvalNote: string;
  rejectionReason: string;
  submitting: boolean;
  onChangeApprovalNote: (val: string) => void;
  onChangeRejectionReason: (val: string) => void;
  isValidAttachmentUrl: (url?: string) => boolean;
  getAttachmentFullUrl: (url?: string) => string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ModalPheDuyetDon: React.FC<ModalPheDuyetDonProps> = ({
  isOpen,
  selectedRequest,
  approvalAction,
  approvalNote,
  rejectionReason,
  submitting,
  onChangeApprovalNote,
  onChangeRejectionReason,
  isValidAttachmentUrl,
  getAttachmentFullUrl,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !selectedRequest) return null;

  const attachmentUrl = selectedRequest.attachmentUrl || (selectedRequest as any).tep_dinh_kem;

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {approvalAction === 'APPROVE' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Phê Duyệt Đơn Nghỉ Phép
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  Từ Chối Đơn Nghỉ Phép
                </>
              )}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div>
                  <span className="text-slate-400">Cán bộ / Giảng viên: </span>
                  <strong className="text-slate-900 dark:text-slate-100 font-semibold">
                    {(selectedRequest.userId as any)?.fullName}
                  </strong>
                  <span className="text-slate-500 font-mono ml-1.5">
                    ({(selectedRequest.userId as any)?.staffCode || (selectedRequest.userId as any)?.ma_can_bo || 'NTU-CB'})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Lý do xin nghỉ: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {selectedRequest.reason || selectedRequest.ly_do}
                  </span>
                </div>
                {isValidAttachmentUrl(attachmentUrl) && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 mt-1">
                    <span className="text-slate-400 font-medium">Tệp dẫn chứng đính kèm:</span>
                    <a
                      href={getAttachmentFullUrl(attachmentUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Xem minh chứng (tab mới)
                    </a>
                  </div>
                )}
              </div>

              {approvalAction === 'APPROVE' ? (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú phê duyệt (không bắt buộc):
                  </label>
                  <textarea
                    value={approvalNote}
                    onChange={(e) => onChangeApprovalNote(e.target.value)}
                    placeholder="Đã thu xếp kế hoạch giảng dạy / đồng ý cho nghỉ..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-rose-700 dark:text-rose-400 mb-1">
                    Lý do từ chối (bắt buộc):
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => onChangeRejectionReason(e.target.value)}
                    placeholder="Nêu rõ lý do không đồng ý (trùng lịch thi, chưa có người dạy thay...)"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Hủy
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className={
                  approvalAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }
              >
                {submitting
                  ? 'Đang xử lý...'
                  : approvalAction === 'APPROVE'
                  ? 'Xác Nhận Phê Duyệt'
                  : 'Xác Nhận Từ Chối'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};
