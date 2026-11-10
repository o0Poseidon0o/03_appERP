"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.getMyNotifications = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const getMyNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const notifications = await prisma_1.default.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        const unreadCount = await prisma_1.default.notification.count({
            where: { userId, isRead: false }
        });
        res.status(200).json({
            status: 'success',
            data: { notifications, unreadCount }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyNotifications = getMyNotifications;
const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        await prisma_1.default.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        res.status(200).json({ status: 'success', message: 'Đã đánh dấu đọc hết' });
    }
    catch (error) {
        next(error);
    }
};
exports.markAllAsRead = markAllAsRead;
