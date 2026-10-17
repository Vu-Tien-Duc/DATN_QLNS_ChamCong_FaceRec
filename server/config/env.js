/**
 * Kiểm tra các biến môi trường bắt buộc trước khi khởi động máy chủ.
 */
const validateEnvironment = () => {
  const errors = [];
  const weakSecrets = new Set([
    'university_attendance_secret_key_2026',
    'university_attendance_refresh_secret_key_2026',
    'terminal_secret_key_university_2026',
    'your_super_secret_jwt_access_key_university_2026',
    'your_super_secret_refresh_token_key_university_2026',
    'super_secret_jwt_key_university_attendance_2026',
    'super_refresh_token_secret_key_2026',
  ]);

  for (const name of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'TERMINAL_KEY']) {
    const value = process.env[name];
    if (!value) {
      errors.push(`${name} chưa được cấu hình.`);
    } else if (value.length < 32 || weakSecrets.has(value) || /^(replace_with|your_)/i.test(value)) {
      errors.push(`${name} phải là khóa riêng, không phải giá trị mẫu và dài tối thiểu 32 ký tự.`);
    }
  }

  if (
    process.env.JWT_SECRET &&
    process.env.REFRESH_TOKEN_SECRET &&
    process.env.JWT_SECRET === process.env.REFRESH_TOKEN_SECRET
  ) {
    errors.push('JWT_SECRET và REFRESH_TOKEN_SECRET phải là hai khóa khác nhau.');
  }

  if (process.env.QR_SECRET) {
    if (
      process.env.QR_SECRET.length < 32 ||
      weakSecrets.has(process.env.QR_SECRET) ||
      /^(replace_with|your_)/i.test(process.env.QR_SECRET)
    ) {
      errors.push('QR_SECRET phải là khóa riêng, không phải giá trị mẫu và dài tối thiểu 32 ký tự.');
    } else if ([process.env.JWT_SECRET, process.env.REFRESH_TOKEN_SECRET].includes(process.env.QR_SECRET)) {
      errors.push('QR_SECRET phải khác JWT_SECRET và REFRESH_TOKEN_SECRET.');
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI bắt buộc phải được cấu hình trong môi trường production.');
    }
    if (!process.env.ATTENDANCE_EVIDENCE_DIR) {
      errors.push('ATTENDANCE_EVIDENCE_DIR bắt buộc phải trỏ tới storage ảnh minh chứng bền vững trong production.');
    }
    if (!process.env.CORS_WHITELIST) {
      errors.push('CORS_WHITELIST bắt buộc phải liệt kê các nguồn được phép trong production.');
    }
    const origins = (process.env.CORS_WHITELIST || '').split(',').map((origin) => origin.trim());
    if (origins.includes('*')) {
      errors.push('CORS_WHITELIST không được chứa * trong môi trường production.');
    }
  }

  if (process.env.FACE_SERVICE_URL) {
    try {
      const url = new URL(process.env.FACE_SERVICE_URL);
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('FACE_SERVICE_URL phải có giao thức http:// hoặc https://.');
      }
    } catch (error) {
      errors.push('FACE_SERVICE_URL không hợp lệ. Ví dụ: http://127.0.0.1:8001');
    }
  }

  if (process.env.REDIS_URL) {
    try {
      const url = new URL(process.env.REDIS_URL);
      if (!['redis:', 'rediss:'].includes(url.protocol)) {
        errors.push('REDIS_URL phải có giao thức redis:// hoặc rediss://.');
      }
    } catch (error) {
      errors.push('REDIS_URL không hợp lệ. Ví dụ: redis://localhost:6379');
    }
  }

  const port = Number(process.env.PORT);
  if (process.env.PORT && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    errors.push('PORT phải là số nguyên từ 1 đến 65535.');
  }

  if (errors.length > 0) {
    throw new Error(`Cấu hình môi trường không hợp lệ:\n- ${errors.join('\n- ')}`);
  }
};

module.exports = { validateEnvironment };
