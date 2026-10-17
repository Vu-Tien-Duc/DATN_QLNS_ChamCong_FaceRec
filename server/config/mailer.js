/**
 * Cấu hình gửi email; chỉ giả lập việc gửi trong môi trường development hoặc test.
 */
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

const createTransporter = () => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.MAIL_USER || process.env.EMAIL_USER;
  const pass = process.env.MAIL_PASSWORD || process.env.EMAIL_PASS;

  if (!user || !pass || !nodemailer) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return {
        sendMail: async (mailOptions) => {
          console.log(`[Mock Mailer] Giả lập gửi email đến ${mailOptions.to}: ${mailOptions.subject}`);
          return { messageId: `simulated-${Date.now()}` };
        },
      };
    }

    return {
      sendMail: async () => {
        throw new Error('Chưa cấu hình Nodemailer hoặc thông tin SMTP.');
      },
    };
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const transporter = createTransporter();

module.exports = {
  createTransporter,
  transporter,
};
