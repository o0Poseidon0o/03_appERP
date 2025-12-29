import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Bạn dùng Gmail để gửi
  port: 587,
  secure: false, 
  auth: {
    user: process.env.MAIL_USER, // Gmail của Admin
    pass: process.env.MAIL_PASS, // App Password của Gmail
  },
});

export const sendNewPostNotification = async (
  recipients: string[], 
  postTitle: string, 
  authorName: string
) => {
  if (!recipients || recipients.length === 0) return;

  const frontendUrl = process.env.FRONTEND_URL || 'http://192.168.20.17:90';

  // KỸ THUẬT QUAN TRỌNG: Gửi theo từng đợt nhỏ (Chunking)
  // Mail server doanh nghiệp thường chặn nếu 1 email gửi tới quá nhiều người trong công ty cùng lúc
  const chunkSize = 25; 
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);

    const mailOptions = {
      // "from" phải để chính xác là địa chỉ Gmail Admin của bạn
      // Tên hiển thị nên để rõ ràng để Mail nội bộ không quét là lừa đảo
      from: `"Towa ERP System" <${process.env.MAIL_USER}>`,
      bcc: chunk, 
      subject: `[Thông báo ERP] ${postTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #2563eb;">📢 Có thông báo mới</h2>
          <p>Chào bạn, <strong>${authorName}</strong> vừa đăng bài viết mới:</p>
          <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 15px 0;">
             <strong style="font-size: 16px;">${postTitle}</strong>
          </div>
          <p>Vui lòng đăng nhập hệ thống để xem chi tiết.</p>
          <a href="${frontendUrl}/posts" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 5px;">Xem bài viết</a>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`>>> Đã gửi thông báo cho nhóm ${i/chunkSize + 1} thành công.`);
    } catch (error) {
      console.error('>>> Lỗi gửi mail:', error);
    }
    
    // Nghỉ 1 giây giữa các đợt để Gmail không bị khóa tài khoản vì gửi quá nhanh
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
};