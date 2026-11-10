"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.post('/', authMiddleware_1.protect, uploadMiddleware_1.upload.array('files', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'Chưa có file nào được gửi lên' });
    }
    const files = req.files;
    const fileList = files.map(file => ({
        name: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        path: `/uploads/${file.filename}`,
        type: file.mimetype
    }));
    res.status(200).json({
        status: 'success',
        data: fileList
    });
});
exports.default = router;
