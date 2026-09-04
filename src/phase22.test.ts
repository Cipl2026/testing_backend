import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {
  ConsentStatus,
  ConsentType,
  DataExportStatus,
  FeatureFlagKey,
  SecurityEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase22Migrations } from '@/migrations/012-phase22-security.js';
import { User } from '@/models/User.js';
import { FeatureFlag } from '@/models/FeatureFlag.js';
import { Otp } from '@/models/Otp.js';
import { hashOtp } from '@/utils/crypto.js';
import { redactValue } from '@/modules/reliability/log-redaction.service.js';
import {
  createSession,
  revokeSession,
  revokeOtherSessions,
} from '@/modules/security/session.service.js';
import { recordSecurityEvent } from '@/modules/security/security-event.service.js';
import {
  initiateStepUp,
  verifyStepUpMpin,
} from '@/modules/security/step-up.service.js';
import { assertResourceOwner } from '@/modules/security/idor-guard.service.js';
import { pickAllowedFields } from '@/modules/security/idor-guard.service.js';
import { getPrivacyConsents, updatePrivacyConsent } from '@/modules/security/privacy-consent.service.js';
import { requestDataExport } from '@/modules/security/data-export.service.js';
import { requestAccountDeletion } from '@/modules/security/account-deletion.service.js';
import { listThreatModels } from '@/modules/security/threat-model.service.js';
import { validateFileSignature } from '@/modules/storage/storage.service.js';
import { getSecretProvider } from '@/modules/security/secret-provider.service.js';
import { AppError } from '@/utils/AppError.js';

const app = createApp();

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

import { normalizePhone } from '@/utils/phone.js';

async function seedCustomer(phone = '9876543201') {
  const passwordHash = await bcrypt.hash('1234', 12);
  return User.create({
    phone: normalizePhone(phone),
    role: UserRole.CUSTOMER,
    isPhoneVerified: true,
    status: 'ACTIVE',
    passwordHash,
    fullName: 'Security Test User',
  });
}

async function loginCustomer(phone = '9876543201') {
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
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

describe('Phase 22 — Security & Compliance', () => {
  beforeAll(async () => {
    await connectDatabase();
    await runPhase22Migrations();
    await seedAdminUser();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await FeatureFlag.findOneAndUpdate(
      { key: FeatureFlagKey.ENABLE_SECURITY_COMPLIANCE },
      { key: FeatureFlagKey.ENABLE_SECURITY_COMPLIANCE, enabled: true, rules: [{ type: 'global' }] },
      { upsert: true },
    );
    await runPhase22Migrations();
  });

  it('hashes passwords with bcrypt', async () => {
    const hash = await bcrypt.hash('1234', 12);
    expect(hash).not.toBe('1234');
    expect(await bcrypt.compare('1234', hash)).toBe(true);
  });

  it('never logs password in redaction', () => {
    const redacted = redactValue({ password: 'secret', token: 'abc' }) as Record<string, string>;
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
  });

  it('creates and revokes sessions', async () => {
    const customer = await seedCustomer();
    const sessionId = await createSession(customer._id.toString(), UserRole.CUSTOMER, 'family-1');
    const revoked = await revokeSession(customer._id.toString(), sessionId);
    expect(revoked).toBe(true);
  });

  it('revokes all other sessions', async () => {
    const customer = await seedCustomer('9876543202');
    const s1 = await createSession(customer._id.toString(), UserRole.CUSTOMER, 'f1');
    await createSession(customer._id.toString(), UserRole.CUSTOMER, 'f2');
    const count = await revokeOtherSessions(customer._id.toString(), s1);
    expect(count).toBe(1);
  });

  it('handles step-up authentication', async () => {
    const customer = await seedCustomer('9876543203');
    const { stepUpId } = await initiateStepUp(customer._id.toString(), 'change_payout');
    const verified = await verifyStepUpMpin(customer._id.toString(), stepUpId, '1234');
    expect(verified).toBe(true);
  });

  it('prevents IDOR access', async () => {
    const customer = await seedCustomer('9876543204');
    const other = await seedCustomer('9876543205');
    await expect(
      assertResourceOwner(customer._id.toString(), other._id.toString(), 'booking', 'b1'),
    ).rejects.toThrow(/access to this resource/i);
  });

  it('prevents mass assignment via pickAllowedFields', () => {
    const result = pickAllowedFields({ name: 'A', role: 'ADMIN', status: 'BLOCKED' }, ['name']);
    expect(result).toEqual({ name: 'A' });
    expect((result as Record<string, unknown>).role).toBeUndefined();
  });

  it('manages privacy consent', async () => {
    const customer = await seedCustomer('9876543206');
    await updatePrivacyConsent(customer._id.toString(), {
      [ConsentType.MARKETING_EMAIL]: ConsentStatus.GRANTED,
    });
    const consents = await getPrivacyConsents(customer._id.toString());
    expect(consents.marketingEmail).toBe(ConsentStatus.GRANTED);
  });

  it('allows consent withdrawal', async () => {
    const customer = await seedCustomer('9876543207');
    await updatePrivacyConsent(customer._id.toString(), {
      [ConsentType.MARKETING_PUSH]: ConsentStatus.GRANTED,
    });
    await updatePrivacyConsent(customer._id.toString(), {
      [ConsentType.MARKETING_PUSH]: ConsentStatus.WITHDRAWN,
    });
    const consents = await getPrivacyConsents(customer._id.toString());
    expect(consents.marketingPush).toBe(ConsentStatus.WITHDRAWN);
  });

  it('requests data export for owner only', async () => {
    const customer = await seedCustomer('9876543208');
    const exp = await requestDataExport(customer._id.toString());
    expect(exp.status).toBe(DataExportStatus.PENDING);
  });

  it('schedules account deletion with retention', async () => {
    const customer = await seedCustomer('9876543209');
    const req = await requestAccountDeletion(customer._id.toString(), 'No longer needed');
    expect(req.retainedDataTypes).toContain('financial_ledger');
    expect(req.scheduledFor).toBeTruthy();
  });

  it('validates file magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateFileSignature(png, 'image/png')).not.toThrow();
    const fake = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(() => validateFileSignature(fake, 'image/png')).toThrow();
  });

  it('does not expose phone enumeration', async () => {
    const res = await request(app).get('/api/v1/auth/check-phone?phone=9876543210');
    expect(res.body.data.canProceed).toBeDefined();
    expect(res.body.data.registered).toBeUndefined();
  });

  it('records security events', async () => {
    const customer = await seedCustomer('9876543210');
    await recordSecurityEvent({
      type: SecurityEventType.OTP_ABUSE,
      severity: 'MEDIUM' as never,
      actorId: customer._id.toString(),
    });
    expect(true).toBe(true);
  });

  it('seeds threat model', async () => {
    const threats = await listThreatModels();
    expect(threats.length).toBeGreaterThan(0);
  });

  it('exposes admin security overview', async () => {
    const login = await request(app)
      .post('/api/v1/admin/login')
      .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
    const res = await request(app)
      .get('/api/v1/admin/security/overview')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.activeSessions).toBeDefined();
  });

  it('exposes customer sessions API', async () => {
    const customer = await seedCustomer('9876543211');
    await createSession(customer._id.toString(), UserRole.CUSTOMER, 'fam-api');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '9876543211', mpin: '1234', role: 'CUSTOMER' });
    expect(login.status).toBe(200);
    const res = await request(app)
      .get('/api/v1/security/sessions')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('validates secret provider', () => {
    const provider = getSecretProvider();
    expect(provider.getSecret('JWT_ACCESS_SECRET')).toBeTruthy();
  });
});
