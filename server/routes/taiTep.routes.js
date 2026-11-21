// Định tuyến API tải lên tệp đính kèm (/api/tai-tep)
const express = require('express');
const router = express.Router();
const { uploadSingleFile } = require('../controllers/taiTep.controller');
const { upload, verifyUploadedFileMagicBytes } = require('../middlewares/taiTep.middleware');
const { verifyToken } = require('../middlewares/xacThuc.middleware');
const { uploadRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');

router.use(verifyToken);

// Upload 1 file đính kèm (có giới hạn tần suất và kiểm tra Magic Bytes)
router.post(
  '/',
  uploadRateLimit,
  (req, res, next) => {
    upload.any()(req, res, function (err) {
      if (err) {
        return next(err);
      }
      if (!req.file && req.files && req.files.length > 0) {
        req.file = req.files[0];
      }
      next();
    });
  },
  verifyUploadedFileMagicBytes,
  uploadSingleFile
);

module.exports = router;
