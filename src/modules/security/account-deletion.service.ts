import { AccountDeletionStatus } from '@ghaarfix/shared-types';
import { AccountDeletionRequest } from '@/models/Security.js';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';
import { revokeOtherSessions } from '@/modules/security/session.service.js';

const DELETION_GRACE_DAYS = 7;

export async function requestAccountDeletion(userId: string, reason?: string) {
  const existing = await AccountDeletionRequest.findOne({
    userId,
    status: {
      $in: [
        AccountDeletionStatus.REQUESTED,
        AccountDeletionStatus.PENDING_VERIFICATION,
        AccountDeletionStatus.SCHEDULED,
        AccountDeletionStatus.PROCESSING,
      ],
    },
  });
  if (existing) return formatDeletion(existing);

  const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const request = await AccountDeletionRequest.create({
    userId,
    status: AccountDeletionStatus.SCHEDULED,
    reason,
    scheduledFor,
    retainedDataTypes: ['financial_ledger', 'booking_records', 'invoices'],
  });

  await logSecurityAudit({
    actorId: userId,
    actorType: 'CUSTOMER',
    action: 'account_deletion.requested',
    targetType: 'account_deletion',
    targetId: request._id.toString(),
    metadata: { scheduledFor },
  });

  return formatDeletion(request);
}

export async function getAccountDeletionStatus(userId: string, requestId?: string) {
  const query = requestId ? { _id: requestId, userId } : { userId };
  const request = await AccountDeletionRequest.findOne(query).sort({ createdAt: -1 });
  if (!request) throw new AppError('Deletion request not found', 404, ErrorCode.NOT_FOUND);
  return formatDeletion(request);
}

export async function cancelAccountDeletion(userId: string): Promise<void> {
  const request = await AccountDeletionRequest.findOne({
    userId,
    status: { $in: [AccountDeletionStatus.REQUESTED, AccountDeletionStatus.SCHEDULED] },
  });
  if (!request) throw new AppError('No active deletion request', 404, ErrorCode.NOT_FOUND);
  request.status = AccountDeletionStatus.CANCELLED;
  await request.save();
}

export async function processScheduledDeletions(): Promise<number> {
  const due = await AccountDeletionRequest.find({
    status: AccountDeletionStatus.SCHEDULED,
    scheduledFor: { $lte: new Date() },
  });

  let count = 0;
  for (const req of due) {
    req.status = AccountDeletionStatus.PROCESSING;
    await req.save();

    const user = await User.findById(req.userId);
    if (user) {
      user.status = 'BLOCKED';
      user.fullName = 'Deleted User';
      user.phone = undefined;
      user.email = undefined;
      await user.save();
      await revokeOtherSessions(req.userId.toString());
    }

    req.status = AccountDeletionStatus.COMPLETED;
    req.completedAt = new Date();
    await req.save();
    count += 1;
  }
  return count;
}

export async function listDeletionRequestsAdmin(limit = 50) {
  const rows = await AccountDeletionRequest.find().sort({ createdAt: -1 }).limit(limit);
  return rows.map(formatDeletion);
}

function formatDeletion(req: InstanceType<typeof AccountDeletionRequest>) {
  return {
    id: req._id.toString(),
    userId: req.userId.toString(),
    status: req.status,
    reason: req.reason,
    scheduledFor: req.scheduledFor,
    completedAt: req.completedAt,
    retainedDataTypes: req.retainedDataTypes,
    createdAt: req.createdAt,
  };
}
