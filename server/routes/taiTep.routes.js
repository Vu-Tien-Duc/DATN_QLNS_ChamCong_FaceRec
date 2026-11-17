// Định tuyến API tải lên tệp đính kèm (/api/tai-tep)
const express = require('express');
const router = express.Router();
const { uploadSingleFile } = require('../controllers/taiTep.controller');
const { upload } = require('../middlewares/taiTep.middleware');
const { verifyToken } = require('../middlewares/xacThuc.middleware');

router.use(verifyToken);

// Upload 1 file đính kèm (hỗ trợ mọi field name: 'file', 'avatar', 'image', 'photo', 'attachment')
router.post('/', (req, res, next) => {
  upload.any()(req, res, function (err) {
    if (err) {
      return next(err);
    }
    if (!req.file && req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
}, uploadSingleFile);

module.exports = router;
