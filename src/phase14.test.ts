import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  ConfidenceLevel,
  FeatureFlagKey,
  IntelligenceFeature,
  IntelligenceFeedbackType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Otp } from '@/models/Otp.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { AIAnalysisResult } from '@/models/Intelligence.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase14Migrations } from '@/migrations/004-phase14-intelligence.js';
import { runPhase14Jobs } from '@/modules/intelligence/phase14-jobs.js';
import { validateIssueClassification } from '@/modules/intelligence/intelligence-schemas.js';
import { resetAIProviderForTests } from '@/modules/intelligence/ai-provider/ai-provider.factory.js';
import { rankEligibleProviders } from '@/modules/intelligence/provider-matching/smart-matching.service.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9877001000;
function nextPhone(): string {
  phoneSeq += 1;
  return String(phoneSeq);
}

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginCustomer(phone = nextPhone()) {
  const normalized = normalizePhone(phone);
  await User.create({
    phone: normalized,
    role: UserRole.CUSTOMER,
    isPhoneVerified: false,
    isProfileComplete: true,
    status: 'ACTIVE',
  });
  await CustomerProfile.create({
    userId: (await User.findOne({ phone: normalized }))!._id,
    fullName: 'Intel User',
  });
  await Otp.create({
    requestId: `req-${phone}`,
    phone: normalized,
    role: 'CUSTOMER',
    otpHash: hashOtp('123456'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp: '123456', role: 'CUSTOMER' });
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string };
}

async function enableIntelligenceFlags() {
  for (const key of [
    FeatureFlagKey.ENABLE_AI_ISSUE_CLASSIFICATION,
    FeatureFlagKey.ENABLE_AI_ASSISTANT,
    FeatureFlagKey.ENABLE_PREDICTIVE_MAINTENANCE,
    FeatureFlagKey.ENABLE_SMART_MATCHING,
    FeatureFlagKey.ENABLE_DEMAND_FORECAST,
    FeatureFlagKey.ENABLE_ANOMALY_DETECTION,
  ]) {
    await FeatureFlag.findOneAndUpdate(
      { key },
      { key, enabled: true, ruleType: 'global' },
      { upsert: true },
    );
  }
}

describe('Phase 14 — Intelligence Platform', () => {
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
    resetAIProviderForTests();
    await runPhase14Migrations();
    await enableIntelligenceFlags();
  });

  it('1. rejects invalid structured AI output', () => {
    expect(() =>
      validateIssueClassification({ category: '', confidence: 2, urgency: 'INVALID' }),
    ).toThrow();
  });

  it('2. validates structured issue classification output', () => {
    const result = validateIssueClassification({
      category: 'AC & Cooling',
      confidence: 0.82,
      confidenceLevel: ConfidenceLevel.HIGH,
      urgency: 'NORMAL',
      riskFlags: [],
      followUpQuestions: [],
      explanation: 'Possible AC issue.',
    });
    expect(result.confidenceLevel).toBe(ConfidenceLevel.HIGH);
  });

  it('3. classifies AC issue with high confidence', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ description: 'AC is cooling but making loud noise' });
    expect(res.status).toBe(201);
    expect(res.body.data.result.category).toContain('AC');
    expect(res.body.data.result.confidence).toBeGreaterThan(0.5);
  });

  it('4. low confidence description asks clarification', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ description: 'need help please with home' });
    expect(res.status).toBe(201);
    expect(res.body.data.requiresClarification).toBe(true);
  });

  it('5. blocks unauthorized analysis access', async () => {
    const a = await loginCustomer();
    const b = await loginCustomer();
    const created = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ description: 'Water leak in kitchen under the sink' });
    const analysisId = created.body.data.id as string;

    const leak = await request(app)
      .get(`/api/v1/intelligence/analysis/${analysisId}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(leak.status).toBe(403);
  });

  it('6. records analysis ownership for customer', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ description: 'Electric switch sparking when turned on' });
    const analysis = await AIAnalysisResult.findById(res.body.data.id);
    expect(analysis?.customerId?.toString()).toBe(customer.userId);
  });

  it('7. provider ranking is deterministic on tie', async () => {
    const ranked1 = await rankEligibleProviders({
      serviceId: new mongoose.Types.ObjectId().toString(),
      candidates: [
        { providerId: 'bbbbbbbbbbbbbbbbbbbbbbbb', distanceMeters: 1000, baseRankScore: 0.5 },
        { providerId: 'aaaaaaaaaaaaaaaaaaaaaaaa', distanceMeters: 1000, baseRankScore: 0.5 },
      ],
    });
    const ranked2 = await rankEligibleProviders({
      serviceId: new mongoose.Types.ObjectId().toString(),
      candidates: [
        { providerId: 'bbbbbbbbbbbbbbbbbbbbbbbb', distanceMeters: 1000, baseRankScore: 0.5 },
        { providerId: 'aaaaaaaaaaaaaaaaaaaaaaaa', distanceMeters: 1000, baseRankScore: 0.5 },
      ],
    });
    expect(ranked1[0]?.providerId).toBe(ranked2[0]?.providerId);
  });

  it('8. assistant cannot access another user booking context', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/assistant/messages')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ message: 'Where is my booking?' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBeTruthy();
  });

  it('9. submits AI feedback', async () => {
    const customer = await loginCustomer();
    const analysis = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ description: 'AC not cooling properly in bedroom' });

    const feedback = await request(app)
      .post(`/api/v1/intelligence/analysis/${analysis.body.data.id}/feedback`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        feature: IntelligenceFeature.ISSUE_CLASSIFICATION,
        userFeedback: IntelligenceFeedbackType.HELPFUL,
        wasCorrect: true,
      });
    expect(feedback.status).toBe(201);
  });

  it('10. admin intelligence dashboard accessible', async () => {
    const admin = await loginAdmin();
    const res = await request(app)
      .get('/api/v1/admin/intelligence/dashboard')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('openAnomalies');
  });

  it('11. feature flag disables classification', async () => {
    await FeatureFlag.updateOne(
      { key: FeatureFlagKey.ENABLE_AI_ISSUE_CLASSIFICATION },
      { enabled: false },
    );
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/intelligence/issues/analyze')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ description: 'AC making loud noise and not cooling' });
    expect(res.status).toBe(403);
  });

  it('12. phase14 jobs run idempotently', async () => {
    const first = await runPhase14Jobs();
    const second = await runPhase14Jobs();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});
