const express = require('express');
const router = express.Router();
const { handleAiChat } = require('../controllers/ai.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { aiChatRateLimit } = require('../middlewares/rateLimiter.middleware');

router.use(verifyToken);

// Endpoint nhận câu hỏi của Thanh tra đào tạo (Bảo vệ bằng aiChatRateLimit)
router.post('/chat', aiChatRateLimit, handleAiChat);

module.exports = router;
