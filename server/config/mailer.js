// Cấu hình gửi email SMTP; nếu thiếu SMTP ở môi trường dev/test sẽ tự động giả lập gửi thư
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

// Ghép cặp thông tin đăng nhập SMTP đồng nhất (ưu tiên EMAIL_USER + EMAIL_PASS, tránh ghép chéo với MAIL_PASSWORD cũ)
const resolveSmtpCredentials = (host) => {
  let rawUser = '';
  let rawPass = '';
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    rawUser = process.env.EMAIL_USER;
    rawPass = process.env.EMAIL_PASS;
  } else if (process.env.MAIL_USER && process.env.MAIL_PASSWORD) {
    rawUser = process.env.MAIL_USER;
    rawPass = process.env.MAIL_PASSWORD;
  } else if (process.env.MAIL_USERNAME && process.env.MAIL_PASSWORD) {
    rawUser = process.env.MAIL_USERNAME;
    rawPass = process.env.MAIL_PASSWORD;
  }

  const user = rawUser ? String(rawUser).trim() : '';
  const pass = rawPass
    ? (host.toLowerCase().includes('gmail') ? String(rawPass).replace(/\s+/g, '') : String(rawPass).trim())
    : '';
  return { user, pass };
};

// Tạo đối tượng gửi email SMTP (hoặc giả lập khi chạy dev/test)
const createTransporter = () => {
  const host = String(process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.EMAIL_PORT) || 587;
  const { user, pass } = resolveSmtpCredentials(host);

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
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
};

const transporter = createTransporter();

module.exports = {
  resolveSmtpCredentials,
  createTransporter,
  transporter,
};
