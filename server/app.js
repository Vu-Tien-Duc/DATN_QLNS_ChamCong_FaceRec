// Khởi tạo ứng dụng Express cùng middleware bảo mật, route API, Swagger UI, tệp tĩnh và xử lý lỗi.
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

let cookieParser;
try {
  cookieParser = require('cookie-parser');
} catch {
  cookieParser = () => (req, res, next) => {
    req.cookies = {};
    if (req.headers && req.headers.cookie) {
      req.headers.cookie.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        if (parts.length >= 2) {
          req.cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
        }
      });
    }
    next();
  };
}

const swaggerSpec = require('./config/swagger');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/xuLyLoi.middleware');
const { apiGeneralLimiter } = require('./middlewares/gioiHanTruyCap.middleware');
const { downloadFile } = require('./controllers/taiTep.controller');

const app = express();

// Tin tưởng reverse proxy để nhận đúng giao thức HTTPS
app.set('trust proxy', 1);

// Thiết lập bảo mật HTTP header và CORS
app.use(
  helmet({
    contentSecurityPolicy: false, // Tắt CSP để Swagger UI hoạt động bình thường
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'http://localhost:5000',
  'https://chamcongdh.io.vn',
  'http://chamcongdh.io.vn',
];

const allowedOrigins = process.env.CORS_WHITELIST
  ? process.env.CORS_WHITELIST.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : defaultOrigins;

if (process.env.CLIENT_URL) {
  const clientUrl = process.env.CLIENT_URL.trim().replace(/\/$/, '');
  if (!allowedOrigins.includes(clientUrl)) {
    allowedOrigins.push(clientUrl);
  }
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Cho phép request không gửi header Origin
      if (!origin) {
        return callback(null, true);
      }

      // Chỉ mở mọi nguồn khi chạy development không giới hạn whitelist
      if (process.env.NODE_ENV === 'development' && (!process.env.CORS_WHITELIST || allowedOrigins.includes('*'))) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.some((allowed) => allowed.replace(/\/$/, '') === cleanOrigin);

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  })
);

// Ghi log HTTP và đọc dữ liệu body, cookie
if (process.env.NODE_ENV === 'development') {
  app.use(
    morgan('dev', {
      // Chỉ log request lỗi hoặc thao tác thay đổi dữ liệu
      skip: (req, res) => req.method === 'GET' && res.statusCode < 400,
    })
  );
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Phục vụ tệp tải lên qua controller để kiểm tra quyền
app.get('/uploads/:filename', downloadFile);
app.get('/uploads/faces/:filename', downloadFile);
app.get('/api/uploads/:filename', downloadFile);
app.get('/api/uploads/faces/:filename', downloadFile);
app.get('/api/tai-tep/tep/:filename', downloadFile);

// Tài liệu API (Swagger UI)
const swaggerUiOptions = {
  customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/tai-lieu-api', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Kiểm tra trạng thái hoạt động của máy chủ và CSDL
app.get('/suc-khoe', async (req, res) => {
  const { sequelize } = require('./config/db');
  let dbStatus = 'CONNECTING_OR_DISCONNECTED';
  try {
    await sequelize.authenticate();
    dbStatus = 'CONNECTED';
  } catch (_) {
    dbStatus = 'DISCONNECTED';
  }
  res.status(200).json({
    status: 'OK',
    database: dbStatus,
    databaseEngine: 'Microsoft SQL Server',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    tablesCount: 24,
    tables: [
      'cau_hinh_he_thong',
      'ngay_nghi_le',
      'ca_lam_viec',
      'phong_ban',
      'nguoi_dung',
      'ho_so_can_bo',
      'vai_tro_nguoi_dung',
      'xac_thuc_otp',
      'mau_khuon_mat',
      'mon_hoc',
      'lich_trinh',
      'lich_trinh_tuan',
      'ngoai_le_lich_trinh',
      'nhat_ky_cham_cong',
      'luot_quet_cham_cong',
      'don_nghi_phep',
      'lich_su_duyet_don',
      'phieu_luong',
      'phu_cap_luong',
      'giam_tru_luong',
      'ma_lam_moi',
      'nhat_ky_kiem_toan',
      'tai_lieu_rag',
      'phan_doan_tai_lieu',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Gắn toàn bộ API chính dưới tiền tố /api
app.use('/api', apiGeneralLimiter, apiRoutes);

// Phục vụ giao diện React đã build từ thư mục dist
const distPath = path.join(__dirname, '../dist');
const indexHtml = path.join(distPath, 'index.html');

const isBrowserPageRequest = (req) => {
  const accept = String(req.headers.accept || '').toLowerCase();
  return req.method === 'GET' && !req.headers.authorization && accept.includes('text/html');
};

if (fs.existsSync(distPath) && fs.existsSync(indexHtml)) {
  app.use(express.static(distPath));

  // Trả về index.html cho các đường dẫn trang phía trình duyệt
  app.use((req, res, next) => {
    if (!isBrowserPageRequest(req)) return next();
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/tai-lieu-api') ||
      req.path.startsWith('/suc-khoe') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    return res.sendFile(indexHtml);
  });
} else {
  // Khi chưa build dist thì chuyển hướng về Vite dev server
  app.use((req, res, next) => {
    if (!isBrowserPageRequest(req)) return next();
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/tai-lieu-api') ||
      req.path.startsWith('/suc-khoe') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    const vitePort = process.env.VITE_PORT || 5173;
    return res.redirect(`http://localhost:${vitePort}${req.originalUrl}`);
  });
}

// Hỗ trợ trường hợp proxy cắt mất tiền tố /api
app.use(apiRoutes);

// Xử lý 404 và lỗi tập trung
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
