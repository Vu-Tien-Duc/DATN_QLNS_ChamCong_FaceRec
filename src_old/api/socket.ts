/**
 * socket.ts - Quản lý kết nối Realtime Socket.IO Client
 *
 * Tính năng chính:
 * 1. Tự động đính kèm JWT Access Token từ Zustand Store RAM (useAuthStore).
 * 2. Tự động phục hồi kết nối (Auto Reconnection với Exponential Backoff).
 * 3. Hỗ trợ Hook useSocketEvent lắng nghe sự kiện tức thì (< 100ms).
 * 4. Ngắt kết nối sạch sẽ khi đăng xuất để tránh rò rỉ tài nguyên mạng.
 */

import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

let socketInstance: Socket | null = null;

/**
 * Lấy hoặc khởi tạo kết nối Socket.IO Client
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    const token = useAuthStore.getState().accessToken;
    // Trong môi trường dev, kết nối trực tiếp đến backend host nếu chạy vite riêng biệt
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    socketInstance = io(socketUrl, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      // console.log('[Socket.IO Realtime] Đã kết nối thành công:', socketInstance?.id);
    });

    socketInstance.on('connect_error', (err) => {
      // console.warn('[Socket.IO Realtime] Lỗi kết nối:', err.message);
    });
  }

  return socketInstance;
}

/**
 * Cập nhật token mới khi refresh token thành công
 */
export function updateSocketAuthToken(token: string) {
  if (socketInstance) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }
}

/**
 * Ngắt kết nối socket khi đăng xuất
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

/**
 * Hook lắng nghe sự kiện Realtime từ Server
 * @param event Tên sự kiện (VD: 'attendance:new-punch', 'security:fraud-alert')
 * @param handler Callback xử lý dữ liệu nhận được
 */
export function useSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, handler);

    return () => {
      s.off(event, handler);
    };
  }, [event, handler]);
}

/**
 * Hook theo dõi trạng thái kết nối Realtime
 */
export function useSocketStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(() => {
    return socketInstance ? socketInstance.connected : false;
  });

  useEffect(() => {
    const s = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    setIsConnected(s.connected);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  return isConnected;
}
