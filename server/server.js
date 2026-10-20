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
const { initCronJobs } = require('./services/cron.service');

const PORT = process.env.PORT || 5000;

// Kết nối CSDL MongoDB và khởi chạy Server
const startServer = async () => {
  try {
    await connectDB();

    // Khởi tạo các tiến trình chạy nền (node-cron)
    initCronJobs();

    // Khởi chạy Worker BullMQ xử lý hàng đợi điểm danh giờ cao điểm (5 luồng đồng thời)
    const { startPunchWorker, closePunchQueue } = require('./queues/punchQueue');
    startPunchWorker(5);

    // Tự động đồng bộ các vector khuôn mặt InsightFace vào FAISS RAM
    // Tự động đồng bộ các vector khuôn mặt InsightFace vào RAM
    setTimeout(async () => {
      try {
        const { ensureRamCacheWarm } = require('./services/faceServiceClient');
        await ensureRamCacheWarm();
      } catch (faissSyncErr) {
        console.warn('[Face Service] Bỏ qua đồng bộ vector lúc khởi động (Face Service có thể chưa sẵn sàng):', faissSyncErr.message);
      }
    }, 2000);

    const http = require('http');
    const server = http.createServer(app);

    // Khởi tạo Realtime Socket.IO Server
    const { initSocketServer, closeSocketServer } = require('./config/socket');
    initSocketServer(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`===================================================`);
      console.log(`[Server] Máy chủ đang chạy tại: http://localhost:${PORT}`);
      console.log(`[Realtime] WebSocket Socket.IO Server: SẴN SÀNG`);
      console.log(`[Swagger] Tài liệu API (Swagger UI): http://localhost:${PORT}/api-docs`);
      console.log(`===================================================`);
    });

    const shutdown = async () => {
      console.log('[Server] Đang đóng kết nối an toàn...');
      await closePunchQueue();
      await closeSocketServer();
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
