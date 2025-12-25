import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Đang khởi tạo dữ liệu mẫu...')

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
  // Hash password trước khi lưu
  const hashedPassword = await bcrypt.hash('123456', 10)

  const adminUser = await prisma.user.upsert({
    where: { id: 'ADMIN-01' },
    update: {},
    create: {
      id: 'ADMIN-01',
      email: 'admin@towa.com',
      password: hashedPassword,
      fullName: 'Quản Trị Hệ Thống',
      departmentId: dept.id,
      roleId: roleAdmin.id
    }
  })

  console.log(`✅ Đã tạo user: ${adminUser.email} / pass: 123456`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })