import { Request, Response, NextFunction } from "express";
import prisma from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import fs from "fs";
import path from "path";
import { sendNewPostNotification } from "../../services/emailService"; // Import service gửi mail

// ==============================================================================
// HÀM HỖ TRỢ: XÓA FILE TRÊN Ổ CỨNG (Clean up)
// ==============================================================================
const deleteFileOnDisk = (filePath: string) => {
  try {
    const relativePath = filePath.startsWith("/") ? filePath.substring(1) : filePath;
    const absolutePath = path.join(process.cwd(), relativePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`>>> [SYSTEM] Đã xóa file rác: ${absolutePath}`);
    }
  } catch (error) {
    console.error(`>>> [ERROR] Lỗi khi xóa file ${filePath}:`, error);
  }
};

// ==============================================================================
// 1. TẠO BÀI VIẾT (Create Post)
// ==============================================================================
export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, menuId, targetDeptIds, attachments } = req.body;
    const authorId = req.user!.id;

    // 1. Xác định bài viết có công khai hay không
    const isPublic = !(targetDeptIds && Array.isArray(targetDeptIds) && targetDeptIds.length > 0);

    // 2. Thực hiện lưu vào Database (Transaction)
    const post = await prisma.$transaction(async (tx) => {
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
          data: targetDeptIds.map((deptId: string) => ({
            postId: newPost.id,
            departmentId: deptId,
          })),
        });
      }
      return newPost;
    });

    // 3. LOGIC LẤY DANH SÁCH NGƯỜI NHẬN EMAIL (Gmail & Nội bộ)
    const whereUserCondition: any = {
      isActive: true,
      email: { not: req.user!.email }, // Không gửi cho chính mình
    };

    // Nếu gửi theo phòng ban, lọc user thuộc các phòng đó
    if (!isPublic) {
      whereUserCondition.departmentId = { in: targetDeptIds };
    }

    const recipients = await prisma.user.findMany({
      where: whereUserCondition,
      select: { email: true },
    });

    const emailList = recipients.map((u) => u.email).filter(Boolean);

    // 4. Gửi Mail thông báo (Gửi BCC theo đợt)
    if (emailList.length > 0) {
      sendNewPostNotification(emailList, post.title, post.author.fullName);
    }

    res.status(201).json({ status: "success", data: post });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 2. CẬP NHẬT BÀI VIẾT (Update Post)
// ==============================================================================
export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, content, menuId, targetDeptIds, attachments, published } = req.body;

    const oldPost = await prisma.post.findUnique({ where: { id } });
    if (!oldPost) return next(new AppError("Bài viết không tồn tại", 404));

    // Xác định isPublic mới dựa trên dữ liệu gửi lên
    const isPublic = !(targetDeptIds && Array.isArray(targetDeptIds) && targetDeptIds.length > 0);

    const updatedPost = await prisma.$transaction(async (tx) => {
      const post = await tx.post.update({
        where: { id },
        data: {
          title,
          content,
          attachments: attachments || [],
          published,
          isPublic: isPublic, // Cập nhật lại isPublic
          menuId: menuId ? Number(menuId) : undefined,
        },
      });

      if (targetDeptIds) {
        // Xóa hết các target cũ để làm mới
        await tx.postDepartment.deleteMany({ where: { postId: id } });
        
        if (!isPublic) {
          await tx.postDepartment.createMany({
            data: targetDeptIds.map((deptId: string) => ({
              postId: id,
              departmentId: deptId,
            })),
          });
        }
      }
      return post;
    });

    // Dọn dẹp file thừa
    const oldFiles = (oldPost.attachments as any[]) || [];
    const newFiles = (attachments as any[]) || [];
    const filesToDelete = oldFiles.filter(
      (oldF) => !newFiles.some((newF) => newF.path === oldF.path)
    );

    filesToDelete.forEach((file) => {
      if (file.type !== "link" && file.path) {
        deleteFileOnDisk(file.path);
      }
    });

    res.status(200).json({ status: "success", data: updatedPost });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 3. XÓA BÀI VIẾT (Delete Post)
// ==============================================================================
export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return next(new AppError("Bài viết không tồn tại", 404));

    await prisma.$transaction([
      prisma.postDepartment.deleteMany({ where: { postId: id } }),
      prisma.post.delete({ where: { id } }),
    ]);

    const attachments = post.attachments as any[];
    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((file: any) => {
        if (file.type !== "link" && file.path) {
          deleteFileOnDisk(file.path);
        }
      });
    }

    res.status(200).json({ status: "success", message: "Đã xóa bài viết thành công" });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 4. LẤY DANH SÁCH BÀI VIẾT (Get Posts) - Có phân quyền
// ==============================================================================
export const getMyPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId, limit, page } = req.query;
    const user = req.user!;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: any = { published: true };
    if (menuId) where.menuId = Number(menuId);

    // Phân quyền: User thường chỉ thấy bài Public hoặc đúng phòng ban của mình
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

    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({
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
      prisma.post.count({ where }),
    ]);

    res.status(200).json({ status: "success", data: posts, total, page: pageNum });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 5. CHI TIẾT BÀI VIẾT (Get Detail)
// ==============================================================================
export const getPostDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        targets: { include: { department: true } },
      },
    });

    if (!post) return next(new AppError("Không tìm thấy bài viết", 404));

    res.status(200).json({ status: "success", data: post });
  } catch (error) {
    next(error);
  }
};