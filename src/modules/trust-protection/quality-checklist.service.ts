import { QualityChecklistStatus } from '@ghaarfix/shared-types';
import { ChecklistSnapshot, ServiceQualityChecklist } from '@/models/TrustProtection.js';
import { Booking } from '@/models/Booking.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function getOrCreateChecklistForService(serviceId: string) {
  let checklist = await ServiceQualityChecklist.findOne({
    serviceId,
    status: QualityChecklistStatus.ACTIVE,
  }).sort({ version: -1 });

  if (!checklist) {
    checklist = await ServiceQualityChecklist.create({
      serviceId,
      version: 1,
      items: [
        { label: 'Service completed as described', itemType: 'BOOLEAN', required: true },
        { label: 'Work area cleaned', itemType: 'BOOLEAN', required: true },
        { label: 'Customer informed of outcome', itemType: 'BOOLEAN', required: true },
      ],
      requiredEvidence: ['BEFORE', 'AFTER'],
      status: QualityChecklistStatus.ACTIVE,
    });
  }

  return checklist;
}

export async function snapshotChecklistForBooking(bookingId: string, serviceId: string) {
  const existing = await ChecklistSnapshot.findOne({ bookingId });
  if (existing) return existing;

  const checklist = await getOrCreateChecklistForService(serviceId);
  return ChecklistSnapshot.create({
    bookingId,
    checklistId: checklist._id,
    version: checklist.version,
    items: checklist.items.map((item) => ({
      label: item.label,
      itemType: item.itemType,
      required: item.required,
      completed: false,
    })),
  });
}

export async function submitChecklistCompletion(
  providerId: string,
  bookingId: string,
  items: Array<{ label: string; completed: boolean; value?: string }>,
) {
  const booking = await Booking.findOne({ _id: bookingId, providerId });
  if (!booking) throw new AppError('Booking not found.', 404, ErrorCode.NOT_FOUND);

  let snapshot = await ChecklistSnapshot.findOne({ bookingId });
  if (!snapshot) {
    snapshot = await snapshotChecklistForBooking(bookingId, booking.serviceId.toString());
  }

  for (const submitted of items) {
    const item = snapshot.items.find((i) => i.label === submitted.label);
    if (item) {
      item.completed = submitted.completed;
      item.value = submitted.value;
    }
  }

  const requiredIncomplete = snapshot.items.some((i) => i.required && !i.completed);
  if (requiredIncomplete) {
    throw new AppError('Required checklist items incomplete.', 400, ErrorCode.VALIDATION_ERROR);
  }

  snapshot.completedAt = new Date();
  await snapshot.save();
  return snapshot;
}

export async function getChecklistSnapshot(bookingId: string) {
  return ChecklistSnapshot.findOne({ bookingId });
}
