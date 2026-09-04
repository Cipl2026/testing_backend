import {
  BookingStatus,
  ErrorCode,
  ServiceEvidenceType,
  TimelineEventType,
  UserRole,
} from '@ghaarfix/shared-types';
import { Booking } from '@/models/Booking.js';
import { ServiceEvidence } from '@/models/ServiceEvidence.js';
import { addTimelineEvent } from '@/modules/bookings/timeline.service.js';
import { storeFile } from '@/modules/storage/storage.service.js';
import { AppError } from '@/utils/AppError.js';

const ALLOWED_STATUSES = [
  BookingStatus.PROVIDER_ARRIVED,
  BookingStatus.IN_PROGRESS,
  BookingStatus.COMPLETED,
];

export async function uploadServiceEvidence(
  providerId: string,
  bookingId: string,
  input: {
    type: ServiceEvidenceType;
    buffer: Buffer;
    mimeType: string;
    caption?: string;
    capturedAt?: string;
  },
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);
  if (!ALLOWED_STATUSES.includes(booking.status)) {
    throw new AppError('Evidence upload not allowed in current booking state.', 409, ErrorCode.CONFLICT);
  }

  const stored = await storeFile(input.buffer, input.mimeType, `evidence/${bookingId}`);

  const evidence = await ServiceEvidence.create({
    bookingId,
    providerId,
    type: input.type,
    fileUrl: stored.fileUrl,
    fileKey: stored.fileKey,
    mimeType: stored.mimeType,
    fileSizeBytes: stored.fileSizeBytes,
    caption: input.caption,
    capturedAt: input.capturedAt ? new Date(input.capturedAt) : new Date(),
  });

  await addTimelineEvent({
    bookingId,
    type: TimelineEventType.SERVICE_EVIDENCE_UPLOADED,
    actorId: providerId,
    actorRole: UserRole.PROVIDER,
    metadata: { evidenceType: input.type },
  });

  return serializeEvidence(evidence);
}

export async function listBookingEvidence(
  userId: string,
  bookingId: string,
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN',
) {
  const filter: Record<string, unknown> = { _id: bookingId };
  if (role === 'CUSTOMER') filter.customerId = userId;
  if (role === 'PROVIDER') filter.providerId = userId;

  const booking = await Booking.findOne(filter);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  const items = await ServiceEvidence.find({ bookingId }).sort({ createdAt: 1 });
  return items.map(serializeEvidence);
}

function serializeEvidence(doc: InstanceType<typeof ServiceEvidence>) {
  return {
    id: doc._id.toString(),
    bookingId: doc.bookingId.toString(),
    type: doc.type,
    fileUrl: doc.fileUrl,
    caption: doc.caption,
    capturedAt: doc.capturedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function getEvidenceFileKey(evidenceId: string, userId: string, role: string) {
  const evidence = await ServiceEvidence.findById(evidenceId);
  if (!evidence) throw new AppError('Evidence not found.', 404, ErrorCode.NOT_FOUND);

  const booking = await Booking.findById(evidence.bookingId);
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  if (role === 'CUSTOMER' && booking.customerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }
  if (role === 'PROVIDER' && booking.providerId.toString() !== userId) {
    throw new AppError('Forbidden.', 403, ErrorCode.FORBIDDEN);
  }

  return evidence.fileKey;
}
