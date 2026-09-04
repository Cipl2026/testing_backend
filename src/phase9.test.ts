import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  BookingParticipantPermission,
  BookingParticipantRole,
  BookingSource,
  BookingStatus,
  BookingType,
  HomeInvitationStatus,
  HomeMemberRole,
  HomeType,
  OperationalRiskSignalStatus,
  PerformancePeriod,
  ProviderRequestStatus,
  ProviderVerificationStatus,
  ProviderVerificationType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { Booking } from '@/models/Booking.js';
import { BookingParticipant } from '@/models/BookingParticipant.js';
import { HomeMember } from '@/models/HomeMember.js';
import { HomeMemberInvitation } from '@/models/HomeMemberInvitation.js';
import { OperationalRiskSignal } from '@/models/OperationalRiskSignal.js';
import { Otp } from '@/models/Otp.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderSkill } from '@/models/ProviderSkill.js';
import { ProviderVerification } from '@/models/ProviderVerification.js';
import { User } from '@/models/User.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { seedDefaultAssetTypes } from '@/modules/home-health/admin.service.js';
import {
  canAccessBooking,
  getProviderServiceRecipient,
} from '@/modules/booking-participants/booking-participant.service.js';
import { assertHomeCapability } from '@/modules/home-members/home-permission.service.js';
import { detectOperationalSignals } from '@/modules/provider-quality/operational-signal.service.js';
import { aggregateProviderPerformance } from '@/modules/provider-quality/performance.service.js';
import { isProviderEligibleForService } from '@/modules/provider-quality/skill.service.js';
import { HomeCapability } from '@ghaarfix/shared-types';
import { hashOtp, hashToken } from '@/utils/crypto.js';

const app = createApp();

let phoneSeq = 9876700100;
function nextPhone(): string {
  phoneSeq += 1;
  return String(phoneSeq);
}

const ADDRESS_PAYLOAD = {
  label: 'HOME',
  recipientName: 'Test User',
  phone: '9876543210',
  addressLine1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India',
  latitude: 12.9716,
  longitude: 77.5946,
};

async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function loginCustomer(phone = nextPhone()) {
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
  return { token: res.body.data.accessToken as string, userId: res.body.data.user.id as string, phone };
}

