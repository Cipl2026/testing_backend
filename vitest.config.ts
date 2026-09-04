import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      PORT: '4000',
      MONGODB_URI: 'mongodb://localhost:27017/ghaarfix_test',
      JWT_ACCESS_SECRET: 'test-access-secret-key',
      JWT_REFRESH_SECRET: 'test-refresh-secret-key',
      JWT_ACCESS_EXPIRY: '15m',
      JWT_REFRESH_EXPIRY: '7d',
      OTP_LENGTH: '6',
      OTP_EXPIRY_MINUTES: '5',
      OTP_MAX_ATTEMPTS: '5',
      OTP_RESEND_COOLDOWN_SECONDS: '1',
      OTP_RATE_LIMIT_MAX: '20',
      EXPOSE_OTP_IN_RESPONSE: 'false',
      ADMIN_EMAIL: 'admin@ghaarfix.in',
      ADMIN_PASSWORD: 'Admin@123456',
      CLIENT_URL: 'http://localhost:8081',
      ADMIN_URL: 'http://localhost:5173',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
