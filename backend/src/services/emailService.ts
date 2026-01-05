import nodemailer from 'nodemailer';

// 1. Cấu hình Transporter dùng chung
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false, 
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false 
  }
});

// Lấy URL Frontend từ .env
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://thongbao.towa.com.vn:90';

/**
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
          <div style="text-align: center; margin: 25px 0;">
             <a href="${FRONTEND_URL}/login" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Đăng nhập ngay</a>
          </div>
          <p style="color: #ef4444; font-weight: bold;">Lưu ý:</p>
          <ul>
            <li>Vui lòng đăng nhập và <b>đổi mật khẩu mới</b> ngay sau khi truy cập.</li>
          </ul>
        </div>
        <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
          Truy cập hệ thống tại: <a href="${FRONTEND_URL}">${FRONTEND_URL}</a>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`>>> [Email Success] Sent to: ${to}`);
  } catch (error) {
    console.error(`>>> [Email Error]`, error);
    throw error;
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
  if (!recipients || recipients.length === 0) return;

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
              <a href="${FRONTEND_URL}/posts" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem bài viết ngay</a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
             Hệ thống Towa ERP: <a href="${FRONTEND_URL}">${FRONTEND_URL}</a>
          </div>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('>>> [Email Error] Chunk failure', error);
    }
    
    if (i + chunkSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};