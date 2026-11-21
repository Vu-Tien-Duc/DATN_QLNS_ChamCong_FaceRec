// Định tuyến API nộp, tra cứu, hủy và phê duyệt đơn nghỉ phép / dạy bù / đổi ca (/api/don-nghi-phep)
const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  getLeaveBalance,
  getSubstituteLecturers,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} = require('../controllers/donNghiPhep.controller');
const { verifyToken, verifyRole, requirePermission, requireAnyPermission } = require('../middlewares/xacThuc.middleware');
const { PERMISSIONS } = require('../config/permissions');

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
router.post('/', requirePermission(PERMISSIONS.DON_TU_TAO), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), optionalFileUpload, createLeaveRequest);
router.get('/', requireAnyPermission(PERMISSIONS.DON_TU_XEM_BAN_THAN, PERMISSIONS.DON_TU_XEM_DON_VI), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveRequests);
router.get('/so-du', requireAnyPermission(PERMISSIONS.DON_TU_XEM_BAN_THAN, PERMISSIONS.DON_TU_XEM_DON_VI), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveBalance);
router.get('/giang-vien-day-thay', requireAnyPermission(PERMISSIONS.DON_TU_TAO, PERMISSIONS.DON_TU_XEM_BAN_THAN), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getSubstituteLecturers);
router.get('/:id', requireAnyPermission(PERMISSIONS.DON_TU_XEM_BAN_THAN, PERMISSIONS.DON_TU_XEM_DON_VI), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), getLeaveRequestById);

// Hủy đơn (người tạo đơn hoặc admin/BGH)
router.put('/:id/huy', requireAnyPermission(PERMISSIONS.DON_TU_HUY, PERMISSIONS.DON_TU_XEM_BAN_THAN), verifyRole(LEAVE_SELF_AND_LEADER_ROLES), cancelLeaveRequest);

// Phê duyệt hoặc từ chối đơn nghỉ phép (Admin, Ban Giám Hiệu, TCCB, Lãnh đạo đơn vị hoặc Phó được ủy quyền)
router.put('/:id/phe-duyet', requireAnyPermission(PERMISSIONS.DON_TU_DUYET_CAP_1, PERMISSIONS.DON_TU_DUYET_CAP_2), verifyRole(LEAVE_APPROVER_ROLES), approveLeaveRequest);
router.put('/:id/tu-choi', requireAnyPermission(PERMISSIONS.DON_TU_DUYET_CAP_1, PERMISSIONS.DON_TU_DUYET_CAP_2), verifyRole(LEAVE_APPROVER_ROLES), rejectLeaveRequest);

module.exports = router;
