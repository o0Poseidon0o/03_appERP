// src/socket.ts
import { Server } from "socket.io";
import http from "http";

let io: Server;

export const initSocket = (httpServer: http.Server) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // Cho phép mọi nguồn (Frontend) kết nối. 
      // Nếu muốn bảo mật hơn, thay "*" bằng "http://localhost:5173"
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log("❌ Client disconnected");
    });
  });

  return io;
};

// Hàm này để lấy biến 'io' dùng trong Controller
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};