import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// 1. Hàm ký (tạo) Token
export const signToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
};

// 2. Hàm so sánh password (người dùng nhập vs password đã mã hóa trong DB)
export const comparePassword = async (candidatePassword: string, userPassword: string): Promise<boolean> => {
  return await bcrypt.compare(candidatePassword, userPassword);
};