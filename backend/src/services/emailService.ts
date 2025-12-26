import nodemailer from 'nodemailer';

// 1. Cấu hình Transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com', // Fallback nếu quên cấu hình .env
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// 2. Hàm gửi mật khẩu tạm (Cũ - Giữ nguyên)
export const sendTempPasswordEmail = async (to: string, tempPass: string) => {
  const mailOptions = {
    from: '"Towa ERP Security" <no-reply@towa.com>',
    to,
    subject: 'Cấp lại mật khẩu hệ thống Towa ERP',
    html: `
      <h3>Xin chào,</h3>
      <p>Bạn (hoặc ai đó) đã yêu cầu lấy lại mật khẩu.</p>
      <p>Mật khẩu tạm thời của bạn là: <b style="font-size: 18px; color: red;">${tempPass}</b></p>
      <p>Vui lòng đăng nhập và đổi mật khẩu ngay lập tức.</p>
      <p>Trân trọng.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`>>> [Email] Đã gửi mật khẩu tạm tới ${to}`);
  } catch (error) {
    console.error('>>> [Email Error]', error);
  }
};

// 3. Hàm gửi thông báo bài viết mới (MỚI THÊM)
export const sendNewPostNotification = async (
  recipients: string[], 
  postTitle: string, 
  authorName: string
) => {
  // Nếu không có người nhận thì dừng
  if (!recipients || recipients.length === 0) return;

  // Lấy URL frontend từ biến môi trường (để user bấm vào link)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const mailOptions = {
    from: '"Towa ERP Notification" <no-reply@towa.com>',
    bcc: recipients, // Dùng BCC để gửi cho nhiều người mà không lộ danh sách email
    subject: `[Towa News] Bài viết mới: ${postTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        
        <h2 style="color: #1d4ed8; text-align: center; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px;">
          📢 Thông báo mới từ Towa ERP
        </h2>
        
        <p style="font-size: 16px; color: #374151;">Xin chào,</p>
        
        <p style="font-size: 16px; color: #374151;">
          <strong>${authorName}</strong> vừa đăng một thông báo mới trên hệ thống nội bộ:
        </p>
        
        <blockquote style="background: #eff6ff; padding: 20px; border-left: 5px solid #3b82f6; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1e3a8a; font-size: 18px;">${postTitle}</h3>
        </blockquote>
        
        <p style="font-size: 16px; color: #374151;">
          Vui lòng truy cập hệ thống để xem chi tiết nội dung và tải tài liệu đính kèm (nếu có).
        </p>
        
        <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
          <a href="${frontendUrl}/posts" 
             style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
             Xem bài viết ngay
          </a>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #e5e7eb;" />
        
        <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
          Đây là email tự động, vui lòng không trả lời email này.<br>
          © 2025 Towa ERP System.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`>>> [Email] Đã gửi thông báo bài viết mới tới ${recipients.length} người.`);
  } catch (error) {
    console.error('>>> [Email Error] Lỗi gửi mail thông báo:', error);
  }
};