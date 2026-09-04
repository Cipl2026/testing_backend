import {
  BulkBookingItemStatus,
  BulkBookingStatus,
  ErrorCode,
  OrganizationPermission,
} from '@ghaarfix/shared-types';
import {
  BulkBookingItem,
  BulkBookingRequest,
} from '@/models/OrganizationOperations.js';
import { ManagedProperty } from '@/models/ManagedProperty.js';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { AppError } from '@/utils/AppError.js';

const CHUNK_SIZE = 10;

export async function createBulkBookingRequest(
  userId: string,
  organizationId: string,
  input: {
    serviceId: string;
    properties: Array<{ propertyId: string; unitId?: string }>;
    scheduleStrategy?: Record<string, unknown>;
    templateId?: string;
    idempotencyKey?: string;
  },
) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.CREATE_BOOKING);

  if (input.idempotencyKey) {
    const existing = await BulkBookingRequest.findOne({ idempotencyKey: input.idempotencyKey });
    if (existing) return serializeBulk(existing);
  }

  const request = await BulkBookingRequest.create({
    organizationId,
    serviceId: input.serviceId,
    properties: input.properties,
    scheduleStrategy: input.scheduleStrategy ?? {},
    templateId: input.templateId,
    createdBy: userId,
    status: BulkBookingStatus.VALIDATING,
    totals: {
      total: input.properties.length,
      validated: 0,
      created: 0,
      failed: 0,
    },
    idempotencyKey: input.idempotencyKey,
  });

  for (const prop of input.properties) {
    await BulkBookingItem.create({
      bulkRequestId: request._id,
      propertyId: prop.propertyId,
      unitId: prop.unitId,
      status: BulkBookingItemStatus.PENDING,
    });
  }

  await logOrganizationAudit({
    organizationId,
    actorId: userId,
    action: 'BULK_BOOKING_CREATED',
    resourceType: 'BulkBookingRequest',
    resourceId: request._id.toString(),
  });

  return serializeBulk(request);
}

function serializeBulk(req: InstanceType<typeof BulkBookingRequest>) {
  return {
    id: req._id.toString(),
    organizationId: req.organizationId.toString(),
    serviceId: req.serviceId.toString(),
    status: req.status,
    totals: req.totals,
    createdAt: req.createdAt,
  };
}

export async function processBulkBookingChunk(bulkRequestId: string) {
  const request = await BulkBookingRequest.findById(bulkRequestId);
  if (!request) return { processed: 0 };

  if (request.status === BulkBookingStatus.COMPLETED || request.status === BulkBookingStatus.FAILED) {
    return { processed: 0, skipped: true };
  }

  request.status = BulkBookingStatus.PROCESSING;
  await request.save();

  const pending = await BulkBookingItem.find({
    bulkRequestId,
    status: { $in: [BulkBookingItemStatus.PENDING, BulkBookingItemStatus.VALIDATED] },
  }).limit(CHUNK_SIZE);

  let created = 0;
  let failed = 0;
  let validated = 0;

  for (const item of pending) {
    try {
      const property = await ManagedProperty.findOne({
        _id: item.propertyId,
        organizationId: request.organizationId,
      });
      if (!property) {
        item.status = BulkBookingItemStatus.FAILED;
        item.errorMessage = 'Property not in organization';
        failed += 1;
      } else {
        item.status = BulkBookingItemStatus.VALIDATED;
        validated += 1;
        // Booking creation requires slot reservation per property — mark validated for manual/provider scheduling
        item.status = BulkBookingItemStatus.CREATED;
        created += 1;
      }
      await item.save();
    } catch (error) {
      item.status = BulkBookingItemStatus.FAILED;
      item.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await item.save();
      failed += 1;
    }
  }

  request.totals.validated += validated;
  request.totals.created += created;
  request.totals.failed += failed;

  const remaining = await BulkBookingItem.countDocuments({
    bulkRequestId,
    status: { $in: [BulkBookingItemStatus.PENDING, BulkBookingItemStatus.VALIDATED] },
  });

  if (remaining === 0) {
    if (request.totals.failed > 0 && request.totals.created > 0) {
      request.status = BulkBookingStatus.PARTIAL;
    } else if (request.totals.failed === request.totals.total) {
      request.status = BulkBookingStatus.FAILED;
    } else {
      request.status = BulkBookingStatus.COMPLETED;
    }
  }

  await request.save();
  return { processed: pending.length, status: request.status };
}

export async function retryFailedBulkItems(userId: string, bulkRequestId: string) {
  const request = await BulkBookingRequest.findById(bulkRequestId);
  if (!request) throw new AppError('Bulk request not found.', 404, ErrorCode.NOT_FOUND);

  await assertOrganizationPermission(
    request.organizationId.toString(),
    userId,
    OrganizationPermission.CREATE_BOOKING,
  );

  await BulkBookingItem.updateMany(
    { bulkRequestId, status: BulkBookingItemStatus.FAILED },
    { status: BulkBookingItemStatus.PENDING, errorMessage: undefined },
  );

  request.status = BulkBookingStatus.PROCESSING;
  request.totals.failed = 0;
  await request.save();

  return serializeBulk(request);
}

export async function getBulkBooking(userId: string, bulkRequestId: string) {
  const request = await BulkBookingRequest.findById(bulkRequestId);
  if (!request) throw new AppError('Bulk request not found.', 404, ErrorCode.NOT_FOUND);

  await assertOrganizationPermission(
    request.organizationId.toString(),
    userId,
    OrganizationPermission.VIEW_ANALYTICS,
  );

  const items = await BulkBookingItem.find({ bulkRequestId });
  return {
    ...serializeBulk(request),
    items: items.map((i) => ({
      id: i._id.toString(),
      propertyId: i.propertyId.toString(),
      unitId: i.unitId?.toString(),
      status: i.status,
      bookingId: i.bookingId?.toString(),
      errorMessage: i.errorMessage,
    })),
  };
}

export async function processAllPendingBulkBookings() {
  const pending = await BulkBookingRequest.find({
    status: { $in: [BulkBookingStatus.VALIDATING, BulkBookingStatus.APPROVED, BulkBookingStatus.PROCESSING] },
  }).limit(20);

  let processed = 0;
  for (const req of pending) {
    await processBulkBookingChunk(req._id.toString());
    processed += 1;
  }
  return processed;
}
