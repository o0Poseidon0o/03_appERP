import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại port ${PORT}`);
});

// Xử lý lỗi Unhandled Rejection (ví dụ DB rớt mạng)
process.on('unhandledRejection', (err: any) => {
  console.log('UNHANDLED REJECTION! 💥 Đang tắt server...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});