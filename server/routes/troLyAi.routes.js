/**
 * AI Assistant Routes
 * Định tuyến API trò chuyện đa phương thức (Ảnh OCR, PDF/Word trực tiếp) và Kho tài liệu RAG
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const {
  chat,
  getModes,
  getProviders,
  getDocuments,
  uploadDocument,
  getDocumentDetail,
  removeDocument,
} = require('../controllers/troLyAi.controller');
const { verifyToken } = require('../middlewares/xacThuc.middleware');
const { aiChatRateLimit } = require('../middlewares/gioiHanTruyCap.middleware');

const MAX_AI_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const RAG_DOCUMENT_MIME_MAP = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
};

const CHAT_ATTACHMENT_MIME_MAP = {
  ...RAG_DOCUMENT_MIME_MAP,
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const createAiUploader = (allowedMap, errorMessage) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_AI_FILE_SIZE,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const allowedExts = allowedMap[String(file.mimetype || '').toLowerCase()];
      // Hỗ trợ một số trình duyệt gửi .md dưới dạng application/octet-stream hoặc text/plain
      const isMarkdownOctet = ext === '.md' && 'text/markdown' in allowedMap;
      if ((allowedExts && allowedExts.includes(ext)) || isMarkdownOctet) {
        return cb(null, true);
      }
      const err = new Error(errorMessage);
      err.statusCode = 400;
      return cb(err);
    },
  });

const chatUpload = createAiUploader(
  CHAT_ATTACHMENT_MIME_MAP,
  'Tệp đính kèm không hợp lệ. Chỉ chấp nhận Ảnh (PNG, JPG, WEBP) hoặc Tài liệu (PDF, DOCX, DOC, TXT, MD).'
);

const ragUpload = createAiUploader(
  RAG_DOCUMENT_MIME_MAP,
  'Tài liệu RAG không hợp lệ. Chỉ chấp nhận tệp PDF, DOCX, DOC, TXT hoặc MD.'
);

const formatMulterError = (err, res) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Dung lượng tệp vượt quá giới hạn cho phép (tối đa 10MB).',
    });
  }
  return res.status(err?.statusCode || 400).json({
    success: false,
    message: err?.message || 'Không thể tải tệp lên.',
  });
};

const handleOptionalChatUpload = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next();
  }
  return chatUpload.single('file')(req, res, (err) => {
    if (err) return formatMulterError(err, res);
    return next();
  });
};

const handleRagDocumentUpload = (req, res, next) => {
  return ragUpload.single('file')(req, res, (err) => {
    if (err) return formatMulterError(err, res);
    return next();
  });
};

// Danh mục chế độ và nhà cung cấp AI
router.get('/che-do', verifyToken, getModes);
router.get('/nha-cung-cap', verifyToken, getProviders);

// Endpoint trò chuyện AI (JSON hoặc multipart/form-data đính kèm ảnh/PDF/Word)
router.post('/tro-chuyen', verifyToken, aiChatRateLimit, handleOptionalChatUpload, chat);

// Các endpoint quản lý Kho tài liệu RAG
router.get('/tai-lieu', verifyToken, getDocuments);
router.post('/tai-lieu', verifyToken, aiChatRateLimit, handleRagDocumentUpload, uploadDocument);
router.get('/tai-lieu/:id', verifyToken, getDocumentDetail);
router.delete('/tai-lieu/:id', verifyToken, removeDocument);

module.exports = router;
