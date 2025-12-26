import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/AppError';

// Cấu hình nơi lưu file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Đảm bảo folder 'uploads' đã tồn tại ở root
  },
  filename: (req, file, cb) => {
    // Đặt tên file: fieldname-thoigian-random.ext
    // fix lỗi tên file tiếng việt bằng cách dùng Buffer
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(originalName));
  }
});

// Bộ lọc file (Cho phép Ảnh + PDF + Tài liệu Office)
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Regex cho phép: ảnh (jpg, png...), pdf, word, excel
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
  
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new AppError('Chỉ cho phép upload file Ảnh (.jpg, .png) hoặc Tài liệu (.pdf, .doc, .xls)!', 400), false);
  }
};

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Tăng giới hạn lên 10MB cho thoải mái
  fileFilter: fileFilter
});