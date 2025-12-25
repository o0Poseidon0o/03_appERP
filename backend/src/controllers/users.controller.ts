import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: { select: { name: true } },       // Lấy tên Role
        department: { select: { name: true } }  // Lấy tên Phòng ban
      }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server' });
  }
};