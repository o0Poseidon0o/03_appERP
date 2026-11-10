"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const AppError_1 = require("./utils/AppError");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const department_routes_1 = __importDefault(require("./routes/department.routes"));
const role_routes_1 = __importDefault(require("./routes/role.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const post_routes_1 = __importDefault(require("./routes/post.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const factory_route_1 = __importDefault(require("./routes/factory.route"));
const warehouse_routes_1 = __importDefault(require("./routes/warehouse/warehouse.routes"));
const item_routes_1 = __importDefault(require("./routes/warehouse/item.routes"));
const stockTransaction_routes_1 = __importDefault(require("./routes/warehouse/stockTransaction.routes"));
const supplier_routes_1 = __importDefault(require("./routes/warehouse/supplier.routes"));
const workflow_routes_1 = __importDefault(require("./routes/workflow.routes"));
const ticket_routes_1 = __importDefault(require("./routes/ticket.routes"));
const asset_routes_1 = __importDefault(require("./routes/itam/asset.routes"));
const assetType_routes_1 = __importDefault(require("./routes/itam/assetType.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/itam/dashboard.routes"));
const softwareInventoryRoutes_1 = __importDefault(require("./routes/itam/softwareInventoryRoutes"));
const maintenance_routes_1 = __importDefault(require("./routes/itam/maintenance.routes"));
const networkRoutes_1 = __importDefault(require("./routes/itam/networkRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    credentials: true,
}));
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.get('/', (req, res) => {
    res.send('🚀 TowaERP Backend is running!');
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', user_routes_1.default);
app.use('/api/departments', department_routes_1.default);
app.use('/api/roles', role_routes_1.default);
app.use('/api/menus', menu_routes_1.default);
app.use('/api/posts', post_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/factories', factory_route_1.default);
app.use('/api/warehouses', warehouse_routes_1.default);
app.use('/api/items', item_routes_1.default);
app.use('/api/stock-transactions', stockTransaction_routes_1.default);
app.use('/api/suppliers', supplier_routes_1.default);
app.use('/api/workflows', workflow_routes_1.default);
app.use('/api/tickets', ticket_routes_1.default);
app.use('/api/assets', asset_routes_1.default);
app.use('/api/itam/assets', asset_routes_1.default);
app.use('/api/asset-types', assetType_routes_1.default);
app.use("/api/dashboard", dashboard_routes_1.default);
app.use("/api/maintenance", maintenance_routes_1.default);
app.use("/api/itam/software", softwareInventoryRoutes_1.default);
app.use("/api/itam/network", networkRoutes_1.default);
app.all('*', (req, res, next) => {
    next(new AppError_1.AppError(`Không tìm thấy đường dẫn: ${req.originalUrl}`, 404));
});
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
    });
});
exports.default = app;
