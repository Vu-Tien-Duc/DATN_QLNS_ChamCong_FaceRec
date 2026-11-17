// Trích xuất văn bản thuần (PDF, DOCX, DOC, TXT, MD), phát hiện PDF scan và chia đoạn phục vụ RAG

const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const VIETNAMESE_STOPWORDS = new Set([
  'va', 'cua', 'la', 'co', 'cho', 'trong', 'voi', 'cac', 'nhung', 'duoc', 'nay',
  'khi', 'tai', 'theo', 've', 'tu', 'den', 'khong', 'mot', 'nhu', 'de', 'da',
  'se', 'dang', 'bi', 'boi', 'hoac', 'hay', 'neu', 'thi', 'ma', 'nhung', 'vi',
  'do', 'tren', 'duoi', 'sau', 'truoc', 'giua', 'ngoai', 'qua', 'ra', 'vao',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were',
]);

// Chuẩn hóa chuỗi tiếng Việt về không dấu, chữ thường để đối chiếu từ khóa
const normalizeVietnameseText = (str = '') =>
  String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

// Làm sạch ký tự thừa, khoảng trắng và xuống dòng sau khi trích xuất văn bản
const cleanExtractedText = (rawText = '') => {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Nhận diện định dạng tài liệu (pdf, docx, doc, md, txt) từ tên tệp hoặc MIME type
const detectDocumentType = (originalname = '', mimetype = '') => {
  const ext = path.extname(String(originalname)).toLowerCase();
  const mime = String(mimetype).toLowerCase();

  if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
  if (
    ext === '.docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'docx';
  }
  if (ext === '.doc' || mime === 'application/msword') return 'doc';
  if (ext === '.md' || mime === 'text/markdown') return 'md';
  if (ext === '.txt' || mime === 'text/plain') return 'txt';

  return null;
};

// Trích xuất danh sách từ khóa nổi bật (loại bỏ từ dừng) từ đoạn văn bản
const extractKeywords = (text = '', maxKeywords = 30) => {
  const normalized = normalizeVietnameseText(text);
  const tokens = normalized.match(/[a-z0-9]{2,}/g) || [];
  const freq = new Map();

  for (const token of tokens) {
    if (VIETNAMESE_STOPWORDS.has(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
};

// Trích xuất văn bản từ Buffer tài liệu (PDF, DOCX, DOC, TXT, MD)
const extractTextFromBuffer = async (buffer, { originalname = '', mimetype = '' } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Nội dung tệp rỗng hoặc không hợp lệ.');
  }

  const fileType = detectDocumentType(originalname, mimetype);
  if (!fileType) {
    throw new Error('Định dạng tài liệu không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, DOC, TXT, MD.');
  }

  if (fileType === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      const pages = Array.isArray(parsed?.pages)
        ? parsed.pages
            .map((p, idx) => ({
              pageNum: p.num || idx + 1,
              text: cleanExtractedText(p.text || ''),
            }))
            .filter((p) => p.text.length > 0)
        : [];

      const text =
        pages.length > 0
          ? pages.map((p) => p.text).join('\n\n')
          : cleanExtractedText(parsed?.text || '');

      const pageCount = parsed?.total || pages.length || 1;
      const isLikelyScanned = text.length < 60 && buffer.length > 4096;

      return {
        fileType,
        text,
        pageCount,
        pages,
        isLikelyScanned,
      };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    const text = cleanExtractedText(result?.value || '');
    return {
      fileType,
      text,
      pageCount: null,
      pages: [],
      isLikelyScanned: false,
    };
  }

  if (fileType === 'doc') {
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buffer);
    const bodyText = extracted?.getBody ? extracted.getBody() : '';
    const text = cleanExtractedText(bodyText);
    return {
      fileType,
      text,
      pageCount: null,
      pages: [],
      isLikelyScanned: false,
    };
  }

  // txt hoặc md
  const text = cleanExtractedText(buffer.toString('utf8'));
  return {
    fileType,
    text,
    pageCount: null,
    pages: [],
    isLikelyScanned: false,
  };
};

// Tìm điểm cắt tự nhiên gần cuối đoạn (ưu tiên hết đoạn, hết câu, khoảng trắng)
const findNaturalSplitIndex = (text, startIdx, maxEndIdx) => {
  if (maxEndIdx >= text.length) return text.length;

  const minSplit = startIdx + Math.floor((maxEndIdx - startIdx) * 0.55);
  const windowText = text.slice(minSplit, maxEndIdx);

  const doubleNewline = windowText.lastIndexOf('\n\n');
  if (doubleNewline !== -1) return minSplit + doubleNewline + 2;

  const singleNewline = windowText.lastIndexOf('\n');
  if (singleNewline !== -1) return minSplit + singleNewline + 1;

  const sentenceEndMatch = [...windowText.matchAll(/[.!?]\s+/g)];
  if (sentenceEndMatch.length > 0) {
    const lastMatch = sentenceEndMatch[sentenceEndMatch.length - 1];
    return minSplit + lastMatch.index + lastMatch[0].length;
  }

  const lastSpace = windowText.lastIndexOf(' ');
  if (lastSpace !== -1) return minSplit + lastSpace + 1;

  return maxEndIdx;
};

// Chia văn bản thành các đoạn (chunks) có phần chồng lấn để giữ ngữ cảnh khi truy xuất RAG
const chunkDocumentText = ({ text = '', pages = [], chunkSize = 900, overlap = 150 } = {}) => {
  const cleanText = cleanExtractedText(text);
  if (!cleanText) return [];

  const safeChunkSize = Math.max(200, chunkSize);
  const safeOverlap = Math.min(Math.max(0, overlap), Math.floor(safeChunkSize / 3));

  // Nếu có danh sách trang từ PDF, lập bản đồ vị trí ký tự -> số trang
  const pageRanges = [];
  if (Array.isArray(pages) && pages.length > 0) {
    let cursor = 0;
    for (const page of pages) {
      const len = (page.text || '').length;
      if (len > 0) {
        pageRanges.push({
          pageNum: page.pageNum,
          start: cursor,
          end: cursor + len,
        });
        cursor += len + 2; // +2 cho '\n\n' khi ghép trang
      }
    }
  }

  const resolvePageNumber = (offset) => {
    if (pageRanges.length === 0) return null;
    const found = pageRanges.find((r) => offset >= r.start && offset <= r.end);
    return found ? found.pageNum : pageRanges[pageRanges.length - 1].pageNum;
  };

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < cleanText.length) {
    const rawEnd = Math.min(start + safeChunkSize, cleanText.length);
    const splitAt = findNaturalSplitIndex(cleanText, start, rawEnd);
    const segment = cleanText.slice(start, splitAt).trim();

    if (segment.length > 0) {
      chunks.push({
        thu_tu: index,
        noi_dung: segment,
        do_dai: segment.length,
        so_trang_uoc_luong: resolvePageNumber(start),
        tu_khoa: extractKeywords(segment, 25),
      });
      index += 1;
    }

    if (splitAt >= cleanText.length) break;

    const nextStart = Math.max(start + 1, splitAt - safeOverlap);
    // Dịch tới đầu từ kế tiếp để tránh cắt giữa chữ khi lùi overlap
    const spaceAfterOverlap = cleanText.indexOf(' ', nextStart);
    start =
      nextStart > start && spaceAfterOverlap !== -1 && spaceAfterOverlap < splitAt
        ? spaceAfterOverlap + 1
        : nextStart;
  }

  return chunks;
};

module.exports = {
  cleanExtractedText,
  detectDocumentType,
  normalizeVietnameseText,
  extractKeywords,
  extractTextFromBuffer,
  chunkDocumentText,
};
