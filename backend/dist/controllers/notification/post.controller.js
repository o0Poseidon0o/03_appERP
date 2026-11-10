"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPostDetail = exports.getMyPosts = exports.deletePost = exports.updatePost = exports.createPost = void 0;
const prisma_1 = __importDefault(require("../../config/prisma"));
const AppError_1 = require("../../utils/AppError");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const emailService_1 = require("../../services/emailService");
const deleteFileOnDisk = (filePath) => {
    try {
        const relativePath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
        const absolutePath = path_1.default.join(process.cwd(), relativePath);
        if (fs_1.default.existsSync(absolutePath)) {
            fs_1.default.unlinkSync(absolutePath);
            console.log(`>>> [SYSTEM] Đã xóa file rác: ${absolutePath}`);
        }
    }
    catch (error) {
        console.error(`>>> [ERROR] Lỗi khi xóa file ${filePath}:`, error);
    }
};
const createPost = async (req, res, next) => {
    try {
        const { title, content, menuId, targetDeptIds, attachments } = req.body;
        const authorId = req.user.id;
        const isPublic = !(targetDeptIds && Array.isArray(targetDeptIds) && targetDeptIds.length > 0);
        const post = await prisma_1.default.$transaction(async (tx) => {
            const newPost = await tx.post.create({
                data: {
                    title,
                    content,
                    menuId: Number(menuId),
                    authorId,
                    attachments: attachments || [],
                    published: true,
                    isPublic: isPublic,
                },
                include: { author: true },
            });
            if (!isPublic) {
                await tx.postDepartment.createMany({
                    data: targetDeptIds.map((deptId) => ({
                        postId: newPost.id,
                        departmentId: deptId,
                    })),
                });
            }
            return newPost;
        });
        const whereUserCondition = {
            isActive: true,
            email: { not: req.user.email },
        };
        if (!isPublic) {
            whereUserCondition.departmentId = { in: targetDeptIds };
        }
        const recipients = await prisma_1.default.user.findMany({
            where: whereUserCondition,
            select: { email: true },
        });
        const emailList = recipients.map((u) => u.email).filter(Boolean);
        if (emailList.length > 0) {
            (0, emailService_1.sendNewPostNotification)(emailList, post.title, post.author.fullName);
        }
        res.status(201).json({ status: "success", data: post });
    }
    catch (error) {
        next(error);
    }
};
exports.createPost = createPost;
const updatePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, menuId, targetDeptIds, attachments, published } = req.body;
        const oldPost = await prisma_1.default.post.findUnique({ where: { id } });
        if (!oldPost)
            return next(new AppError_1.AppError("Bài viết không tồn tại", 404));
        const isPublic = !(targetDeptIds && Array.isArray(targetDeptIds) && targetDeptIds.length > 0);
        const updatedPost = await prisma_1.default.$transaction(async (tx) => {
            const post = await tx.post.update({
                where: { id },
                data: {
                    title,
                    content,
                    attachments: attachments || [],
                    published,
                    isPublic: isPublic,
                    menuId: menuId ? Number(menuId) : undefined,
                },
            });
            if (targetDeptIds) {
                await tx.postDepartment.deleteMany({ where: { postId: id } });
                if (!isPublic) {
                    await tx.postDepartment.createMany({
                        data: targetDeptIds.map((deptId) => ({
                            postId: id,
                            departmentId: deptId,
                        })),
                    });
                }
            }
            return post;
        });
        const oldFiles = oldPost.attachments || [];
        const newFiles = attachments || [];
        const filesToDelete = oldFiles.filter((oldF) => !newFiles.some((newF) => newF.path === oldF.path));
        filesToDelete.forEach((file) => {
            if (file.type !== "link" && file.path) {
                deleteFileOnDisk(file.path);
            }
        });
        res.status(200).json({ status: "success", data: updatedPost });
    }
    catch (error) {
        next(error);
    }
};
exports.updatePost = updatePost;
const deletePost = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await prisma_1.default.post.findUnique({ where: { id } });
        if (!post)
            return next(new AppError_1.AppError("Bài viết không tồn tại", 404));
        await prisma_1.default.$transaction([
            prisma_1.default.postDepartment.deleteMany({ where: { postId: id } }),
            prisma_1.default.post.delete({ where: { id } }),
        ]);
        const attachments = post.attachments;
        if (attachments && Array.isArray(attachments)) {
            attachments.forEach((file) => {
                if (file.type !== "link" && file.path) {
                    deleteFileOnDisk(file.path);
                }
            });
        }
        res.status(200).json({ status: "success", message: "Đã xóa bài viết thành công" });
    }
    catch (error) {
        next(error);
    }
};
exports.deletePost = deletePost;
const getMyPosts = async (req, res, next) => {
    try {
        const { menuId, limit, page } = req.query;
        const user = req.user;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 10;
        const skip = (pageNum - 1) * limitNum;
        const where = { published: true };
        if (menuId)
            where.menuId = Number(menuId);
        if (!["ROLE-ADMIN", "ROLE-MANAGER"].includes(user.roleId || "")) {
            where.OR = [
                { isPublic: true },
                {
                    targets: {
                        some: { departmentId: user.departmentId }
                    }
                }
            ];
        }
        const [posts, total] = await prisma_1.default.$transaction([
            prisma_1.default.post.findMany({
                where,
                include: {
                    author: { select: { fullName: true } },
                    menu: { select: { title: true } },
                    targets: { include: { department: true } },
                },
                orderBy: { createdAt: "desc" },
                take: limitNum,
                skip: skip,
            }),
            prisma_1.default.post.count({ where }),
        ]);
        res.status(200).json({ status: "success", data: posts, total, page: pageNum });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyPosts = getMyPosts;
const getPostDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const post = await prisma_1.default.post.findUnique({
            where: { id },
            include: {
                author: true,
                targets: { include: { department: true } },
            },
        });
        if (!post)
            return next(new AppError_1.AppError("Không tìm thấy bài viết", 404));
        res.status(200).json({ status: "success", data: post });
    }
    catch (error) {
        next(error);
    }
};
exports.getPostDetail = getPostDetail;
