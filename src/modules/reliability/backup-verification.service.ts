import { BackupVerificationStatus } from '@ghaarfix/shared-types';
import { BackupVerification } from '@/models/Reliability.js';

export async function recordBackupVerification(input: {
  backupId: string;
  status: BackupVerificationStatus;
  integrityResult?: string;
  verifiedBy?: string;
  notes?: string;
}) {
  return BackupVerification.findOneAndUpdate(
    { backupId: input.backupId },
    {
      status: input.status,
      integrityResult: input.integrityResult,
      verifiedBy: input.verifiedBy,
      notes: input.notes,
      restoreTestedAt:
        input.status === BackupVerificationStatus.PASSED ? new Date() : undefined,
    },
    { upsert: true, new: true },
  );
}

export async function listBackupVerifications(limit = 50) {
  const rows = await BackupVerification.find().sort({ updatedAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    backupId: r.backupId,
    status: r.status,
    restoreTestedAt: r.restoreTestedAt,
    integrityResult: r.integrityResult,
    notes: r.notes,
    updatedAt: r.updatedAt,
  }));
}

export async function runBackupVerificationCheck(): Promise<number> {
  const pending = await BackupVerification.countDocuments({
    status: BackupVerificationStatus.PENDING,
  });
  return pending;
}
