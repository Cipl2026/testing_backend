import { type ClientSession, Types } from 'mongoose';
import {
  FinancialDirection,
  FinancialEventStatus,
  FinancialEventType,
  FinancialSourceType,
} from '@ghaarfix/shared-types';
import { FinancialEvent, type IFinancialEvent } from '@/models/Finance.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { DEFAULT_CURRENCY } from '@ghaarfix/shared-types';

export interface CreateFinancialEventInput {
  eventType: FinancialEventType;
  sourceType: FinancialSourceType;
  sourceId: string | Types.ObjectId;
  bookingId?: string | Types.ObjectId;
  customerId?: string | Types.ObjectId;
  providerId?: string | Types.ObjectId;
  organizationId?: string | Types.ObjectId;
  cityId?: string | Types.ObjectId;
  zoneId?: string | Types.ObjectId;
  serviceId?: string | Types.ObjectId;
  amountMinor: number;
  currency?: string;
  direction: FinancialDirection;
  status?: FinancialEventStatus;
  occurredAt?: Date;
  effectiveAt?: Date;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  session?: ClientSession;
}

function assertIntegerMinor(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new AppError('amountMinor must be an integer', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export async function createFinancialEvent(
  input: CreateFinancialEventInput,
): Promise<IFinancialEvent> {
  assertIntegerMinor(input.amountMinor);

  const existing = await FinancialEvent.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;

  const now = new Date();
  try {
    const [event] = await FinancialEvent.create(
      [
        {
          eventType: input.eventType,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          bookingId: input.bookingId,
          customerId: input.customerId,
          providerId: input.providerId,
          organizationId: input.organizationId,
          cityId: input.cityId,
          zoneId: input.zoneId,
          serviceId: input.serviceId,
          amountMinor: input.amountMinor,
          currency: input.currency ?? DEFAULT_CURRENCY,
          direction: input.direction,
          status: input.status ?? FinancialEventStatus.POSTED,
          occurredAt: input.occurredAt ?? now,
          effectiveAt: input.effectiveAt ?? now,
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session: input.session },
    );
    return event;
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: number }).code === 11000) {
      const dup = await FinancialEvent.findOne({ idempotencyKey: input.idempotencyKey });
      if (dup) return dup;
    }
    throw err;
  }
}

export async function reverseFinancialEvent(
  eventId: string,
  idempotencyKey: string,
  adminId?: string,
): Promise<IFinancialEvent> {
  const original = await FinancialEvent.findById(eventId);
  if (!original) {
    throw new AppError('Financial event not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (original.status !== FinancialEventStatus.POSTED) {
    throw new AppError('Only posted events can be reversed.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const existingReversal = await FinancialEvent.findOne({ idempotencyKey });
  if (existingReversal) return existingReversal;

  const reversalDirection =
    original.direction === FinancialDirection.INFLOW
      ? FinancialDirection.OUTFLOW
      : original.direction === FinancialDirection.OUTFLOW
        ? FinancialDirection.INFLOW
        : FinancialDirection.NEUTRAL;

  const reversal = await createFinancialEvent({
    eventType: FinancialEventType.ADJUSTMENT,
    sourceType: FinancialSourceType.ADJUSTMENT,
    sourceId: original._id,
    bookingId: original.bookingId,
    customerId: original.customerId,
    providerId: original.providerId,
    organizationId: original.organizationId,
    cityId: original.cityId,
    zoneId: original.zoneId,
    serviceId: original.serviceId,
    amountMinor: original.amountMinor,
    currency: original.currency,
    direction: reversalDirection,
    status: FinancialEventStatus.POSTED,
    metadata: { reversalOf: original._id.toString(), originalEventType: original.eventType },
    idempotencyKey,
  });

  original.status = FinancialEventStatus.REVERSED;
  await original.save();

  if (adminId) {
    await AdminAuditLog.create({
      adminId,
      action: 'FINANCIAL_EVENT_REVERSAL',
      entityType: 'FinancialEvent',
      entityId: reversal._id,
      after: { reversalOf: original._id, amountMinor: original.amountMinor },
      reason: `Reversal of financial event ${original._id}`,
    });
  }

  return reversal;
}

export async function queryFinancialTimeline(filter: {
  from?: Date;
  to?: Date;
  eventType?: FinancialEventType;
  sourceType?: FinancialSourceType;
  bookingId?: string;
  providerId?: string;
  customerId?: string;
  cityId?: string;
  zoneId?: string;
  serviceId?: string;
  status?: FinancialEventStatus;
  page?: number;
  limit?: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.from || filter.to) {
    query.effectiveAt = {};
    if (filter.from) (query.effectiveAt as Record<string, Date>).$gte = filter.from;
    if (filter.to) (query.effectiveAt as Record<string, Date>).$lte = filter.to;
  }
  if (filter.eventType) query.eventType = filter.eventType;
  if (filter.sourceType) query.sourceType = filter.sourceType;
  if (filter.bookingId) query.bookingId = filter.bookingId;
  if (filter.providerId) query.providerId = filter.providerId;
  if (filter.customerId) query.customerId = filter.customerId;
  if (filter.cityId) query.cityId = filter.cityId;
  if (filter.zoneId) query.zoneId = filter.zoneId;
  if (filter.serviceId) query.serviceId = filter.serviceId;
  if (filter.status) query.status = filter.status;

  const page = filter.page ?? 1;
  const limit = Math.min(filter.limit ?? 50, 200);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    FinancialEvent.find(query).sort({ effectiveAt: -1 }).skip(skip).limit(limit),
    FinancialEvent.countDocuments(query),
  ]);

  return { items, total, page, limit };
}

export async function aggregateByEventType(
  from: Date,
  to: Date,
  direction?: FinancialDirection,
): Promise<Record<string, number>> {
  const match: Record<string, unknown> = {
    effectiveAt: { $gte: from, $lte: to },
    status: FinancialEventStatus.POSTED,
  };
  if (direction) match.direction = direction;

  const rows = await FinancialEvent.aggregate([
    { $match: match },
    { $group: { _id: '$eventType', total: { $sum: '$amountMinor' } } },
  ]);

  return Object.fromEntries(rows.map((r) => [r._id, r.total]));
}

export function assertEventImmutable(event: IFinancialEvent): void {
  if (event.status === FinancialEventStatus.POSTED || event.status === FinancialEventStatus.REVERSED) {
    throw new AppError('Posted financial events are immutable.', 400, ErrorCode.VALIDATION_ERROR);
  }
}

export async function sumPostedMinor(filter: Record<string, unknown>): Promise<number> {
  const rows = await FinancialEvent.aggregate([
    { $match: { ...filter, status: FinancialEventStatus.POSTED } },
    { $group: { _id: null, total: { $sum: '$amountMinor' } } },
  ]);
  return rows[0]?.total ?? 0;
}
