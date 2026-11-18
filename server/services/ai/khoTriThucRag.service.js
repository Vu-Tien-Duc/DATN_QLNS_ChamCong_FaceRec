// Quản lý kho tri thức AI (TaiLieuRag, PhanDoanTaiLieu): nạp tài liệu, tìm kiếm ngữ nghĩa + từ khóa và phân quyền truy cập
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const { TaiLieuRag, PhanDoanTaiLieu, NguoiDung } = require('../../models');
const { runInTransaction } = require('../../utils/giaoDichDb');
const { isValidUuid } = require('../../utils/hoTroSequelize');
const ServiceError = require('../../utils/loiNghiepVu');
const { ROLES, hasAnyActiveRole } = require('../../utils/vaiTro.utils');
const {
  extractTextFromBuffer,
  chunkDocumentText,
  extractKeywords,
  normalizeVietnameseText,
  cleanExtractedText,
} = require('./docTaiLieuAi.service');
const {
  callGemini,
  embedTextWithGemini,
  embedBatchWithGemini,
} = require('./nhaCungCapAi.service');

const INSTITUTIONAL_UPLOAD_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.BGH,
  ROLES.TCCB,
  ROLES.DAO_TAO,
]);

// Kiểm tra người dùng có quyền quản lý tài liệu cấp toàn trường hay không
const canManageSchoolDocuments = (user) => {
  return hasAnyActiveRole(user, Array.from(INSTITUTIONAL_UPLOAD_ROLES));
};

// Tính độ tương đồng Cosine giữa hai vector embedding
const cosineSimilarity = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i += 1) {
    const a = vecA[i];
    const b = vecB[i];
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? Math.max(0, dot / denom) : 0;
};

// Tính điểm khớp từ khóa giữa truy vấn và một đoạn tài liệu
const computeKeywordScore = (queryKeywords, normalizedQuery, chunkKeywords = [], chunkText = '') => {
  if (!queryKeywords.length) return 0;

  const normalizedChunk = normalizeVietnameseText(chunkText);
  const chunkTokenSet = new Set(Array.isArray(chunkKeywords) ? chunkKeywords : []);

  let matchedCount = 0;
  for (const kw of queryKeywords) {
    if (chunkTokenSet.has(kw) || normalizedChunk.includes(kw)) {
      matchedCount += 1;
    }
  }

  let score = matchedCount / queryKeywords.length;
  const trimmedQuery = normalizedQuery.trim();
  if (trimmedQuery.length >= 6 && normalizedChunk.includes(trimmedQuery)) {
    score = Math.min(1, score + 0.3);
  }

  return score;
};

