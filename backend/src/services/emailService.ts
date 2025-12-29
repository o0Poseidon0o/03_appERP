import nodemailer from 'nodemailer';

// 1. Cấu hình Transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST, // Sửa từ 'smtp.gmail.com' thành biến môi trường
  port: Number(process.env.MAIL_PORT), // Sửa từ 587 thành biến môi trường
  secure: false, 
  auth: {
    user: process.env.MAIL_USER, // towavn.it.minhnhan@gmail.com
    pass: process.env.MAIL_PASS, // eesi fgau irgi kqgp
  },
  tls: {
    rejectUnauthorized: false // Bắt buộc phải có để gửi cho mail nội bộ
  }
});

/**
 * Hàm gửi thông báo bài viết mới
 * Hỗ trợ gửi cho cả Gmail và Mail nội bộ (@towa.com.vn)
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

  // LOG DEBUG: Kiểm tra xem danh sách có chứa mail nội bộ không
  console.log(">>> [Email Debug] Đang chuẩn bị gửi tới:", recipients);

  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.20.17:90';

  // Chia nhỏ danh sách gửi (Chunking) 25 người/đợt để tránh bị Mail nội bộ đánh dấu Spam
  const chunkSize = 25; 
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);

    const mailOptions = {
      // "from" sạch sẽ, không ký tự đặc biệt để tránh bộ lọc của server doanh nghiệp
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
            <p><strong>${authorName}</strong> vừa đăng một bài viết mới mà bạn có quyền truy cập:</p>
            <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
              <strong style="font-size: 16px; color: #1e3a8a;">${postTitle}</strong>
            </div>
            <p>Vui lòng nhấn vào nút bên dưới để xem chi tiết bài viết.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/posts" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Xem bài viết</a>
            </div>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            Đây là email tự động từ hệ thống Towa ERP. Vui lòng không trả lời thư này.
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
    
    // Nghỉ 1.5 giây giữa mỗi đợt để server mail không bị nghẽn
    if (i + chunkSize < recipients.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
};