import { Request, Response, NextFunction } from 'express';
import prisma from '../../config/prisma';

// 1. Lấy danh sách thông báo của User đang đăng nhập
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id; // Lấy ID user từ token

    // Lấy 20 thông báo mới nhất
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Đếm số lượng chưa đọc (để hiển thị số đỏ trên chuông)
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false }
    });

    res.status(200).json({
      status: 'success',
      data: { notifications, unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Đánh dấu tất cả là đã đọc
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });

    res.status(200).json({ status: 'success', message: 'Đã đánh dấu đọc hết' });
  } catch (error) {
    next(error);
  }
};