import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { env } from '@/config/env.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { RefreshToken } from '@/models/RefreshToken.js';
import { User } from '@/models/User.js';
import { hashOtp } from '@/utils/crypto.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';

const app = createApp();

async function clearDatabase() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

async function requestOtp(phone: string, role: 'CUSTOMER' | 'PROVIDER') {
  return request(app).post('/api/v1/auth/request-otp').send({ phone, role });
}

async function verifyOtp(phone: string, otp: string, role: 'CUSTOMER' | 'PROVIDER') {
  return request(app).post('/api/v1/auth/verify-otp').send({ phone, otp, role });
}

describe('Authentication API', () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
  });

  it('allows a customer to request OTP', async () => {
    const response = await requestOtp('9876543210', 'CUSTOMER');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.requestId).toBeTruthy();
  });

  it('rejects expired OTP verification', async () => {
    await requestOtp('9876543210', 'CUSTOMER');
    const otpRecord = await Otp.findOne({ phone: '+919876543210' });
    expect(otpRecord).toBeTruthy();
    otpRecord!.expiresAt = new Date(Date.now() - 1000);
    await otpRecord!.save();

    const response = await verifyOtp('9876543210', '123456', 'CUSTOMER');
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('prevents OTP reuse after successful verification', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-1',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const first = await verifyOtp('9876543210', otp, 'CUSTOMER');
    expect(first.status).toBe(200);

    const second = await verifyOtp('9876543210', otp, 'CUSTOMER');
    expect(second.status).toBe(400);
  });

  it('fails after too many incorrect OTP attempts', async () => {
    await Otp.create({
      requestId: 'req-2',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp('654321'),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: env.otp.maxAttempts,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const response = await verifyOtp('9876543210', '111111', 'CUSTOMER');
    expect(response.status).toBe(429);
  });

  it('creates a new customer on first login', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-3',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const response = await verifyOtp('9876543210', otp, 'CUSTOMER');
    expect(response.status).toBe(200);
    expect(response.body.data.isNewUser).toBe(true);

    const users = await User.find({ role: 'CUSTOMER' });
    expect(users).toHaveLength(1);
  });

  it('logs in an existing customer', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-4',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const first = await verifyOtp('9876543210', otp, 'CUSTOMER');
    expect(first.status).toBe(200);

    await Otp.create({
      requestId: 'req-5',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const second = await verifyOtp('9876543210', otp, 'CUSTOMER');
    expect(second.status).toBe(200);
    expect(second.body.data.isNewUser).toBe(false);
  });

  it('creates a provider user with PENDING status', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-6',
      phone: '+919876543211',
      role: 'PROVIDER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const response = await verifyOtp('9876543211', otp, 'PROVIDER');
    expect(response.status).toBe(200);

    const profile = await ProviderProfile.findOne({});
    expect(profile?.providerStatus).toBe('PENDING');
  });

  it('denies customer access to provider profile API', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-7',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const login = await verifyOtp('9876543210', otp, 'CUSTOMER');
    const token = login.body.data.accessToken as string;

    const response = await request(app)
      .patch('/api/v1/providers/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Test Provider' });

    expect(response.status).toBe(403);
  });

  it('denies provider access to admin dashboard', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-8',
      phone: '+919876543211',
      role: 'PROVIDER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const login = await verifyOtp('9876543211', otp, 'PROVIDER');
    const token = login.body.data.accessToken as string;

    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('allows admin to access admin dashboard', async () => {
    const login = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: env.admin.email, password: env.admin.password });

    expect(login.status).toBe(200);
    const token = login.body.data.accessToken as string;

    const dashboard = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.totals).toBeDefined();
  });

  it('refreshes access token with a valid refresh token', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-9',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const login = await verifyOtp('9876543210', otp, 'CUSTOMER');
    const refreshToken = login.body.data.refreshToken as string;

    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBeTruthy();
    expect(response.body.data.refreshToken).toBeTruthy();
  });

  it('rejects invalid refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: 'invalid-token' });

    expect(response.status).toBe(401);
  });

  it('revokes refresh token on logout', async () => {
    const otp = '123456';
    await Otp.create({
      requestId: 'req-10',
      phone: '+919876543210',
      role: 'CUSTOMER',
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      attempts: 0,
      isVerified: false,
      lastSentAt: new Date(),
    });

    const login = await verifyOtp('9876543210', otp, 'CUSTOMER');
    const accessToken = login.body.data.accessToken as string;
    const refreshToken = login.body.data.refreshToken as string;

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(logout.status).toBe(200);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken });

    expect(refresh.status).toBe(401);

    const activeTokens = await RefreshToken.countDocuments({ isRevoked: false });
    expect(activeTokens).toBe(0);
  });
});