async function loginProvider(phone = nextPhone()) {
  await Otp.create({
    requestId: `req-${phone}`,
    phone: `+91${phone}`,
    role: 'PROVIDER',
    otpHash: hashOtp('123456'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    attempts: 0,
    isVerified: false,
    lastSentAt: new Date(),
  });
  const res = await request(app)
    .post('/api/v1/auth/verify-otp')
    .send({ phone, otp: '123456', role: 'PROVIDER' });
  const userId = res.body.data.user.id as string;
  await ProviderProfile.findOneAndUpdate({ userId }, { providerStatus: 'ACTIVE', fullName: 'Pro User' }, { upsert: true });
  return { token: res.body.data.accessToken as string, userId };
}

async function loginAdmin() {
  const res = await request(app)
    .post('/api/v1/admin/login')
    .send({ email: 'admin@ghaarfix.in', password: 'Admin@123456' });
  return { token: res.body.data.accessToken as string, adminId: res.body.data.user?.id as string };
}

async function createAddress(token: string) {
  const res = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({ ...ADDRESS_PAYLOAD, phone: nextPhone() });
  return res.body.data as { id: string };
}

async function createHome(token: string, addressId: string) {
  const res = await request(app)
    .post('/api/v1/homes')
    .set('Authorization', `Bearer ${token}`)
    .send({ addressId, name: 'Family Home', homeType: HomeType.APARTMENT, isPrimary: true });
  return res.body.data as { id: string };
}

async function createInvitationRecord(input: {
  homeId: string;
  invitedBy: string;
  phone: string;
  role: HomeMemberRole;
  token: string;
  expiresAt?: Date;
}) {
  const normalizePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  };
  return HomeMemberInvitation.create({
    homeId: input.homeId,
    invitedBy: input.invitedBy,
    phoneHash: hashToken(normalizePhone(input.phone)),
    role: input.role,
    tokenHash: hashToken(input.token),
    status: HomeInvitationStatus.PENDING,
    expiresAt: input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

describe('Phase 9 — shared homes, participants, provider quality', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
    await seedAdminUser();
    await seedDefaultAssetTypes();
  });

  it('1. owner can invite member', async () => {
    const owner = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const res = await request(app)
      .post(`/api/v1/homes/${home.id}/members/invite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ phone: '9876500001', role: HomeMemberRole.MEMBER });

    expect(res.status).toBe(201);
    expect(res.body.data.invitationId).toBeTruthy();
  });

  it('2. admin home member can manage invitations', async () => {
    const owner = await loginCustomer();
    const adminMember = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'admin-invite-token-123456';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: adminMember.phone,
      role: HomeMemberRole.ADMIN,
      token,
    });

    await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${adminMember.token}`)
      .send({ token });

    const res = await request(app)
      .post(`/api/v1/homes/${home.id}/members/invite`)
      .set('Authorization', `Bearer ${adminMember.token}`)
      .send({ phone: '9876500002', role: HomeMemberRole.VIEWER });

    expect(res.status).toBe(201);
  });

  it('3. member cannot exceed permissions', async () => {
    const owner = await loginCustomer();
    const member = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'member-invite-token-123456';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: member.phone,
      role: HomeMemberRole.MEMBER,
      token,
    });

    await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ token });

    const res = await request(app)
      .post(`/api/v1/homes/${home.id}/members/invite`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ phone: '9876500003', role: HomeMemberRole.VIEWER });

    expect(res.status).toBe(403);
  });

  it('4. viewer cannot perform restricted home actions', async () => {
    const owner = await loginCustomer();
    const viewer = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'viewer-invite-token-123456';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: viewer.phone,
      role: HomeMemberRole.VIEWER,
      token,
    });

    await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({ token });

    await expect(
      assertHomeCapability(viewer.userId, home.id, HomeCapability.BOOKING_PAY),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('5. user cannot access another home', async () => {
    const owner = await loginCustomer();
    const stranger = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const res = await request(app)
      .get(`/api/v1/homes/${home.id}/members`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(404);
  });

  it('6. invitation expires', async () => {
    const owner = await loginCustomer();
    const invitee = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'expired-invite-token-123456';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: invitee.phone,
      role: HomeMemberRole.MEMBER,
      token,
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .send({ token });

    expect(res.status).toBe(410);
  });

  it('7. invitation cannot be accepted twice', async () => {
    const owner = await loginCustomer();
    const invitee = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'double-accept-token-12345678';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: invitee.phone,
      role: HomeMemberRole.MEMBER,
      token,
    });

    const first = await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .send({ token });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${invitee.token}`)
      .send({ token });
    expect(second.status).toBe(404);
  });

  it('8. last owner cannot be removed', async () => {
    const owner = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);
    const member = await HomeMember.findOne({ homeId: home.id, customerId: owner.userId });

    const res = await request(app)
      .delete(`/api/v1/homes/${home.id}/members/${member!._id}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(409);
  });

  it('9. removed member loses access', async () => {
    const owner = await loginCustomer();
    const memberUser = await loginCustomer();
    const address = await createAddress(owner.token);
    const home = await createHome(owner.token, address.id);

    const token = 'remove-member-token-12345678';
    const invitation = await createInvitationRecord({
      homeId: home.id,
      invitedBy: owner.userId,
      phone: memberUser.phone,
      role: HomeMemberRole.MEMBER,
      token,
    });

    await request(app)
      .post(`/api/v1/home-invitations/${invitation._id}/accept`)
      .set('Authorization', `Bearer ${memberUser.token}`)
      .send({ token });

    const members = await request(app)
      .get(`/api/v1/homes/${home.id}/members`)
      .set('Authorization', `Bearer ${owner.token}`);
    const memberId = members.body.data.items.find(
      (m: { customerId: string }) => m.customerId === memberUser.userId,
    ).id;

    await request(app)
      .delete(`/api/v1/homes/${home.id}/members/${memberId}`)
      .set('Authorization', `Bearer ${owner.token}`);

    const res = await request(app)
      .get(`/api/v1/homes/${home.id}/members`)
      .set('Authorization', `Bearer ${memberUser.token}`);
    expect(res.status).toBe(404);
  });

  it('10. booking participant permissions enforced', async () => {
    const booker = await loginCustomer();
    const observer = await loginCustomer();
    const booking = await Booking.create({
      bookingNumber: 'GF-TEST-001',
      bookingType: BookingType.SCHEDULED,
      source: BookingSource.SLOT_RESERVATION,
      customerId: booker.userId,
      providerId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      providerServiceId: new mongoose.Types.ObjectId(),
      reservationId: new mongoose.Types.ObjectId(),
      addressSnapshot: ADDRESS_PAYLOAD,
      serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
      providerSnapshot: { fullName: 'Pro' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: new Date(Date.now() + 86400000),
      scheduledEnd: new Date(Date.now() + 90000000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
      payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
    });

    await BookingParticipant.create({
      bookingId: booking._id,
      customerId: observer.userId,
      role: BookingParticipantRole.OBSERVER,
      permissions: [BookingParticipantPermission.VIEW_BOOKING],
      addedBy: booker.userId,
    });

    const canTrack = await canAccessBooking(
      observer.userId,
      booking._id.toString(),
      BookingParticipantPermission.TRACK_PROVIDER,
    );
    expect(canTrack).toBe(false);

    const canView = await canAccessBooking(
      observer.userId,
      booking._id.toString(),
      BookingParticipantPermission.VIEW_BOOKING,
    );
    expect(canView).toBe(true);
  });

  it('11. provider sees only service recipient', async () => {
    const booker = await loginCustomer();
    const recipient = await loginCustomer();
    await User.findByIdAndUpdate(recipient.userId, { fullName: 'Father Recipient' });

    const booking = await Booking.create({
      bookingNumber: 'GF-TEST-002',
      bookingType: BookingType.SCHEDULED,
      source: BookingSource.SLOT_RESERVATION,
      customerId: booker.userId,
      providerId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      providerServiceId: new mongoose.Types.ObjectId(),
      reservationId: new mongoose.Types.ObjectId(),
      addressSnapshot: { ...ADDRESS_PAYLOAD, recipientName: 'Booker Name' },
      serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
      providerSnapshot: { fullName: 'Pro' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: new Date(Date.now() + 86400000),
      scheduledEnd: new Date(Date.now() + 90000000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
      payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
    });

    await BookingParticipant.create({
      bookingId: booking._id,
      customerId: recipient.userId,
      role: BookingParticipantRole.RECIPIENT,
      permissions: [BookingParticipantPermission.VIEW_BOOKING, BookingParticipantPermission.TRACK_PROVIDER],
      addedBy: booker.userId,
    });

    const recipientView = await getProviderServiceRecipient(booking._id.toString());
    expect(recipientView?.name).toBe('Father Recipient');
    expect(recipientView).not.toHaveProperty('participants');
  });

  it('12. provider verification document ownership enforced', async () => {
    const providerA = await loginProvider();
    const providerB = await loginProvider();

    const verification = await ProviderVerification.create({
      providerId: providerA.userId,
      type: ProviderVerificationType.IDENTITY,
      status: ProviderVerificationStatus.PENDING,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/provider/verifications/${verification._id}/documents`)
      .set('Authorization', `Bearer ${providerB.token}`)
      .field('documentType', 'ID_CARD')
      .attach('file', Buffer.from('fake-image'), 'id.png');

    expect(res.status).toBe(404);
  });

  it('13. verification approval is audited', async () => {
    const provider = await loginProvider();
    const admin = await loginAdmin();

    const verification = await ProviderVerification.create({
      providerId: provider.userId,
      type: ProviderVerificationType.IDENTITY,
      status: ProviderVerificationStatus.PENDING,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/provider-verifications/${verification._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: ProviderVerificationStatus.VERIFIED });

    expect(res.status).toBe(200);

    const audit = await AdminAuditLog.findOne({
      action: 'VERIFICATION_APPROVED',
      entityId: verification._id,
    });
    expect(audit).toBeTruthy();
  });

  it('14. provider cannot self-verify via admin endpoint', async () => {
    const provider = await loginProvider();
    const verification = await ProviderVerification.create({
      providerId: provider.userId,
      type: ProviderVerificationType.IDENTITY,
      status: ProviderVerificationStatus.PENDING,
      submittedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/provider-verifications/${verification._id}`)
      .set('Authorization', `Bearer ${provider.token}`)
      .send({ status: ProviderVerificationStatus.VERIFIED });

    expect(res.status).toBe(403);
  });

  it('15. skill verification affects eligibility', async () => {
    const provider = await loginProvider();
    const serviceId = new mongoose.Types.ObjectId();

    expect(await isProviderEligibleForService(provider.userId, serviceId.toString())).toBe(false);

    await ProviderSkill.create({
      providerId: provider.userId,
      skillId: serviceId,
      level: 'INTERMEDIATE',
      status: 'VERIFIED',
      verifiedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });

    expect(await isProviderEligibleForService(provider.userId, serviceId.toString())).toBe(true);
  });

  it('16. performance metrics calculated correctly', async () => {
    const providerId = new mongoose.Types.ObjectId().toString();
    const now = new Date();

    await Booking.create([
      {
        bookingNumber: 'GF-P1',
        bookingType: BookingType.SCHEDULED,
        source: BookingSource.SLOT_RESERVATION,
        customerId: new mongoose.Types.ObjectId(),
        providerId,
        serviceId: new mongoose.Types.ObjectId(),
        providerServiceId: new mongoose.Types.ObjectId(),
        reservationId: new mongoose.Types.ObjectId(),
        addressSnapshot: ADDRESS_PAYLOAD,
        serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
        providerSnapshot: { fullName: 'Pro' },
        status: BookingStatus.COMPLETED,
        providerRequestStatus: ProviderRequestStatus.ACCEPTED,
        scheduledStart: now,
        scheduledEnd: now,
        timezone: 'Asia/Kolkata',
        durationMinutes: 60,
        price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
        payment: { method: 'PAY_ON_SERVICE', status: 'PAID' },
        updatedAt: now,
      },
      {
        bookingNumber: 'GF-P2',
        bookingType: BookingType.SCHEDULED,
        source: BookingSource.SLOT_RESERVATION,
        customerId: new mongoose.Types.ObjectId(),
        providerId,
        serviceId: new mongoose.Types.ObjectId(),
        providerServiceId: new mongoose.Types.ObjectId(),
        reservationId: new mongoose.Types.ObjectId(),
        addressSnapshot: ADDRESS_PAYLOAD,
        serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
        providerSnapshot: { fullName: 'Pro' },
        status: BookingStatus.CANCELLED,
        providerRequestStatus: ProviderRequestStatus.ACCEPTED,
        cancellation: { actorRole: UserRole.PROVIDER, reason: 'Unavailable', cancelledAt: now },
        scheduledStart: now,
        scheduledEnd: now,
        timezone: 'Asia/Kolkata',
        durationMinutes: 60,
        price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
        payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
        updatedAt: now,
      },
    ]);

    const metric = await aggregateProviderPerformance(providerId, PerformancePeriod.THIRTY_DAYS);
    expect(metric.completedJobs).toBe(1);
    expect(metric.completionRate).toBeGreaterThan(0);
  });

  it('17. duplicate risk signal prevented', async () => {
    const providerId = new mongoose.Types.ObjectId().toString();
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      await Booking.create({
        bookingNumber: `GF-A${i}`,
        bookingType: BookingType.SCHEDULED,
        source: BookingSource.SLOT_RESERVATION,
        customerId: new mongoose.Types.ObjectId(),
        providerId,
        serviceId: new mongoose.Types.ObjectId(),
        providerServiceId: new mongoose.Types.ObjectId(),
        reservationId: new mongoose.Types.ObjectId(),
        addressSnapshot: ADDRESS_PAYLOAD,
        serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
        providerSnapshot: { fullName: 'Pro' },
        status: BookingStatus.COMPLETED,
        providerRequestStatus: ProviderRequestStatus.ACCEPTED,
        scheduledStart: now,
        scheduledEnd: now,
        timezone: 'Asia/Kolkata',
        durationMinutes: 60,
        price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
        payment: { method: 'PAY_ON_SERVICE', status: 'PAID' },
        createdAt: now,
        updatedAt: now,
      });
    }

    for (let i = 0; i < 6; i++) {
      await Booking.create({
        bookingNumber: `GF-R${i}`,
        bookingType: BookingType.SCHEDULED,
        source: BookingSource.SLOT_RESERVATION,
        customerId: new mongoose.Types.ObjectId(),
        providerId,
        serviceId: new mongoose.Types.ObjectId(),
        providerServiceId: new mongoose.Types.ObjectId(),
        reservationId: new mongoose.Types.ObjectId(),
        addressSnapshot: ADDRESS_PAYLOAD,
        serviceSnapshot: { name: 'Test', pricing: { currency: 'INR' } },
        providerSnapshot: { fullName: 'Pro' },
        status: BookingStatus.CANCELLED,
        providerRequestStatus: ProviderRequestStatus.ACCEPTED,
        cancellation: { actorRole: UserRole.PROVIDER, reason: 'Unavailable', cancelledAt: now },
        scheduledStart: now,
        scheduledEnd: now,
        timezone: 'Asia/Kolkata',
        durationMinutes: 60,
        price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
        payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
        createdAt: now,
        updatedAt: now,
      });
    }

    const first = await detectOperationalSignals();
    const second = await detectOperationalSignals();
    expect(first).toBeGreaterThan(0);

    const activeSignals = await OperationalRiskSignal.countDocuments({
      entityId: providerId,
      status: { $in: [OperationalRiskSignalStatus.NEW, OperationalRiskSignalStatus.UNDER_REVIEW] },
    });
    expect(activeSignals).toBeGreaterThan(0);
    expect(second).toBe(0);
  });

  it('18. weak signal does not auto-suspend provider', async () => {
    const provider = await loginProvider();
    await OperationalRiskSignal.create({
      entityType: 'PROVIDER',
      entityId: provider.userId,
      signalType: 'HIGH_CANCELLATION_RATE',
      severity: 'LOW',
      status: OperationalRiskSignalStatus.NEW,
      details: 'Test signal',
      detectedAt: new Date(),
    });

    const profile = await ProviderProfile.findOne({ userId: provider.userId });
    expect(profile?.providerStatus).toBe('ACTIVE');
  });

  it('19. admin signal action is audited', async () => {
    const admin = await loginAdmin();
    const signal = await OperationalRiskSignal.create({
      entityType: 'PROVIDER',
      entityId: new mongoose.Types.ObjectId().toString(),
      signalType: 'HIGH_CANCELLATION_RATE',
      severity: 'MEDIUM',
      status: OperationalRiskSignalStatus.NEW,
      details: 'Review needed',
      detectedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/api/v1/admin/operational-signals/${signal._id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: OperationalRiskSignalStatus.DISMISSED, resolutionNote: 'False positive' });

    expect(res.status).toBe(200);

    const audit = await AdminAuditLog.findOne({ action: 'RISK_SIGNAL_DISMISSED', entityId: signal._id });
    expect(audit).toBeTruthy();
  });

  it('20. existing bookings remain compatible', async () => {
    const customer = await loginCustomer();
    const booking = await Booking.create({
      bookingNumber: 'GF-LEGACY-1',
      bookingType: BookingType.SCHEDULED,
      source: BookingSource.SLOT_RESERVATION,
      customerId: customer.userId,
      providerId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      providerServiceId: new mongoose.Types.ObjectId(),
      reservationId: new mongoose.Types.ObjectId(),
      addressSnapshot: ADDRESS_PAYLOAD,
      serviceSnapshot: { name: 'Legacy', pricing: { currency: 'INR' } },
      providerSnapshot: { fullName: 'Pro' },
      status: BookingStatus.CONFIRMED,
      providerRequestStatus: ProviderRequestStatus.ACCEPTED,
      scheduledStart: new Date(Date.now() + 86400000),
      scheduledEnd: new Date(Date.now() + 90000000),
      timezone: 'Asia/Kolkata',
      durationMinutes: 60,
      price: { estimatedAmount: 500, finalAmount: 500, currency: 'INR' },
      payment: { method: 'PAY_ON_SERVICE', status: 'PENDING' },
    });

    const res = await request(app)
      .get(`/api/v1/bookings/${booking._id}`)
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(booking._id.toString());
    expect(res.body.data.participantSummary).toBeTruthy();
  });
});
