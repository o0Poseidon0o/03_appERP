import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User; // Gắn user vào req để dùng ở controller
    }
  }
}