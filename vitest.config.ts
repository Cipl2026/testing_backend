import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ghaarfix_test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      REDIS_ENABLED: process.env.REDIS_ENABLED ?? 'false',
      JWT_ACCESS_SECRET: 'test-jwt-access-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
      CLIENT_URL: 'http://localhost:8081',
      ADMIN_URL: 'http://localhost:5173',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
