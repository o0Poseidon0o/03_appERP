// import dotenv from 'dotenv';
// import app from './app';

// dotenv.config();

// const PORT = process.env.PORT || 3000;

// const server = app.listen(PORT, () => {
//   console.log(`✅ Server đang chạy tại port ${PORT}`);
// });

// // Xử lý lỗi Unhandled Rejection (ví dụ DB rớt mạng)
// process.on('unhandledRejection', (err: any) => {
//   console.log('UNHANDLED REJECTION! 💥 Đang tắt server...');
//   console.log(err.name, err.message);
//   server.close(() => {
//     process.exit(1);
//   });
// });

import dotenv from 'dotenv';
import https from 'https'; // [MỚI] Import module https
import fs from 'fs';       // [MỚI] Import module đọc file
import app from './app';

dotenv.config();

const PORT = process.env.PORT || 3000;

// [MỚI] Đọc 2 file chứng chỉ bạn vừa tạo
// Lưu ý: Đảm bảo file server.key và server.cert nằm cùng thư mục gốc (nơi bạn gõ lệnh npm start)
let httpsOptions;
try {
  httpsOptions = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert'),
  };
} catch (error) {
  console.error("❌ LỖI: Không tìm thấy file 'server.key' hoặc 'server.cert'!");
  console.error("👉 Vui lòng chạy lệnh tạo SSL trong hướng dẫn trước.");
  process.exit(1);
}

// [THAY ĐỔI] Thay app.listen (HTTP) thành https.createServer (HTTPS)
const server = https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`✅ Server HTTPS đang chạy tại port ${PORT}`);
  console.log(`🔒 Truy cập: https://192.168.20.17:${PORT}`);
});

// Xử lý lỗi Unhandled Rejection (ví dụ DB rớt mạng)
process.on('unhandledRejection', (err: any) => {
  console.log('UNHANDLED REJECTION! 💥 Đang tắt server...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
