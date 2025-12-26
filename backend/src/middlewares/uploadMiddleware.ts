import multer from 'multer';
import path from 'path';
import { AppError } from '../utils/AppError';

// ==============================================================================
// CẤU HÌNH LƯU TRỮ (STORAGE)
// ==============================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Thư mục 'uploads' phải nằm ở gốc của dự án backend
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    try {
      /**
       * 1. Xử lý mã hóa tên file gốc:
       * Khắc phục lỗi hiển thị sai ký tự khi tên file có dấu tiếng Việt.
       */
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

      /**
       * 2. Bóc tách tên và phần mở rộng (Extension):
       * Sử dụng path.parse an toàn hơn path.extname trong một số trường hợp file đặc biệt.
       */
      const parsedPath = path.parse(originalName);

      /**
       * 3. Tạo chuỗi định danh duy nhất (Unique Suffix):
       * Kết hợp timestamp và số ngẫu nhiên để tránh trùng lặp file.
       */
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

      /**
       * 4. Trả về tên file cuối cùng:
       * Cấu trúc: [fieldname]-[uniqueSuffix][extension]
       * Ví dụ: files-1735200000000-123456789.jpg
       */
      cb(null, `${file.fieldname}-${uniqueSuffix}${parsedPath.ext}`);
    } catch (error) {
      cb(error as Error, '');
    }
  }
});

// ==============================================================================
// BỘ LỌC ĐỊNH DẠNG FILE (FILE FILTER)
// ==============================================================================
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Danh sách các định dạng được phép
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
  const allowedMimetypes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExt) && allowedMimetypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Định dạng file không hợp lệ! Chỉ chấp nhận Ảnh, PDF, Word và Excel.', 400), false);
  }
};

// ==============================================================================
// KHỞI TẠO MIDDLEWARE UPLOAD
// ==============================================================================
export const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // Giới hạn kích thước file: 10MB
  },
  fileFilter: fileFilter
});