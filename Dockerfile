# =============================================================================
# Dockerfile Multi-Stage Build cho Hệ Thống Quản Lý Chấm Công Trường Đại Học
# Đồ án tốt nghiệp: Vũ Tiến Đức - MSV: 2310900023
# Giai đoạn 1: Biên dịch Frontend React + Vite + TailwindCSS
# Giai đoạn 2: Máy chủ Node.js Express phục vụ API & Static Files
# =============================================================================

# -------------------------------------------------------------
# Stage 1: Build Frontend (Vite + TypeScript)
# -------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt toàn bộ dependencies bao gồm cả devDependencies để biên dịch
COPY package*.json ./
RUN npm ci

# Sao chép mã nguồn frontend và cấu hình build
COPY index.html ./
COPY tsconfig*.json ./
COPY vite.config.mts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY public ./public
COPY src ./src

# Biên dịch mã nguồn React sang thư mục dist
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Server (Node.js Express)
# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Cài đặt curl để hỗ trợ container healthcheck
RUN apk add --no-cache curl

ENV NODE_ENV=production \
    PORT=5000

# Chỉ cài đặt dependencies dành cho production runtime
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Sao chép mã nguồn backend
COPY server ./server

# Sao chép bản build frontend tĩnh từ Stage 1
COPY --from=builder /app/dist ./dist

# Tạo thư mục uploads cho lưu trữ hình ảnh minh chứng và khuôn mặt
RUN mkdir -p /app/uploads

EXPOSE 5000

# Kiểm tra sức khỏe container định kỳ
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Khởi chạy máy chủ Express
CMD ["node", "server/server.js"]
