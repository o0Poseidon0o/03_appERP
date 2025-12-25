import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppError } from './utils/AppError';

// --- IMPORT ROUTES ---
import userRoutes from './routes/user.routes'; 

const app = express();

// 1. Global Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json()); 
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 2. Routes
app.get('/', (req, res) => {
  res.send('🚀 TowaERP Backend is running!');
});

// --> BỔ SUNG ROUTE USER TẠI ĐÂY
app.use('/api/users', userRoutes);

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