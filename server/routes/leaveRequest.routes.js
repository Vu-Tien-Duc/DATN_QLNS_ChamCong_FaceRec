const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveBalance,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} = require('../controllers/leaveRequest.controller');
const { verifyToken, verifyRole } = require('../middlewares/auth.middleware');

const { upload } = require('../middlewares/upload.middleware');

router.use(verifyToken);

// Middleware tùy chọn xử lý file khi Content-Type là multipart/form-data
const optionalFileUpload = (req, res, next) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    upload.single('file')(req, res, function (err) {
      if (err) {
        return next(err);
      }
      next();
    });
  } else {
    next();
  }
};

// Cán bộ, giảng viên, trưởng khoa, phó khoa, ban giám hiệu và admin nộp đơn
router.post('/', verifyRole(['bgh', 'truongkhoa', 'phokhoa', 'giangvien', 'nhanvien']), optionalFileUpload, createLeaveRequest);
router.get('/', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa', 'giangvien', 'nhanvien']), getLeaveRequests);
router.get('/balance', verifyRole(['bgh', 'truongkhoa', 'phokhoa', 'giangvien', 'nhanvien']), getLeaveBalance);
router.get('/:id', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa', 'giangvien', 'nhanvien']), getLeaveRequestById);

// Hủy đơn (người tạo đơn hoặc admin)
router.put('/:id/cancel', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa', 'giangvien', 'nhanvien']), cancelLeaveRequest);

// Phê duyệt hoặc từ chối đơn nghỉ phép (Admin, Ban Giám Hiệu, Trưởng khoa, Phó khoa)
router.put('/:id/approve', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa']), approveLeaveRequest);
router.put('/:id/reject', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa']), rejectLeaveRequest);
router.put('/:id/review', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa']), (req, res, next) => {
  if (req.body?.status === 'APPROVED') {
    req.body.approvalNote = req.body.approvalNote || req.body.adminNote || req.body.note || '';
    return approveLeaveRequest(req, res, next);
  }
  req.body.rejectionReason = req.body.rejectionReason || req.body.adminNote || req.body.note || 'Từ chối đơn';
  return rejectLeaveRequest(req, res, next);
});
router.put('/:id/status', verifyRole(['admin', 'bgh', 'truongkhoa', 'phokhoa']), (req, res, next) => {
  if (req.body?.status === 'APPROVED') {
    req.body.approvalNote = req.body.approvalNote || req.body.adminNote || '';
    return approveLeaveRequest(req, res, next);
  }
  req.body.rejectionReason = req.body.rejectionReason || req.body.adminNote || 'Từ chối đơn';
  return rejectLeaveRequest(req, res, next);
});

module.exports = router;
