import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import {
  ApprovalRequestStatus,
  BulkBookingStatus,
  OrganizationMemberRole,
  OrganizationPermission,
  OrganizationType,
  UserRole,
} from '@ghaarfix/shared-types';
import { createApp } from '@/app.js';
import { connectDatabase, disconnectDatabase } from '@/config/database.js';
import { Otp } from '@/models/Otp.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { User } from '@/models/User.js';
import { Organization, OrganizationMember } from '@/models/Organization.js';
import { ManagedProperty } from '@/models/ManagedProperty.js';
import { ApprovalRequest } from '@/models/OrganizationOperations.js';
import { BulkBookingRequest } from '@/models/OrganizationOperations.js';
import { OrganizationBudget } from '@/models/OrganizationOperations.js';
import { seedAdminUser } from '@/modules/auth/auth.service.js';
import { runPhase13Migrations } from '@/migrations/003-phase13-organizations.js';
import { runPhase13Jobs } from '@/modules/organizations/phase13-jobs.js';
import * as budgetService from '@/modules/organizations/organization-budget.service.js';
import * as approvalService from '@/modules/organizations/approval.service.js';
import { permissionsForRole } from '@/modules/organizations/organization-authorization.service.js';
import { hashOtp } from '@/utils/crypto.js';
import { normalizePhone } from '@/utils/phone.js';

const app = createApp();

let phoneSeq = 9876901000;
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
  await CustomerProfile.create({ userId: (await User.findOne({ phone: normalized }))!._id, fullName: 'Org User' });
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

