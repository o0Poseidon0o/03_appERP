import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { AppError } from './utils/AppError';
import authRoutes from './routes/auth.routes';
// --- IMPORT ROUTES ---
import userRoutes from './routes/user.routes';
import deptRoutes from './routes/department.routes'
import roleRoutes from './routes/role.routes';

import notiRoutes from './routes/notification.routes';
import menuRoutes from './routes/menu.routes';
import postRoutes from './routes/post.routes';
import uploadRoutes from './routes/upload.routes';
const app = express();

// 1. Global Middlewares
// 1. Cấu hình Helmet (QUAN TRỌNG NHẤT ĐỂ SỬA LỖI NotSameOrigin)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } 
}));
app.use(cors({
  origin: '*', // Hoặc điền cụ thể 'http://localhost:5173' để an toàn hơn
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
  credentials: true
}));
app.use(express.json()); 
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 2. Routes
app.get('/', (req, res) => {
  res.send('🚀 TowaERP Backend is running!');
});

app.use('/api/auth', authRoutes); // Đường dẫn sẽ là: /api/auth/login
app.use('/api/users', userRoutes);

app.use('/api/departments', deptRoutes);
app.use('/api/roles', roleRoutes);
// process.cwd() lấy thư mục gốc nơi chạy lệnh npm run dev (tức là thư mục backend/)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/menus', menuRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notiRoutes);


// 3. Xử lý lỗi 404 (Route not found)
app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404));
});

// 4. Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;