import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';

import { AppError } from './utils/AppError';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import deptRoutes from './routes/department.routes';
import roleRoutes from './routes/role.routes';
import notiRoutes from './routes/notification.routes';
import menuRoutes from './routes/menu.routes';
import postRoutes from './routes/post.routes';
import uploadRoutes from './routes/upload.routes';
import factoryRouter from './routes/factory.route';

// --- NHÓM KHO (WMS) ---
import warehouseRoutes from './routes/warehouse/warehouse.routes';
import itemRoutes from './routes/warehouse/item.routes';
import stockRoutes from './routes/warehouse/stockTransaction.routes';
// 1. Import thêm route Supplier ở đây
import supplierRoutes from './routes/warehouse/supplier.routes';


const app = express();

// --- 1. GLOBAL MIDDLEWARES ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
  })
);

app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- 2. STATIC FILES ---
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- 3. ROUTES ---
app.get('/', (req: Request, res: Response) => {
  res.send('🚀 TowaERP Backend is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notiRoutes);
app.use('/api/factories', factoryRouter);

// --- ROUTES KHO ---
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/stock-transactions', stockRoutes);
// 2. Khai báo API cho Suppliers
app.use('/api/suppliers', supplierRoutes); 

// --- 4. ERROR HANDLING ---
app.all('*', (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404));
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
});

export default app;