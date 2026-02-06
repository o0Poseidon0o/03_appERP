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
import supplierRoutes from './routes/warehouse/supplier.routes';

// --- [MỚI] IMPORT WORKFLOW ROUTES ---
import workflowRoutes from './routes/workflow.routes';
import ticketRoutes from './routes/ticket.routes';
// -------------Quản lý thiết bị ITAM ---------------
import assetRoutes from './routes/itam/asset.routes';
import assetTypeRoutes from "./routes/itam/assetType.routes";
import dashboardRoutes from './routes/itam/dashboard.routes';

import maintenanceRoutes from './routes/itam/maintenance.routes';


const app = express();

// --- [SỬA LỖI 413] TĂNG GIỚI HẠN KÍCH THƯỚC BODY ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// --- 2. STATIC FILES ---
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// --- 3. ROUTES ---
app.get('/', (req: Request, res: Response) => {
  res.send('🚀 TowaERP Backend is running!');
});

// System Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notiRoutes);
app.use('/api/factories', factoryRouter);

// Warehouse Routes
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/stock-transactions', stockRoutes);
app.use('/api/suppliers', supplierRoutes);

// --- [MỚI] WORKFLOW ENGINE ROUTES ---
// Endpoint này dùng để quản lý cấu hình quy trình duyệt (CRUD)
app.use('/api/workflows', workflowRoutes);
app.use('/api/tickets', ticketRoutes);
// ----Quản lý thiết bị ITAM ----
app.use('/api/assets', assetRoutes);
app.use('/api/asset-types', assetTypeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/maintenance", maintenanceRoutes);

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