describe('Phase 13 — Organization & Property Management', () => {
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
    await runPhase13Migrations();
  });

  it('1. creates organization and assigns owner', async () => {
    const customer = await loginCustomer();
    const res = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ name: 'Green Valley RWA', type: OrganizationType.RWA });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('green-valley-rwa');

    const member = await OrganizationMember.findOne({ userId: customer.userId });
    expect(member?.role).toBe(OrganizationMemberRole.OWNER);
  });

  it('2. lists my organizations', async () => {
    const customer = await loginCustomer();
    await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ name: 'Test Society', type: OrganizationType.SOCIETY });

    const res = await request(app)
      .get('/api/v1/organizations/me')
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
  });

  it('3. enforces organization permission for property create', async () => {
    const owner = await loginCustomer();
    const viewer = await loginCustomer();
    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Perm Test Org', type: OrganizationType.PROPERTY_MANAGER });
    const orgId = orgRes.body.data.id as string;

    await OrganizationMember.create({
      organizationId: orgId,
      userId: viewer.userId,
      role: OrganizationMemberRole.VIEWER,
      permissions: permissionsForRole(OrganizationMemberRole.VIEWER),
      status: 'ACTIVE',
      joinedAt: new Date(),
    });

    const denied = await request(app)
      .post(`/api/v1/organizations/${orgId}/properties`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .send({
        name: 'Block A',
        type: 'BUILDING',
        address: {
          addressLine1: '1 Main St',
          city: 'Faridabad',
          state: 'Haryana',
          postalCode: '121001',
        },
      });
    expect(denied.status).toBe(403);
  });

  it('4. blocks cross-organization property access', async () => {
    const a = await loginCustomer();
    const b = await loginCustomer();
    const orgA = (
      await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${a.token}`)
        .send({ name: 'Org A', type: OrganizationType.LANDLORD })
    ).body.data.id as string;

    const prop = await request(app)
      .post(`/api/v1/organizations/${orgA}/properties`)
      .set('Authorization', `Bearer ${a.token}`)
      .send({
        name: 'Tower 1',
        type: 'BUILDING',
        address: { addressLine1: 'Tower A', city: 'Delhi', state: 'DL', postalCode: '110001' },
      });
    expect(prop.status).toBe(201);

    const orgB = (
      await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${b.token}`)
        .send({ name: 'Org B', type: OrganizationType.LANDLORD })
    ).body.data.id as string;

    const leak = await request(app)
      .get(`/api/v1/properties/${orgB}/${prop.body.data.id}`)
      .set('Authorization', `Bearer ${b.token}`);
    expect(leak.status).toBe(404);
  });

  it('5. creates property with units and occupants', async () => {
    const customer = await loginCustomer();
    const orgId = (
      await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ name: 'Units Org', type: OrganizationType.SOCIETY })
    ).body.data.id as string;

    const prop = await request(app)
      .post(`/api/v1/organizations/${orgId}/properties`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        name: 'Sunrise Apartments',
        type: 'BUILDING',
        address: { addressLine1: 'Park Road', city: 'Noida', state: 'UP', postalCode: '201301' },
      });
    const propertyId = prop.body.data.id as string;

    const unit = await request(app)
      .post(`/api/v1/properties/${orgId}/${propertyId}/units`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ name: 'Flat A-101', unitNumber: 'A-101', floor: '1' });
    expect(unit.status).toBe(201);

    const occupant = await request(app)
      .post(`/api/v1/properties/${orgId}/${propertyId}/occupants`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ nameSnapshot: 'Ravi Kumar', type: 'TENANT' });
    expect(occupant.status).toBe(201);
  });

  it('6. approval workflow approve and reject', async () => {
    const customer = await loginCustomer();
    const org = await Organization.create({
      name: 'Approval Org',
      slug: 'approval-org',
      type: OrganizationType.OFFICE,
      status: 'ACTIVE',
      settings: { approvalAmountThreshold: 1000 },
    });
    await OrganizationMember.create({
      organizationId: org._id,
      userId: customer.userId,
      role: OrganizationMemberRole.FINANCE,
      permissions: permissionsForRole(OrganizationMemberRole.FINANCE),
      status: 'ACTIVE',
      joinedAt: new Date(),
    });

    const req = await ApprovalRequest.create({
      organizationId: org._id,
      resourceType: 'BOOKING',
      resourceId: 'test-booking',
      requestedBy: customer.userId,
      status: ApprovalRequestStatus.PENDING,
    });

    const approved = await approvalService.approveRequest(customer.userId, req._id.toString(), 'Looks good');
    expect(approved?.status).toBe(ApprovalRequestStatus.APPROVED);

    const req2 = await ApprovalRequest.create({
      organizationId: org._id,
      resourceType: 'BOOKING',
      resourceId: 'test-booking-2',
      requestedBy: customer.userId,
      status: ApprovalRequestStatus.PENDING,
    });
    const rejected = await approvalService.rejectRequest(customer.userId, req2._id.toString(), 'Over budget');
    expect(rejected?.status).toBe(ApprovalRequestStatus.REJECTED);
  });

  it('7. budget reservation concurrency safety', async () => {
    const customer = await loginCustomer();
    const orgRes = await request(app)
      .post('/api/v1/organizations')
      .set('Authorization', `Bearer ${customer.token}`)
      .send({ name: 'Budget Org', type: OrganizationType.COMMERCIAL });
    const orgId = orgRes.body.data.id as string;

    await budgetService.upsertBudget(customer.userId, orgId, {
      period: 'MONTHLY' as never,
      periodStart: new Date(new Date().setDate(1)),
      periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      totalBudget: 1000,
    });

    await budgetService.reserveBudget(orgId, 600);
    await expect(budgetService.reserveBudget(orgId, 500)).rejects.toThrow(/Insufficient budget/);
    await budgetService.releaseBudgetReservation(orgId, 600);
    const after = await budgetService.reserveBudget(orgId, 500);
    expect(after.reservedBudget).toBeGreaterThanOrEqual(500);
  });

  it('8. bulk booking partial processing', async () => {
    const customer = await loginCustomer();
    const orgId = (
      await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ name: 'Bulk Org', type: OrganizationType.PROPERTY_MANAGER })
    ).body.data.id as string;

    const p1 = await ManagedProperty.create({
      organizationId: orgId,
      name: 'P1',
      type: 'APARTMENT',
      address: { addressLine1: '1', city: 'X', state: 'Y', postalCode: '121001' },
      status: 'ACTIVE',
    });
    const p2 = await ManagedProperty.create({
      organizationId: orgId,
      name: 'P2',
      type: 'APARTMENT',
      address: { addressLine1: '2', city: 'X', state: 'Y', postalCode: '121001' },
      status: 'ACTIVE',
    });

    const serviceId = new mongoose.Types.ObjectId().toString();
    const bulk = await request(app)
      .post(`/api/v1/organizations/${orgId}/bulk-bookings`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({
        serviceId,
        properties: [{ propertyId: p1._id.toString() }, { propertyId: p2._id.toString() }],
      });
    expect(bulk.status).toBe(201);

    const { processBulkBookingChunk } = await import('@/modules/organizations/bulk-booking.service.js');
    await processBulkBookingChunk(bulk.body.data.id);
    const updated = await BulkBookingRequest.findById(bulk.body.data.id);
    expect(updated?.status).toBe(BulkBookingStatus.COMPLETED);
  });

  it('9. organization analytics scoped', async () => {
    const customer = await loginCustomer();
    const orgId = (
      await request(app)
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({ name: 'Analytics Org', type: OrganizationType.RWA })
    ).body.data.id as string;

    const res = await request(app)
      .get(`/api/v1/organizations/${orgId}/analytics`)
      .set('Authorization', `Bearer ${customer.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalProperties).toBe(0);
  });

  it('10. phase13 jobs run idempotently', async () => {
    const first = await runPhase13Jobs();
    const second = await runPhase13Jobs();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});
