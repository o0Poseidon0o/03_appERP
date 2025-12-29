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
    // filePath trong DB dạng: "/uploads/filename.jpg"
    // Cần chuyển thành đường dẫn tuyệt đối của hệ thống: "C:\Project\backend\uploads\filename.jpg"

    // 1. Bỏ dấu "/" ở đầu nếu có
    const relativePath = filePath.startsWith("/")
      ? filePath.substring(1)
      : filePath;

    // 2. Tạo đường dẫn tuyệt đối
    const absolutePath = path.join(process.cwd(), relativePath);

    // 3. Kiểm tra file có tồn tại không rồi xóa
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
// - Lưu bài viết vào DB
// - Lưu quan hệ với phòng ban (nếu có)
// - Gửi Email thông báo
// ==============================================================================
export const createPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, menuId, targetDeptIds, attachments } = req.body;
    const authorId = req.user!.id;

    // Xác định bài viết có công khai hay không
    // Nếu có chọn phòng ban -> isPublic = false
    const isPublic = !(targetDeptIds && Array.isArray(targetDeptIds) && targetDeptIds.length > 0);

    const post = await prisma.$transaction(async (tx) => {
      const newPost = await tx.post.create({
        data: {
          title,
          content,
          menuId: Number(menuId),
          authorId,
          attachments: attachments || [],
          published: true,
          isPublic: isPublic, // <--- Cập nhật giá trị này
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

    // ... (Phần gửi Mail giữ nguyên logic cũ của bạn) ...
    res.status(201).json({ status: "success", data: post });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 2. CẬP NHẬT BÀI VIẾT (Update Post)
// - Cập nhật nội dung
// - Cập nhật target phòng ban
// - Xóa file cũ nếu người dùng đã gỡ bỏ khỏi bài viết
// ==============================================================================
export const updatePost = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, content, menuId, targetDeptIds, attachments, published } =
      req.body;

    // 1. Lấy dữ liệu cũ để so sánh file
    const oldPost = await prisma.post.findUnique({ where: { id } });
    if (!oldPost) return next(new AppError("Bài viết không tồn tại", 404));

    // 2. Thực hiện Update trong Transaction
    const updatedPost = await prisma.$transaction(async (tx) => {
      // Update bảng Post
      const post = await tx.post.update({
        where: { id },
        data: {
          title,
          content,
          attachments: attachments || [],
          published,
          menuId: menuId ? Number(menuId) : undefined,
        },
      });

      // Update bảng Target (Cách an toàn: Xóa hết cũ -> Tạo mới)
      // Nếu có gửi targetDeptIds lên (kể cả mảng rỗng) thì mới update
      if (targetDeptIds) {
        await tx.postDepartment.deleteMany({ where: { postId: id } });

        if (Array.isArray(targetDeptIds) && targetDeptIds.length > 0) {
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

    // 3. Dọn dẹp file thừa (Clean up)
    const oldFiles = (oldPost.attachments as any[]) || [];
    const newFiles = (attachments as any[]) || [];

    // Tìm những file có trong CŨ mà KHÔNG có trong MỚI => User đã xóa
    const filesToDelete = oldFiles.filter(
      (oldF) => !newFiles.some((newF) => newF.path === oldF.path)
    );

    filesToDelete.forEach((file) => {
      // Chỉ xóa nếu là file/image (không xóa link)
      if (file.type !== "link" && file.path) {
        deleteFileOnDisk(file.path);
      }
    });

    res
      .status(200)
      .json({
        status: "success",
        data: updatedPost,
        message: "Cập nhật thành công",
      });
  } catch (error) {
    next(error);
  }
};

// ==============================================================================
// 3. XÓA BÀI VIẾT (Delete Post)
// - Xóa DB
// - Xóa sạch file đính kèm trên ổ cứng
// ==============================================================================
export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 1. Kiểm tra bài viết tồn tại
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return next(new AppError("Bài viết không tồn tại", 404));

    // 2. Sử dụng Transaction để đảm bảo xóa sạch dữ liệu liên quan
    await prisma.$transaction([
      // Xóa các liên kết với phòng ban trước
      prisma.postDepartment.deleteMany({ where: { postId: id } }),
      // Sau đó mới xóa bài viết chính
      prisma.post.delete({ where: { id } }),
    ]);

    // 3. Xóa file đính kèm trên ổ cứng (giữ nguyên logic cũ của bạn)
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
// 4. LẤY DANH SÁCH BÀI VIẾT (Get Posts)
// - Có phân trang
// - Có phân quyền (User thường chỉ thấy bài Public hoặc bài của phòng mình)
// ==============================================================================
export const getMyPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { menuId, limit, page } = req.query;
    const user = req.user!;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    // 1. Điều kiện mặc định: Phải được xuất bản
    const where: any = { published: true };
    if (menuId) where.menuId = Number(menuId);

    // 2. PHÂN QUYỀN XEM CHI TIẾT
    // Nếu là Admin thì thấy hết, nếu là User thường thì lọc
    if (!["ROLE-ADMIN", "ROLE-MANAGER"].includes(user.roleId || "")) {
      where.OR = [
        { isPublic: true }, // Điều kiện 1: Bài viết công khai
        { 
          targets: { 
            some: { departmentId: user.departmentId } // Điều kiện 2: Đúng phòng ban của mình
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
export const getPostDetail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        targets: { include: { department: true } }, // Để hiển thị form Edit (biết đã chọn phòng nào)
      },
    });

    if (!post) return next(new AppError("Không tìm thấy bài viết", 404));

    res.status(200).json({ status: "success", data: post });
  } catch (error) {
    next(error);
  }
};
