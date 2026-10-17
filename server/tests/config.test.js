const assert = require('node:assert/strict');
const { validateEnvironment } = require('../config/env');

const configureValidSecrets = () => {
  process.env.JWT_SECRET = 'unique-access-secret-for-configuration-tests';
  process.env.REFRESH_TOKEN_SECRET = 'different-refresh-secret-for-configuration-tests';
  process.env.TERMINAL_KEY = 'unique-terminal-secret-for-configuration-tests';
  process.env.PORT = '5000';
};

const run = () => {
  configureValidSecrets();
  process.env.NODE_ENV = 'development';
  delete process.env.QR_SECRET;
  delete process.env.MONGODB_URI;
  delete process.env.CORS_WHITELIST;
  delete process.env.ATTENDANCE_EVIDENCE_DIR;
  assert.doesNotThrow(validateEnvironment);

  process.env.TERMINAL_KEY = 'terminal_secret_key_university_2026';
  assert.throws(validateEnvironment, /TERMINAL_KEY/);
  configureValidSecrets();
  process.env.REFRESH_TOKEN_SECRET = process.env.JWT_SECRET;
  assert.throws(validateEnvironment, /phải là hai khóa khác nhau/);

  configureValidSecrets();
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  delete process.env.CORS_WHITELIST;
  delete process.env.ATTENDANCE_EVIDENCE_DIR;
  assert.throws(validateEnvironment, /MONGODB_URI/);
  assert.throws(validateEnvironment, /CORS_WHITELIST/);
  assert.throws(validateEnvironment, /ATTENDANCE_EVIDENCE_DIR/);

  process.env.MONGODB_URI = 'mongodb+srv://example.invalid/database';
  process.env.CORS_WHITELIST = 'https://attendance.example.edu';
  process.env.ATTENDANCE_EVIDENCE_DIR = 'D:\\attendance-evidence';
  assert.doesNotThrow(validateEnvironment);

  process.env.QR_SECRET = process.env.JWT_SECRET;
  assert.throws(validateEnvironment, /QR_SECRET phải khác/);
  delete process.env.QR_SECRET;

  process.env.CORS_WHITELIST = '*';
  assert.throws(validateEnvironment, /không được chứa \*/);

  process.env.CORS_WHITELIST = 'https://attendance.example.edu';
  process.env.PORT = '5000';

  // Kiểm thử định dạng REDIS_URL
  process.env.REDIS_URL = 'http://localhost:6379';
  assert.throws(validateEnvironment, /REDIS_URL phải có giao thức redis:\/\/ hoặc rediss:\/\//);
  process.env.REDIS_URL = 'redis://localhost:6379';
  assert.doesNotThrow(validateEnvironment);
  delete process.env.REDIS_URL;

  console.log('Configuration validation tests passed.');
};

run();
