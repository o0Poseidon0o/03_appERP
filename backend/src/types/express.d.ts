import { User, Role, RolePermission, UserPermission, Department } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user: User & {
        role: Role & {
          permissions: (RolePermission & {
            permission: { id: string }; // Để truy cập mã quyền
          })[];
        };
        userPermissions: (UserPermission & {
          permission: { id: string };
        })[];
        department?: Department; // Thông tin phòng ban/nhà máy
        allPermissions?: string[]; // Mảng phẳng các mã quyền: ['WMS_SETUP', 'WMS_APPROVE']
      };
    }
  }
}