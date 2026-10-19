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
    setTimeout(async () => {
      try {
        const { getCachedUsersWithFace } = require('./utils/attendanceHelpers');
        const { syncFaissTemplates } = require('./services/faceServiceClient');
        const users = await getCachedUsersWithFace();
        const templates = users
          .filter((u) => Array.isArray(u.faceDescriptors) && u.faceDescriptors.length > 0)
          .flatMap((u) =>
            u.faceDescriptors
              .filter((emb) => Array.isArray(emb) && emb.length === 512)
              .map((embedding) => ({ userId: u._id.toString(), embedding }))
          );
        if (templates.length > 0) {
          const faissRes = await syncFaissTemplates(templates);
          console.log(`[FAISS] ⚡ Đã nạp ${faissRes.data?.total_vectors || templates.length} vector đặc trưng vào RAM cho tìm kiếm siêu tốc (<50ms).`);
        }
      } catch (faissSyncErr) {
        console.warn('[FAISS] Bỏ qua đồng bộ vector lúc khởi động (Face Service có thể chưa sẵn sàng):', faissSyncErr.message);
      }
    }, 3000);

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
