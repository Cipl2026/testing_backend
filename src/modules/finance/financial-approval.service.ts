import { ErrorCode, FinanceApprovalStatus, FinancialAdjustmentType } from '@ghaarfix/shared-types';
import { FinancialApproval } from '@/models/Finance.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';
import { AppError } from '@/utils/AppError.js';
import { createFinancialEvent } from '@/modules/finance/financial-ledger.service.js';
import {
  FinancialDirection,
  FinancialEventType,
  FinancialSourceType,
} from '@ghaarfix/shared-types';

const DEFAULT_THRESHOLD_MINOR = 50_000; // ₹500

export function getAdjustmentThresholdMinor(): number {
  return DEFAULT_THRESHOLD_MINOR;
}

export async function requestFinancialAdjustment(input: {
  type: FinancialAdjustmentType;
  amountMinor: number;
  reason: string;
  requestedBy: string;
  bookingId?: string;
  providerId?: string;
  idempotencyKey: string;
}) {
  const existing = await FinancialApproval.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;

  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new AppError('amountMinor must be a positive integer.', 400, ErrorCode.VALIDATION_ERROR);
  }

  return FinancialApproval.create({
    ...input,
    thresholdMinor: getAdjustmentThresholdMinor(),
    status: FinanceApprovalStatus.PENDING,
  });
}

export async function approveFinancialAdjustment(
  approvalId: string,
  reviewerId: string,
): Promise<typeof FinancialApproval.prototype> {
  const approval = await FinancialApproval.findById(approvalId);
  if (!approval) throw new AppError('Approval not found.', 404, ErrorCode.NOT_FOUND);
  if (approval.status !== FinanceApprovalStatus.PENDING) {
    throw new AppError('Approval is not pending.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (approval.requestedBy.toString() === reviewerId) {
    throw new AppError('Creator cannot approve their own financial action.', 403, ErrorCode.FORBIDDEN);
  }

  approval.status = FinanceApprovalStatus.APPROVED;
  approval.reviewedBy = reviewerId as never;
  await approval.save();

  await AdminAuditLog.create({
    adminId: reviewerId,
    action: 'FINANCE_ADJUSTMENT_APPROVED',
    entityType: 'FinancialApproval',
    entityId: approval._id,
    after: { status: approval.status, amountMinor: approval.amountMinor },
    reason: approval.reason,
  });

  return approval;
}

export async function rejectFinancialAdjustment(
  approvalId: string,
  reviewerId: string,
): Promise<typeof FinancialApproval.prototype> {
  const approval = await FinancialApproval.findById(approvalId);
  if (!approval) throw new AppError('Approval not found.', 404, ErrorCode.NOT_FOUND);
  if (approval.requestedBy.toString() === reviewerId) {
    throw new AppError('Creator cannot reject their own financial action.', 403, ErrorCode.FORBIDDEN);
  }

  approval.status = FinanceApprovalStatus.REJECTED;
  approval.reviewedBy = reviewerId as never;
  await approval.save();

  await AdminAuditLog.create({
    adminId: reviewerId,
    action: 'FINANCE_ADJUSTMENT_REJECTED',
    entityType: 'FinancialApproval',
    entityId: approval._id,
    reason: approval.reason,
  });

  return approval;
}

export async function executeApprovedAdjustment(approvalId: string, executorId: string) {
  const approval = await FinancialApproval.findById(approvalId);
  if (!approval) throw new AppError('Approval not found.', 404, ErrorCode.NOT_FOUND);
  if (approval.status !== FinanceApprovalStatus.APPROVED) {
    throw new AppError('Approval must be approved before execution.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const direction =
    approval.type === FinancialAdjustmentType.CREDIT
      ? FinancialDirection.INFLOW
      : FinancialDirection.OUTFLOW;

  await createFinancialEvent({
    eventType: FinancialEventType.ADJUSTMENT,
    sourceType: FinancialSourceType.ADJUSTMENT,
    sourceId: approval._id,
    bookingId: approval.bookingId,
    providerId: approval.providerId,
    amountMinor: approval.amountMinor,
    direction,
    idempotencyKey: `adjustment-exec:${approval.idempotencyKey}`,
    metadata: { approvalId: approval._id.toString(), reason: approval.reason },
  });

  approval.status = FinanceApprovalStatus.EXECUTED;
  await approval.save();

  await AdminAuditLog.create({
    adminId: executorId,
    action: 'FINANCE_ADJUSTMENT_EXECUTED',
    entityType: 'FinancialApproval',
    entityId: approval._id,
    after: { amountMinor: approval.amountMinor },
    reason: approval.reason,
  });

  return approval;
}
