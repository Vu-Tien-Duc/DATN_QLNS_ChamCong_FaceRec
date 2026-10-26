/**
 * socket.ts - Quản lý kết nối Realtime Socket.IO Client (CSDL v2.5)
 */
import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token =
      useAuthStore.getState().token ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('token');

    const socketUrl = (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin;

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
      // console.log('[Socket.IO Realtime] Connected:', socketInstance?.id);
    });

    socketInstance.on('connect_error', () => {
      // Fallback polling silently
    });
  }

  return socketInstance;
}

export function updateSocketAuthToken(token: string) {
  if (socketInstance) {
    socketInstance.auth = { token };
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export function useSocketEvent<T = any>(event: string, handler: (data: T) => void) {
  useEffect(() => {
    const s = getSocket();
    s.on(event, handler);

    return () => {
      s.off(event, handler);
    };
  }, [event, handler]);
}

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
