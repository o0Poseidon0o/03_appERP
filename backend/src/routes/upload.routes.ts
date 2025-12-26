import { Router } from 'express';
import { upload } from '../middlewares/uploadMiddleware';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

// Upload nhiều file (tối đa 10 file/lần), tên field là 'files'
router.post('/', protect, upload.array('files', 10), (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    return res.status(400).json({ status: 'fail', message: 'Chưa có file nào được gửi lên' });
  }

  // Ép kiểu req.files
  const files = req.files as Express.Multer.File[];

  // Trả về danh sách các file đã lưu để Frontend lưu vào state
  const fileList = files.map(file => ({
    name: Buffer.from(file.originalname, 'latin1').toString('utf8'), // Fix tên tiếng việt
    path: `/uploads/${file.filename}`,
    type: file.mimetype
  }));

  res.status(200).json({
    status: 'success',
    data: fileList
  });
});

export default router;