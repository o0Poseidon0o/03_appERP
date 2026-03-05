import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

// 1. Định nghĩa kiểu dữ liệu cho Context
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

// 2. Tạo Context với giá trị mặc định
const SocketContext = createContext<SocketContextType>({ 
    socket: null, 
    isConnected: false 
});

// 3. Hook tùy chỉnh để các component con dễ dàng sử dụng
export const useSocket = () => useContext(SocketContext);

// 4. Provider Component (Bọc lấy toàn bộ ứng dụng)
interface SocketProviderProps {
    children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // [QUAN TRỌNG] Lấy URL từ biến môi trường (để dễ thay đổi IP Server)
    // Nếu không có biến môi trường thì fallback về localhost (chỉ chạy dev)
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

    // console.log("🔌 Connecting Socket to:", SOCKET_URL);

    // Khởi tạo kết nối
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"], // Ưu tiên Websocket
      withCredentials: true,                // Cho phép cookie nếu cần
      reconnectionAttempts: 5,              // Thử lại 5 lần nếu mất mạng
    });

    // Lắng nghe sự kiện kết nối
    newSocket.on("connect", () => {
        // console.log("✅ Socket connected:", newSocket.id);
        setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
        console.log("❌ Socket disconnected");
        setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup: Ngắt kết nối khi App bị tắt (unmount)
    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};