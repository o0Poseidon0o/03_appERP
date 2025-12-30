import nodemailer from 'nodemailer';

// 1. Cấu hình Transporter dùng chung
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, // false cho cổng 587, true cho cổng 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false // Quan trọng để gửi được cho mail nội bộ/doanh nghiệp
  }
});

/**
 * [MỚI BỔ SUNG] 
 * Hàm gửi mật khẩu tạm thời cho chức năng Quên mật khẩu
 */
export const sendTempPasswordEmail = async (to: string, tempPass: string) => {
  const mailOptions = {
    from: `"Towa ERP Security" <${process.env.MAIL_USER}>`,
    to: to,
    subject: 'Cấp lại mật khẩu hệ thống Towa ERP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #dc2626; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Khôi phục mật khẩu</h1>
        </div>
        <div style="padding: 20px; color: #334155;">
          <p>Xin chào,</p>
          <p>Hệ thống nhận được yêu cầu cấp lại mật khẩu cho tài khoản của bạn.</p>
          <p>Mật khẩu tạm thời của bạn là:</p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #dc2626; letter-spacing: 2px; background: #fef2f2; padding: 10px 20px; border: 1px dashed #dc2626; border-radius: 4px;">
              ${tempPass}
            </span>
          </div>
          <p style="color: #ef4444; font-weight: bold;">Lưu ý:</p>
          <ul>
            <li>Mật khẩu này có hiệu lực ngay lập tức.</li>
            <li>Vui lòng đăng nhập và <b>đổi mật khẩu mới</b> ngay sau khi truy cập hệ thống để đảm bảo an toàn.</li>
          </ul>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
          Nếu bạn không yêu cầu thay đổi này, vui lòng liên hệ quản trị viên ngay lập tức.
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`>>> [Email Success] Đã gửi mật khẩu tạm tới: ${to}`);
  } catch (error) {
    console.error(`>>> [Email Error] Không thể gửi mail tới ${to}:`, error);
    throw error; // Quăng lỗi để controller nhận biết và xử lý
  }
};

/**
 * Hàm gửi thông báo bài viết mới
 */
export const sendNewPostNotification = async (
  recipients: string[], 
  postTitle: string, 
  authorName: string
) => {
  if (!recipients || recipients.length === 0) {
    console.log(">>> [Email Info] Không có danh sách người nhận.");
    return;
  }

  console.log(">>> [Email Debug] Đang chuẩn bị gửi tới:", recipients);
  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.20.17:90';
  const chunkSize = 25; 

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);

    const mailOptions = {
      from: `"Towa_ERP_System" <${process.env.MAIL_USER}>`,
      bcc: chunk, 
      subject: `[ERP News] ${postTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #2563eb; padding: 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Thông báo từ Hệ thống ERP</h1>
          </div>
          <div style="padding: 20px; color: #334155;">
            <p>Xin chào,</p>
            <p><strong>${authorName}</strong> vừa đăng một bài viết mới:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
              <strong style="font-size: 16px; color: #1e3a8a;">${postTitle}</strong>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/posts" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem bài viết ngay</a>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`>>> [Email Success] Gửi đợt ${i/chunkSize + 1} thành công (${chunk.length} người).`);
    } catch (error) {
      console.error('>>> [Email Error] Thất bại tại đợt ' + (i/chunkSize + 1), error);
    }
    
    if (i + chunkSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};