import {
  ErrorCode,
  ProviderVerificationDocumentStatus,
  ProviderVerificationStatus,
  ProviderVerificationType,
} from '@ghaarfix/shared-types';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { ProviderProfile } from '@/models/ProviderProfile.js';
import { ProviderVerification } from '@/models/ProviderVerification.js';
import { ProviderVerificationDocument } from '@/models/ProviderVerificationDocument.js';
import { storeFile } from '@/modules/storage/storage.service.js';
import { AppError } from '@/utils/AppError.js';

function serializeVerification(v: InstanceType<typeof ProviderVerification>) {
  return {
    id: v._id.toString(),
    type: v.type,
    status: v.status,
    submittedAt: v.submittedAt?.toISOString(),
    verifiedAt: v.verifiedAt?.toISOString(),
    expiresAt: v.expiresAt?.toISOString(),
    rejectionReason: v.rejectionReason,
  };
}

export async function listProviderVerifications(providerId: string) {
  const types = Object.values(ProviderVerificationType);
  const existing = await ProviderVerification.find({ providerId });
  const map = new Map(existing.map((v) => [v.type, v]));
  return types.map((type) => {
    const doc = map.get(type);
    return doc
      ? serializeVerification(doc)
      : { type, status: ProviderVerificationStatus.NOT_STARTED };
  });
}

export async function submitProviderVerification(
  providerId: string,
  type: ProviderVerificationType,
  metadata?: Record<string, unknown>,
) {
  const verification = await ProviderVerification.findOneAndUpdate(
    { providerId, type },
    {
      $set: {
        status: ProviderVerificationStatus.PENDING,
        submittedAt: new Date(),
        rejectionReason: null,
        metadata,
      },
    },
    { upsert: true, new: true },
  );
  return serializeVerification(verification);
}

export async function uploadVerificationDocument(
  providerId: string,
  verificationId: string,
  documentType: string,
  file: Express.Multer.File,
) {
  const verification = await ProviderVerification.findOne({ _id: verificationId, providerId });
  if (!verification) throw new AppError('Verification not found.', 404, ErrorCode.NOT_FOUND);

  const stored = await storeFile(file.buffer, file.mimetype, `verification/${providerId}`);
  const doc = await ProviderVerificationDocument.create({
    providerId,
    verificationId: verification._id,
    documentType,
    fileUrl: stored.fileUrl,
    fileKey: stored.fileKey,
    status: ProviderVerificationDocumentStatus.PENDING,
  });

  verification.status = ProviderVerificationStatus.PENDING;
  verification.submittedAt = new Date();
  await verification.save();

  return { id: doc._id.toString(), documentType, status: doc.status, fileUrl: doc.fileUrl };
}

export async function adminListVerifications(query: { status?: ProviderVerificationStatus }) {
  const filter = query.status ? { status: query.status } : {};
  const items = await ProviderVerification.find(filter).sort({ submittedAt: -1 }).limit(100);
  return items.map(serializeVerification);
}

export async function adminReviewVerification(
  adminId: string,
  verificationId: string,
  input: { status: ProviderVerificationStatus.VERIFIED | ProviderVerificationStatus.REJECTED; reason?: string },
) {
  const verification = await ProviderVerification.findById(verificationId);
  if (!verification) throw new AppError('Verification not found.', 404, ErrorCode.NOT_FOUND);

  const before = { status: verification.status };
  verification.status = input.status;
  if (input.status === ProviderVerificationStatus.VERIFIED) {
    verification.verifiedAt = new Date();
    verification.verifiedBy = adminId as never;
    verification.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    verification.rejectionReason = undefined;
    if (verification.type === ProviderVerificationType.IDENTITY) {
      await ProviderProfile.findOneAndUpdate(
        { userId: verification.providerId },
        { $set: { isVerified: true } },
      );
    }
  } else {
    verification.rejectionReason = input.reason ?? 'Rejected by admin';
  }
  await verification.save();

  await AdminAuditLog.create({
    adminId,
    action: input.status === ProviderVerificationStatus.VERIFIED ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
    entityType: 'PROVIDER_VERIFICATION',
    entityId: verification._id,
    before,
    after: { status: verification.status },
    reason: input.reason ?? 'Admin review',
  });

  return serializeVerification(verification);
}

export async function expireVerifications(): Promise<number> {
  const now = new Date();
  const result = await ProviderVerification.updateMany(
    {
      status: ProviderVerificationStatus.VERIFIED,
      expiresAt: { $lte: now },
    },
    { $set: { status: ProviderVerificationStatus.EXPIRED } },
  );
  return result.modifiedCount ?? 0;
}
