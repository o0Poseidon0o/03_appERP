import { User, Role, RolePermission, UserPermission } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      // Cập nhật User kèm theo đầy đủ các quan hệ đã include trong middleware
      user?: User & {
        // Quyền theo Role
        role: Role & {
          permissions: RolePermission[];
        };
        // Quyền riêng lẻ của từng User
        userPermissions: UserPermission[];
        // Mảng chuỗi các mã quyền đã được hợp nhất (từ Middleware protect)
        allPermissions?: string[];
      };
    }
  }
}