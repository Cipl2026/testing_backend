import { ErrorCode, PartApprovalStatus } from '@ghaarfix/shared-types';
import { PartApproval } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { AppError } from '@/utils/AppError.js';

const APPROVAL_TTL_HOURS = 24;

export async function requestPartApproval(
  providerId: string,
  bookingId: string,
  input: {
    partName: string;
    quantity: number;
    unitPrice: number;
    reason: string;
    warrantyDays?: number;
    evidenceFileKey?: string;
  },
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const totalPrice = input.quantity * input.unitPrice;
  const expiresAt = new Date(Date.now() + APPROVAL_TTL_HOURS * 60 * 60 * 1000);

  return PartApproval.create({
    bookingId,
    providerId,
    customerId: booking.customerId,
    partName: input.partName,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    totalPrice,
    reason: input.reason,
    warrantyDays: input.warrantyDays,
    evidenceFileKey: input.evidenceFileKey,
    status: PartApprovalStatus.PENDING,
    expiresAt,
  });
}

export async function approvePart(customerId: string, partId: string) {
  const part = await PartApproval.findOne({ _id: partId, customerId });
  if (!part) throw new AppError('Part approval not found.', 404, ErrorCode.NOT_FOUND);
  if (part.status !== PartApprovalStatus.PENDING) {
    throw new AppError('Part approval is no longer pending.', 409, ErrorCode.CONFLICT);
  }
  if (part.expiresAt < new Date()) {
    part.status = PartApprovalStatus.EXPIRED;
    await part.save();
    throw new AppError('Part approval request has expired.', 410, ErrorCode.CONFLICT);
  }

  part.status = PartApprovalStatus.APPROVED;
  part.approvedAt = new Date();
  await part.save();
  return serializePart(part);
}

export async function rejectPart(customerId: string, partId: string) {
  const part = await PartApproval.findOne({ _id: partId, customerId });
  if (!part) throw new AppError('Part approval not found.', 404, ErrorCode.NOT_FOUND);
  if (part.status !== PartApprovalStatus.PENDING) {
    throw new AppError('Part approval is no longer pending.', 409, ErrorCode.CONFLICT);
  }
  part.status = PartApprovalStatus.REJECTED;
  await part.save();
  return serializePart(part);
}

export async function listBookingPartApprovals(bookingId: string) {
  const items = await PartApproval.find({ bookingId }).sort({ createdAt: -1 });
  return items.map(serializePart);
}

export async function assertPartsApprovedForInvoicing(bookingId: string) {
  const pending = await PartApproval.countDocuments({
    bookingId,
    status: PartApprovalStatus.PENDING,
  });
  if (pending > 0) {
    throw new AppError('Unapproved parts cannot be invoiced.', 409, ErrorCode.CONFLICT);
  }
}

export async function getApprovedPartsTotal(bookingId: string): Promise<number> {
  const approved = await PartApproval.find({
    bookingId,
    status: PartApprovalStatus.APPROVED,
  });
  return approved.reduce((sum, p) => sum + p.totalPrice, 0);
}

export async function expireStalePartApprovals(): Promise<number> {
  const result = await PartApproval.updateMany(
    { status: PartApprovalStatus.PENDING, expiresAt: { $lte: new Date() } },
    { $set: { status: PartApprovalStatus.EXPIRED } },
  );
  return result.modifiedCount;
}

function serializePart(part: InstanceType<typeof PartApproval>) {
  return {
    id: part._id.toString(),
    bookingId: part.bookingId.toString(),
    partName: part.partName,
    quantity: part.quantity,
    unitPrice: part.unitPrice,
    totalPrice: part.totalPrice,
    reason: part.reason,
    warrantyDays: part.warrantyDays,
    status: part.status,
    expiresAt: part.expiresAt,
    approvedAt: part.approvedAt,
  };
}
