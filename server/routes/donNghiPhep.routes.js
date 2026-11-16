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
} = require('../controllers/donNghiPhep.controller');
const { verifyToken, verifyRole } = require('../middlewares/xacThuc.middleware');

const { upload } = require('../middlewares/taiTep.middleware');

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

const LEAVE_SELF_AND_LEADER_ROLES = [
  'admin',
  'bgh',
  'tccb',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
  'giang_vien',
  'nhan_vien',
  'chuyen_vien',
  'quan_ly_xe',
  'dao_tao',
  'ke_toan',
];

const LEAVE_APPROVER_ROLES = [
  'admin',
  'bgh',
  'tccb',
  'truong_khoa',
  'pho_khoa',
  'truong_bo_mon',
  'pho_bo_mon',
  'truong_phong',
  'pho_phong',
];

// Cán bộ, giảng viên, trưởng/phó đơn vị, TCCB, ban giám hiệu và admin nộp/xem/hủy đơn
router.post('/', verifyRole(LEAVE_SELF_AND_LEADER_ROLES), optionalFileUpload, createLeaveRequest);
router.get('/', verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveRequests);
router.get('/so-du', verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveBalance);
router.get('/:id', verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveRequestById);

// Hủy đơn (người tạo đơn hoặc admin/BGH)
router.put('/:id/huy', verifyRole(LEAVE_SELF_AND_LEADER_ROLES), cancelLeaveRequest);

// Phê duyệt hoặc từ chối đơn nghỉ phép (Admin, Ban Giám Hiệu, TCCB, Lãnh đạo đơn vị)
router.put('/:id/phe-duyet', verifyRole(LEAVE_APPROVER_ROLES), approveLeaveRequest);
router.put('/:id/tu-choi', verifyRole(LEAVE_APPROVER_ROLES), rejectLeaveRequest);

module.exports = router;
