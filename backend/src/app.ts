import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { AppError } from './utils/AppError';
import authRoutes from './routes/auth.routes';
// --- IMPORT ROUTES ---
import userRoutes from './routes/user.routes';
import deptRoutes from './routes/department.routes';
import roleRoutes from './routes/role.routes';

import notiRoutes from './routes/notification.routes';
import menuRoutes from './routes/menu.routes';
import postRoutes from './routes/post.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();

// --- 1. GLOBAL MIDDLEWARES ---

// Cấu hình Helmet để sửa lỗi ảnh không hiển thị (Cross-Origin Resource Policy)
app.use(
  helmet({
    // Cho phép trình duyệt tải tài nguyên (ảnh/file) từ server này sang domain frontend
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Tắt Content Security Policy nếu bạn đang dùng các link ảnh ngoài (như placeholder) để tránh bị chặn
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: '*', // Trong thực tế nên thay bằng 'http://localhost:5173'
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
  })
);

app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- 2. STATIC FILES (QUAN TRỌNG) ---

// Khai báo thư mục tĩnh trước các API routes để đảm bảo ưu tiên truy cập file
// path.join(process.cwd(), 'uploads') đảm bảo tìm đúng thư mục uploads từ gốc dự án
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- 3. ROUTES ---

app.get('/', (req: Request, res: Response) => {
  res.send('🚀 TowaERP Backend is running!');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notiRoutes);

// --- 4. ERROR HANDLING ---

// Xử lý lỗi 404 (Route not found)
app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404));
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

export default app;