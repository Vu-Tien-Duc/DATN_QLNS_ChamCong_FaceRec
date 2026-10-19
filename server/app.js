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
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { downloadFile } = require('./controllers/upload.controller');

const app = express();

// Tin tưởng reverse proxy (Nginx) để nhận diện đúng giao thức HTTPS (X-Forwarded-Proto)
app.set('trust proxy', 1);

// 1. Security Middlewares (Helmet & CORS Whitelist)
app.use(
  helmet({
    contentSecurityPolicy: false, // Để Swagger UI hoạt động bình thường
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
      // 1. Cho phép nếu không có origin (Postman, curl, native request)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Chỉ cho phép mọi nguồn trong môi trường phát triển.
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

// 2. Logging & Parsing Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(
    morgan('dev', {
      // Bỏ qua log các request GET thành công (<400) để terminal luôn gọn gàng, chỉ hiện các thao tác thay đổi dữ liệu hoặc lỗi
      skip: (req, res) => req.method === 'GET' && res.statusCode < 400,
    })
  );
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// File upload chỉ được phục vụ qua controller để kiểm tra quyền truy cập.
app.get('/uploads/:filename', downloadFile);
app.get('/api/uploads/:filename', downloadFile);
app.get('/api/v1/uploads/:filename', downloadFile);
app.get('/uploads/faces/:filename', (req, res, next) => {
  req.params.filename = `face-${req.params.filename.replace(/^face-/, '')}`;
  return downloadFile(req, res, next);
});
app.get('/api/uploads/faces/:filename', (req, res, next) => {
  req.params.filename = `face-${req.params.filename.replace(/^face-/, '')}`;
  return downloadFile(req, res, next);
});


// 4. Swagger UI Documentation Route
const swaggerUiOptions = {
  customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
  swaggerOptions: {
    persistAuthorization: true,
  },
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// 5. Health Check Route
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'CONNECTING_OR_DISCONNECTED';
  res.status(200).json({
    status: 'OK',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    message: 'Hệ thống Quản lý Chấm công Trường Đại học đang hoạt động bình thường.',
    collectionsCount: 14,
    collections: [
      'nguoi_dung',
      'mau_khuon_mat',
      'phong_ban',
      'ca_lam_viec',
      'mon_hoc',
      'lich_trinh',
      'ngay_nghi_le',
      'luot_quet_cham_cong',
      'nhat_ky_cham_cong',
      'don_nghi_phep',
      'phieu_luong',
      'ma_lam_moi',
      'cau_hinh_he_thong',
      'nhat_ky_kiem_toan',
    ],
    timestamp: new Date().toISOString(),
  });
});

// 6. Main API Routes (Chuẩn tiền tố /api và /api/v1)
app.use('/api', apiRoutes);
app.use('/api/v1', apiRoutes);

// 7. Phục vụ Frontend tĩnh (Production Single-Port Deployment)
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA Fallback: Mọi yêu cầu từ trình duyệt (Accept: text/html) đều trả về index.html của React Router
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path.startsWith('/api-docs') ||
      req.path.startsWith('/health')
    ) {
      return next();
    }
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml) && (req.accepts('html') || !req.accepts('json'))) {
      return res.sendFile(indexHtml);
    }
    next();
  });
} else {
  // Khi chưa build frontend (môi trường dev chỉ chạy backend)
  app.get('/', (req, res) => {
    res.json({
      message: 'Chào mừng đến với API Hệ thống Quản lý Chấm công Trường Đại học',
      swaggerDocs: '/api-docs',
      version: '1.0.0',
    });
  });
}

// Hỗ trợ trường hợp client gọi API trực tiếp không có tiền tố /api (Ví dụ Nginx proxy cắt mất tiền tố /api)
app.use(apiRoutes);

// 6. Error & 404 Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
