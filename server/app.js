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

// Tài liệu API (Swagger UI): chỉ mở ngoài production hoặc khi bật tường minh ENABLE_SWAGGER_PROD=true
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER_PROD === 'true') {
  const swaggerUiOptions = {
    customSiteTitle: 'Tài Liệu API - Hệ Thống Quản Lý Chấm Công',
    swaggerOptions: {
      persistAuthorization: true,
    },
  };
  app.use('/tai-lieu-api', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

// Kiểm tra trạng thái hoạt động của máy chủ và CSDL (dùng chung handler an toàn từ routes/index.js)
app.get('/suc-khoe', apiRoutes.healthCheckHandler);

// Vô hiệu hóa ETag & cache HTTP cho toàn bộ API để tránh trình duyệt dùng lại dữ liệu cũ sau khi cập nhật/đổi tài khoản
app.set('etag', false);
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Gắn toàn bộ API chính dưới tiền tố /api (đã áp dụng apiGeneralLimiter)
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

// Xử lý 404 và lỗi tập trung (không mount trùng apiRoutes ngoài /api để tránh vượt rào Rate Limit)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
