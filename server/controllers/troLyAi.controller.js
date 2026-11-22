// Trợ lý AI HTTP Controller: nhận request, điều phối tới troLyAi.service và trả phản hồi JSON
const {
  isAiAdminUser,
  processAiChat,
  getAvailableModes,
  getAvailableProviders,
  getRagDocumentList,
  uploadRagDocument,
  getRagDocumentDetail,
  removeRagDocument,
} = require('../services/ai/troLyAi.service');

// POST /api/tro-ly-ai/tro-chuyen - Trò chuyện AI (hỗ trợ JSON và ảnh / PDF / Word đính kèm)
const chat = async (req, res) => {
  try {
    const responseData = await processAiChat({ body: req.body, file: req.file || null, user: req.user });
    return res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    console.error('[AI Controller] Lỗi khi xử lý chat:', error);
    const status = error.statusCode || error.status || 500;
    const isAdmin = isAiAdminUser(req.user);
    return res.status(status).json({
      success: false,
      message:
        status >= 500 && !isAdmin
          ? 'Có lỗi xảy ra khi xử lý phản hồi từ Trợ lý AI. Vui lòng thử lại sau.'
          : error.message || 'Có lỗi xảy ra khi xử lý phản hồi từ Trợ lý AI.',
      ...(isAdmin ? { error: error.message } : {}),
    });
  }
};

// GET /api/tro-ly-ai/che-do - Danh sách chế độ trợ lý AI
const getModes = (req, res) =>
  res.status(200).json({ success: true, data: getAvailableModes() });

// GET /api/tro-ly-ai/nha-cung-cap - Danh sách mô hình/nhà cung cấp AI khả dụng
const getProviders = async (req, res) =>
  res.status(200).json({ success: true, data: await getAvailableProviders() });

// GET /api/tro-ly-ai/tai-lieu - Danh sách tài liệu RAG được phép truy cập
const getDocuments = async (req, res) => {
  try {
    const data = await getRagDocumentList(req.user);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[AI Controller] Lỗi tải danh sách tài liệu RAG:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách tài liệu RAG.' });
  }
};

// POST /api/tro-ly-ai/tai-lieu - Tải lên và nạp tài liệu vào Kho tri thức RAG
const uploadDocument = async (req, res) => {
  try {
    const { tieu_de: title, pham_vi: scope = 'ca_nhan' } = req.body || {};
    const { document, isDuplicate } = await uploadRagDocument({
      file: req.file,
      title,
      scope,
      user: req.user,
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    });
    return res.status(isDuplicate ? 200 : 201).json({
      success: true,
      message: isDuplicate
        ? `Tài liệu "${document.tieu_de}" đã có sẵn trong Kho tri thức AI.`
        : 'Đã đọc và nạp tài liệu vào Kho tri thức AI thành công.',
      data: document,
      isDuplicate,
    });
  } catch (error) {
    console.error('[AI Controller] Lỗi nạp tài liệu RAG:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Không thể xử lý tài liệu tải lên.',
    });
  }
};

// GET /api/tro-ly-ai/tai-lieu/:id - Chi tiết tài liệu RAG
const getDocumentDetail = async (req, res) => {
  try {
    const detail = await getRagDocumentDetail(req.params.id, req.user, { limit: req.query?.gioi_han });
    return res.status(200).json({ success: true, data: detail });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Không thể lấy chi tiết tài liệu.',
    });
  }
};

// DELETE /api/tro-ly-ai/tai-lieu/:id - Xóa tài liệu khỏi kho tri thức RAG
const removeDocument = async (req, res) => {
  try {
    const deleted = await removeRagDocument({
      id: req.params.id,
      user: req.user,
      ipAddress: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    });
    return res.status(200).json({
      success: true,
      message: `Đã xóa tài liệu "${deleted.tieu_de}" khỏi kho tri thức AI.`,
      data: deleted,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Không thể xóa tài liệu.',
    });
  }
};

module.exports = {
  chat,
  getModes,
  getProviders,
  getDocuments,
  uploadDocument,
  getDocumentDetail,
  removeDocument,
};
