import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";

// 1. Lấy toàn bộ Menu (Phân cấp cha con)
// Sửa hàm getMenus
// src/controllers/menu.controller.ts

export const getMenus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const menus = await prisma.menu.findMany({
      where: { parentId: null }, // <--- XÓA "isVisible: true" Ở ĐÂY
      include: {
        children: {
          // where: { isVisible: true }, // <--- XÓA LUÔN Ở ĐÂY (Hoặc giữ tùy logic)
          orderBy: { order: "asc" },
          include: { _count: { select: { posts: true } } }
        },
        _count: { select: { posts: true } }
      },
      orderBy: { order: "asc" },
    });

    res.status(200).json({ status: "success", data: menus });
  } catch (error) {
    next(error);
  }
};

// 2. Tạo Menu mới
export const createMenu = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, slug, order, parentId, isVisible } = req.body;

    const newMenu = await prisma.menu.create({
      data: {
        title,
        slug,
        order: order || 0,
        parentId: parentId || null, // Nếu không truyền parentId thì là menu gốc
        isVisible: isVisible ?? true,
      },
    });

    res.status(201).json({ status: "success", data: newMenu });
  } catch (error) {
    next(error);
  }
};

// 3. Xóa Menu
export const deleteMenu = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const menuId = Number(id); // ID menu là Int

    // Kiểm tra có con không?
    const menu = await prisma.menu.findUnique({
      where: { id: menuId },
      include: { _count: { select: { children: true, posts: true } } },
    });

    if (!menu) return next(new AppError("Menu không tồn tại", 404));

    if (menu._count.children > 0 || menu._count.posts > 0) {
      return next(
        new AppError(
          "Không thể xóa Menu này vì đang chứa menu con hoặc bài viết.",
          400
        )
      );
    }

    await prisma.menu.delete({ where: { id: menuId } });
    res.status(200).json({ status: "success", message: "Đã xóa menu" });
  } catch (error) {
    next(error);
  }
};
export const updateMenu = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, slug, order, isVisible } = req.body;

    const updatedMenu = await prisma.menu.update({
      where: { id: Number(id) },
      data: {
        title,
        slug,
        order: order ? Number(order) : 0,
        isVisible: isVisible
      }
    });

    res.status(200).json({ status: 'success', data: updatedMenu, message: 'Cập nhật thành công' });
  } catch (error) {
    next(error);
  }
};