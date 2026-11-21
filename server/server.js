// Điểm khởi chạy chính của máy chủ: kiểm tra cấu hình, kết nối CSDL, chạy nền, Socket.IO và HTTP server.
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

require('dotenv').config({ quiet: true });

try {
  require('./config/env').validateEnvironment();
} catch (error) {
  console.error('[Configuration Error]', error.message);
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');
const { sequelize } = connectDB;
const { initCronJobs, stopCronJobs } = require('./services/heThong/tacVuDinhKy.service');
const { loadConfigsIntoCache } = require('./services/heThong/cauHinhHeThong.service');

const PORT = process.env.PORT || 5000;

// Kết nối CSDL, khởi chạy tiến trình nền, Socket.IO và lắng nghe HTTP
const startServer = async () => {
  try {
    await connectDB();
    await loadConfigsIntoCache(true).catch((err) => {
      console.warn('[SystemConfig] Không thể nạp cache cấu hình lúc khởi động:', err.message);
    });

    // Khởi chạy các tác vụ định kỳ (node-cron)
    initCronJobs();

    // Khởi chạy worker xử lý hàng đợi chấm công và tự khởi động lại khi Redis ready lại
    const { startPunchWorker, closePunchQueue } = require('./queues/hangDoiChamCong');
    const { getRedisClient, closeRedis } = require('./config/redis');
    startPunchWorker(5);
    const redisCli = getRedisClient();
    if (redisCli && typeof redisCli.on === 'function') {
      redisCli.on('ready', () => {
        startPunchWorker(5);
      });
    }

    // Nạp sẵn vector khuôn mặt vào RAM dịch vụ AI sau khi khởi động
    setTimeout(async () => {
      try {
        const { ensureRamCacheWarm } = require('./services/khuonMat/ketNoiDichVuKhuonMat');
        await ensureRamCacheWarm();
      } catch (faissSyncErr) {
        console.warn('[Face Service] Bỏ qua đồng bộ vector lúc khởi động (Face Service có thể chưa sẵn sàng):', faissSyncErr.message);
      }
    }, 2000);

    const http = require('http');
    const server = http.createServer(app);

    // Khởi tạo máy chủ WebSocket Socket.IO
    const { initSocketServer, closeSocketServer } = require('./config/socket');
    initSocketServer(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`===================================================`);
      console.log(`[Server] Máy chủ đang chạy tại: http://localhost:${PORT}`);
      console.log(`[Realtime] WebSocket Socket.IO Server: SẴN SÀNG`);
      console.log(`[Swagger] Tài liệu API (Swagger UI): http://localhost:${PORT}/tai-lieu-api`);
      console.log(`===================================================`);
    });

    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log('[Server] Đang đóng kết nối an toàn...');
      stopCronJobs();
      await closePunchQueue();
      await closeSocketServer();
      await closeRedis().catch(() => {});
      await sequelize.close().catch(() => {});
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('[Server Error] Không thể khởi chạy Server:', error);
    process.exit(1);
  }
};

startServer();
