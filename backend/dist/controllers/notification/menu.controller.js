"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMenu = exports.deleteMenu = exports.createMenu = exports.getMenus = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const getMenus = async (req, res, next) => {
    try {
        const menus = await prisma_1.default.menu.findMany({
            where: { parentId: null },
            include: {
                children: {
                    orderBy: { order: "asc" },
                    include: { _count: { select: { posts: true } } }
                },
                _count: { select: { posts: true } }
            },
            orderBy: { order: "asc" },
        });
        res.status(200).json({ status: "success", data: menus });
    }
    catch (error) {
        next(error);
    }
};
exports.getMenus = getMenus;
const createMenu = async (req, res, next) => {
    try {
        const { title, slug, order, parentId, isVisible } = req.body;
        const newMenu = await prisma_1.default.menu.create({
            data: {
                title,
                slug,
                order: order || 0,
                parentId: parentId || null,
                isVisible: isVisible ?? true,
            },
        });
        res.status(201).json({ status: "success", data: newMenu });
    }
    catch (error) {
        next(error);
    }
};
exports.createMenu = createMenu;
const deleteMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const menuId = Number(id);
        const menu = await prisma_1.default.menu.findUnique({
            where: { id: menuId },
            include: { _count: { select: { children: true, posts: true } } },
        });
        if (!menu)
            return next(new AppError_1.AppError("Menu không tồn tại", 404));
        if (menu._count.children > 0 || menu._count.posts > 0) {
            return next(new AppError_1.AppError("Không thể xóa Menu này vì đang chứa menu con hoặc bài viết.", 400));
        }
        await prisma_1.default.menu.delete({ where: { id: menuId } });
        res.status(200).json({ status: "success", message: "Đã xóa menu" });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteMenu = deleteMenu;
const updateMenu = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, slug, order, isVisible } = req.body;
        const updatedMenu = await prisma_1.default.menu.update({
            where: { id: Number(id) },
            data: {
                title,
                slug,
                order: order ? Number(order) : 0,
                isVisible: isVisible
            }
        });
        res.status(200).json({ status: 'success', data: updatedMenu, message: 'Cập nhật thành công' });
    }
    catch (error) {
        next(error);
    }
};
exports.updateMenu = updateMenu;
