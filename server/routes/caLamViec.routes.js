const express = require('express');
const router = express.Router();
const {
  getAllShiftConfigs,
  getShiftConfigById,
  createShiftConfig,
  updateShiftConfig,
  deleteShiftConfig,
} = require('../controllers/caLamViec.controller');
const { verifyToken, authorizeRoles } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

router.get('/', getAllShiftConfigs);
router.get('/:id', getShiftConfigById);
router.post('/', authorizeRoles('admin', 'bgh', 'dao_tao'), createShiftConfig);
router.put('/:id', authorizeRoles('admin', 'bgh', 'dao_tao'), updateShiftConfig);
router.delete('/:id', authorizeRoles('admin', 'bgh', 'dao_tao'), deleteShiftConfig);

module.exports = router;