// Chấm điểm kết hợp ngữ nghĩa (vector) + từ khóa và chọn top K đoạn liên quan nhất
const scoreAndRankChunks = ({ query, chunks = [], queryVector = null, topK = 4, includeZeroFallback = false }) => {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const normalizedQuery = normalizeVietnameseText(query);
  const queryKeywords = extractKeywords(query, 20);

  const scored = chunks.map((chunk) => {
    const text = chunk.noi_dung_chunk || '';
    const vector = chunk.vector_embedding || null;
    const vecScore =
      queryVector && Array.isArray(vector) && vector.length > 0 ? cosineSimilarity(queryVector, vector) : 0;
    const chunkKeywords = extractKeywords(text, 15);
    const kwScore = computeKeywordScore(queryKeywords, normalizedQuery, chunkKeywords, text);
    const finalScore = vecScore > 0 ? 0.65 * vecScore + 0.35 * kwScore : kwScore;

    return {
      chunk,
      score: Number(finalScore.toFixed(4)),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const matched = scored.filter((item) => item.score > 0.05);
  if (matched.length > 0) {
    return matched.slice(0, topK);
  }

  if (includeZeroFallback) {
    return scored.slice(0, topK);
  }

  return [];
};

// Dùng Gemini OCR đọc văn bản từ tệp PDF dạng ảnh scan
const extractTextFromScannedPdfWithGemini = async (buffer) => {
  if (!process.env.GEMINI_API_KEY) return '';
  try {
    const base64Pdf = buffer.toString('base64');
    const result = await callGemini({
      prompt:
        'Hãy trích xuất toàn bộ nội dung văn bản tiếng Việt/tiếng Anh có trong tài liệu PDF scan này. Giữ nguyên cấu trúc đề mục, điều khoản và bảng biểu (định dạng Markdown). Chỉ trả về nội dung văn bản trích xuất, không thêm lời bình.',
      attachments: [{ mimeType: 'application/pdf', data: base64Pdf }],
      temperature: 0.1,
      maxTokens: 4096,
    });
    return cleanExtractedText(result?.text || '');
  } catch (err) {
    console.warn('[AI RAG] OCR PDF scan qua Gemini thất bại:', err.message);
    return '';
  }
};

// Nhận diện câu hỏi có ý định yêu cầu tóm tắt tổng quan tài liệu
const isSummaryIntent = (query = '') => {
  const norm = normalizeVietnameseText(query);
  return /(tom tat|rut gon|y chinh|tong quan|khai quat|noi dung chinh|muc luc)/.test(norm);
};

// Nạp tài liệu mới vào kho tri thức RAG trong 1 transaction
const ingestDocument = async ({ buffer, originalname, mimetype, title, scope = 'ca_nhan', user }) => {
  const userId = user?.id;
  if (!userId) {
    throw new ServiceError('Vui lòng đăng nhập để tải tài liệu lên kho AI.', 401, 'UNAUTHORIZED');
  }

  const normalizedScope = scope === 'toan_truong' ? 'toan_truong' : 'ca_nhan';
  if (normalizedScope === 'toan_truong' && !canManageSchoolDocuments(user)) {
    throw new ServiceError(
      'Chỉ Admin, Ban Giám hiệu hoặc Phòng TCCB/Đào tạo mới có quyền tải tài liệu dùng chung toàn trường.',
      403,
      'FORBIDDEN_SCOPE'
    );
  }

  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const duplicateWhere =
    normalizedScope === 'toan_truong'
      ? { ma_bam_sha256: fileHash, pham_vi: 'toan_truong', trang_thai: 'san_sang' }
      : { ma_bam_sha256: fileHash, nguoi_tai_id: userId, pham_vi: 'ca_nhan', trang_thai: 'san_sang' };

  const existingDoc = await TaiLieuRag.findOne({ where: duplicateWhere });
  if (existingDoc) {
    return { document: existingDoc.toJSON(), isDuplicate: true };
  }

  let parsed;
  try {
    parsed = await extractTextFromBuffer(buffer, { originalname, mimetype });
  } catch (parseErr) {
    throw new ServiceError(
      parseErr.message || 'Không thể đọc cấu trúc tệp tài liệu. Vui lòng kiểm tra lại tệp.',
      400,
      'DOCUMENT_PARSE_ERROR'
    );
  }

  let extractedText = parsed.text;
  if (parsed.isLikelyScanned) {
    const ocrText = await extractTextFromScannedPdfWithGemini(buffer);
    if (ocrText.length >= 30) {
      extractedText = ocrText;
    }
  }

  if (!extractedText || extractedText.length < 15) {
    throw new ServiceError(
      'Không trích xuất được nội dung văn bản từ tệp này (tệp có thể là ảnh scan mờ hoặc trống).',
      400,
      'EMPTY_DOCUMENT_TEXT'
    );
  }

  const chunksData = chunkDocumentText({
    text: extractedText,
    pages: parsed.pages,
    chunkSize: 900,
    overlap: 150,
  });

  if (chunksData.length === 0) {
    throw new ServiceError('Không thể phân đoạn nội dung tài liệu.', 400, 'CHUNKING_FAILED');
  }

  const { embeddings } = await embedBatchWithGemini(chunksData.map((c) => c.noi_dung));

  const summary =
    extractedText.length > 280
      ? `${extractedText.slice(0, 280).replace(/\s+\S*$/, '')}...`
      : extractedText;

  const docTitle = (title && String(title).trim()) || originalname.replace(/\.[^.]+$/, '');

  const document = await runInTransaction(async (transaction) => {
    const doc = await TaiLieuRag.create(
      {
        tieu_de: docTitle.slice(0, 200),
        ten_tep_goc: originalname,
        loai_tep: parsed.fileType,
        mime_type: mimetype || 'application/octet-stream',
        kich_thuoc_byte: buffer.length,
        ma_bam_sha256: fileHash,
        nguoi_tai_id: userId,
        pham_vi: normalizedScope,
        tom_tat: summary,
        duong_dan: `rag/${userId}/${fileHash.slice(0, 12)}-${originalname}`,
        thong_bao_loi: null,
        trang_thai: 'dang_xu_ly',
      },
      { transaction }
    );

    const chunkDocs = chunksData.map((c, idx) => ({
      tai_lieu_id: doc.id,
      thu_tu: c.thu_tu,
      noi_dung_chunk: c.noi_dung,
      vector_embedding: Array.isArray(embeddings[idx]) ? embeddings[idx] : null,
      so_tu: String(c.noi_dung || '').trim().split(/\s+/).filter(Boolean).length,
    }));

    await PhanDoanTaiLieu.bulkCreate(chunkDocs, { transaction });
    doc.trang_thai = 'san_sang';
    await doc.save({ transaction });
    return doc;
  });

  return { document: document.toJSON(), isDuplicate: false };
};

// Tìm kiếm các đoạn văn bản liên quan nhất theo câu hỏi của người dùng
const searchRelevantChunks = async ({ query, userId, documentIds = [], topK = 4 }) => {
  if (!query || !String(query).trim()) return [];
  try {
    await sequelize.authenticate();
  } catch (_) {
    return [];
  }

  const orConditions = [{ pham_vi: 'toan_truong' }];
  if (userId && isValidUuid(String(userId))) {
    orConditions.push({ nguoi_tai_id: String(userId) });
  }

  const where = {
    trang_thai: 'san_sang',
    [Op.or]: orConditions,
  };

  const validDocIds = Array.isArray(documentIds)
    ? documentIds.filter((id) => isValidUuid(String(id))).map(String)
    : [];

  if (validDocIds.length > 0) {
    where.id = { [Op.in]: validDocIds };
  }

  const accessibleDocs = await TaiLieuRag.findAll({
    where,
    attributes: ['id', 'tieu_de', 'ten_tep_goc'],
  });

  if (!accessibleDocs.length) return [];

  const docMap = new Map(accessibleDocs.map((d) => [String(d.id), d]));
  const docIdsToQuery = accessibleDocs.map((d) => d.id);

  if (validDocIds.length > 0 && isSummaryIntent(query)) {
    const summaryChunks = await PhanDoanTaiLieu.findAll({
      where: {
        tai_lieu_id: { [Op.in]: docIdsToQuery },
        thu_tu: { [Op.lt]: Math.max(topK, 4) },
      },
      attributes: ['id', 'tai_lieu_id', 'thu_tu', 'noi_dung_chunk'],
      order: [['thu_tu', 'ASC']],
      limit: topK,
    });

    return summaryChunks.map((chunk) => {
      const parentDoc = docMap.get(String(chunk.tai_lieu_id));
      return {
        chunkId: String(chunk.id),
        documentId: String(chunk.tai_lieu_id),
        title: parentDoc?.tieu_de || 'Tài liệu tham khảo',
        fileName: parentDoc?.ten_tep_goc || '',
        thu_tu: chunk.thu_tu,
        noi_dung: chunk.noi_dung_chunk,
        score: 1,
      };
    });
  }

  const chunks = await PhanDoanTaiLieu.findAll({
    where: { tai_lieu_id: { [Op.in]: docIdsToQuery } },
    order: [['thu_tu', 'ASC']],
    limit: 2000,
  });

  if (!chunks.length) return [];

  const needsVector = chunks.some((c) => Array.isArray(c.vector_embedding) && c.vector_embedding.length > 0);
  const queryVector = needsVector ? await embedTextWithGemini({ text: query }) : null;

  const ranked = scoreAndRankChunks({
    query,
    chunks,
    queryVector,
    topK,
    includeZeroFallback: validDocIds.length > 0,
  });

  return ranked.map(({ chunk, score }) => {
    const parentDoc = docMap.get(String(chunk.tai_lieu_id));
    return {
      chunkId: String(chunk.id),
      documentId: String(chunk.tai_lieu_id),
      title: parentDoc?.tieu_de || 'Tài liệu tham khảo',
      fileName: parentDoc?.ten_tep_goc || '',
      thu_tu: chunk.thu_tu,
      noi_dung: chunk.noi_dung_chunk,
      score,
    };
  });
};

// Liệt kê danh sách tài liệu RAG mà người dùng được phép xem
const listDocuments = async (userId) => {
  const orConditions = [{ pham_vi: 'toan_truong' }];
  if (userId && isValidUuid(String(userId))) {
    orConditions.push({ nguoi_tai_id: String(userId) });
  }

  return TaiLieuRag.findAll({
    where: {
      trang_thai: { [Op.in]: ['san_sang', 'loi'] },
      [Op.or]: orConditions,
    },
    include: [{ model: NguoiDung, as: 'nguoi_tai', attributes: ['id', 'ho_ten', 'vai_tro_chinh'] }],
    order: [
      ['pham_vi', 'DESC'],
      ['tao_luc', 'DESC'],
    ],
  });
};

// Lấy chi tiết 1 tài liệu RAG kèm danh sách phân đoạn nội dung
const getDocumentById = async (documentId, user, options = {}) => {
  if (!documentId || !isValidUuid(String(documentId))) {
    throw new ServiceError('ID tài liệu không hợp lệ.', 400, 'INVALID_ID');
  }

  const doc = await TaiLieuRag.findByPk(String(documentId), {
    include: [{ model: NguoiDung, as: 'nguoi_tai', attributes: ['id', 'ho_ten', 'vai_tro_chinh'] }],
  });

  if (!doc) {
    throw new ServiceError('Không tìm thấy tài liệu trong kho tri thức AI.', 404, 'DOCUMENT_NOT_FOUND');
  }

  const ownerId = String(doc.nguoi_tai_id);
  const isOwner = user?.id && ownerId === String(user.id);

  if (doc.pham_vi !== 'toan_truong' && !isOwner) {
    throw new ServiceError('Bạn không có quyền truy cập tài liệu cá nhân này.', 403, 'FORBIDDEN');
  }

  const requestedLimit = Number(options.limit);
  const chunkLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(200, Math.floor(requestedLimit))
    : 50;

  const previewChunks = await PhanDoanTaiLieu.findAll({
    where: { tai_lieu_id: doc.id },
    attributes: ['id', 'thu_tu', 'noi_dung_chunk', 'so_tu'],
    order: [['thu_tu', 'ASC']],
    limit: chunkLimit,
  });

  return {
    ...doc.toJSON(),
    xem_truoc_phan_doan: previewChunks,
  };
};

// Xóa tài liệu và toàn bộ phân đoạn liên quan khỏi kho tri thức RAG
const deleteDocument = async (documentId, user) => {
  if (!documentId || !isValidUuid(String(documentId))) {
    throw new ServiceError('ID tài liệu không hợp lệ.', 400, 'INVALID_ID');
  }

  const doc = await TaiLieuRag.findByPk(String(documentId));
  if (!doc) {
    throw new ServiceError('Không tìm thấy tài liệu để xóa.', 404, 'DOCUMENT_NOT_FOUND');
  }

  const isOwner = user?.id && String(doc.nguoi_tai_id) === String(user.id);
  const isInstitutionAdmin = canManageSchoolDocuments(user);
  const canDelete = doc.pham_vi === 'toan_truong' ? (isOwner || isInstitutionAdmin) : isOwner;

  if (!canDelete) {
    throw new ServiceError('Bạn không có quyền xóa tài liệu này.', 403, 'FORBIDDEN');
  }

  await runInTransaction(async (transaction) => {
    await PhanDoanTaiLieu.destroy({ where: { tai_lieu_id: doc.id }, transaction });
    await doc.destroy({ transaction });
  });

  return { deletedId: String(doc.id), tieu_de: doc.tieu_de };
};

module.exports = {
  canManageSchoolDocuments,
  cosineSimilarity,
  computeKeywordScore,
  scoreAndRankChunks,
  ingestDocument,
  searchRelevantChunks,
  listDocuments,
  getDocumentById,
  deleteDocument,
};
