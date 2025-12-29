import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Đang khởi tạo dữ liệu mẫu...')

  // ==========================================================
  // PHẦN 1: TẠO CƠ CẤU TỔ CHỨC & ADMIN
  // ==========================================================

  // 1. Tạo Phòng ban Gốc
  const dept = await prisma.department.upsert({
    where: { id: 'DEPT-BOD' },
    update: {},
    create: {
      id: 'DEPT-BOD',
      name: 'Ban Giám Đốc',
      code: 'BOD'
    }
  })

  // 2. Tạo Role Admin
  const roleAdmin = await prisma.role.upsert({
    where: { id: 'ROLE-ADMIN' },
    update: {},
    create: {
      id: 'ROLE-ADMIN',
      name: 'Super Administrator',
      description: 'Quản trị viên cấp cao nhất'
    }
  })

  // 3. Tạo User Admin đầu tiên
  const hashedPassword = await bcrypt.hash('123456', 10)

  const adminUser = await prisma.user.upsert({
    where: { id: 'ADMIN-01' },
    update: {},
    create: {
      id: 'ADMIN-01',
      email: 'lenhan16587@gmail.com',
      password: hashedPassword,
      fullName: 'Quản Trị Hệ Thống',
      departmentId: dept.id,
      roleId: roleAdmin.id
    }
  })

  console.log(`✅ Đã tạo user: ${adminUser.email} / pass: P@ssw0rd`)

  // ==========================================================
  // PHẦN 2: TẠO PERMISSION & GÁN QUYỀN (Đưa vào trong hàm main)
  // ==========================================================

  console.log('🌱 Đang khởi tạo danh sách Quyền hạn (Permissions)...');

  const PERMISSIONS = [
    // 1. Nhóm User
    { id: 'USER_VIEW', name: 'Xem danh sách nhân viên', module: 'USER' },
    { id: 'USER_CREATE', name: 'Tạo nhân viên mới', module: 'USER' },
    { id: 'USER_UPDATE', name: 'Cập nhật nhân viên', module: 'USER' },
    { id: 'USER_DELETE', name: 'Xóa nhân viên', module: 'USER' },

    // 2. Nhóm Department
    { id: 'DEPT_VIEW', name: 'Xem phòng ban', module: 'DEPARTMENT' },
    { id: 'DEPT_CREATE', name: 'Tạo phòng ban', module: 'DEPARTMENT' },
    { id: 'DEPT_UPDATE', name: 'Sửa phòng ban', module: 'DEPARTMENT' },
    { id: 'DEPT_DELETE', name: 'Xóa phòng ban', module: 'DEPARTMENT' },

    // 3. Nhóm Role (Phân quyền)
    { id: 'ROLE_VIEW', name: 'Xem phân quyền', module: 'SYSTEM' },
    { id: 'ROLE_MANAGE', name: 'Quản lý Role & Quyền', module: 'SYSTEM' },
  ];

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id: perm.id },
      update: {},
      create: perm
    });
  }

  // Gán full quyền cho ROLE-ADMIN
  const allPerms = await prisma.permission.findMany();
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: 'ROLE-ADMIN', permissionId: p.id }
      },
      update: {},
      create: { roleId: 'ROLE-ADMIN', permissionId: p.id }
    });
  }

  console.log('✅ Đã nạp Permission và gán full quyền cho Admin.');
} // <--- Dấu đóng ngoặc của hàm main() nằm ở đây là đúng

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })