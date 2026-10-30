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
router.post('/', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien', 'chuyen_vien']), optionalFileUpload, createLeaveRequest);
router.get('/', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien']), getLeaveRequests);
router.get('/balance', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien', 'chuyen_vien']), getLeaveBalance);
router.get('/:id', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien']), getLeaveRequestById);

// Hủy đơn (người tạo đơn hoặc admin)
router.put('/:id/cancel', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa', 'giang_vien', 'nhan_vien']), cancelLeaveRequest);

// Phê duyệt hoặc từ chối đơn nghỉ phép (Admin, Ban Giám Hiệu, Trưởng khoa, Phó khoa)
router.put('/:id/approve', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa']), approveLeaveRequest);
router.put('/:id/reject', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa']), rejectLeaveRequest);
router.put('/:id/status', verifyRole(['admin', 'bgh', 'truong_khoa', 'pho_khoa']), (req, res, next) => {
  if (req.body?.status === 'approved') {
    return approveLeaveRequest(req, res, next);
  }
  return rejectLeaveRequest(req, res, next);
});

module.exports = router;
