// Định tuyến API lấy thông báo của người dùng đang đăng nhập (/api/thong-bao)
const express = require('express');
const router = express.Router();
const { getNotifications } = require('../controllers/thongBao.controller');
const { verifyToken } = require('../middlewares/xacThuc.middleware');

router.get('/', verifyToken, getNotifications);

module.exports = router;
