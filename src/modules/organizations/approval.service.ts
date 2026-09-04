import {
  ApprovalRequestStatus,
  ApprovalResourceType,
  ApprovalTriggerType,
  ErrorCode,
  OrganizationPermission,
} from '@ghaarfix/shared-types';
import { ApprovalPolicy, ApprovalRequest } from '@/models/OrganizationOperations.js';
import {
  assertOrganizationPermission,
  memberHasPermission,
  getActiveOrganizationMembership,
} from '@/modules/organizations/organization-authorization.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { Organization } from '@/models/Organization.js';
import { AppError } from '@/utils/AppError.js';

export async function evaluateBookingApproval(input: {
  organizationId: string;
  estimatedAmount: number;
  categoryId?: string;
  isUrgent?: boolean;
}) {
  const org = await Organization.findById(input.organizationId);
  if (!org) return { required: false, autoApproved: true };

  const policies = await ApprovalPolicy.find({
    organizationId: input.organizationId,
    isActive: true,
    triggerType: { $in: [ApprovalTriggerType.BOOKING_AMOUNT, ApprovalTriggerType.EMERGENCY] },
  });

  for (const policy of policies) {
    if (policy.triggerType === ApprovalTriggerType.EMERGENCY && input.isUrgent) {
      if (org.settings.allowUrgentBypass) {
        return { required: false, autoApproved: true, bypassReason: 'Emergency bypass allowed by policy' };
      }
    }
    if (policy.triggerType === ApprovalTriggerType.BOOKING_AMOUNT) {
      const threshold =
        (policy.conditions.amountThreshold as number) ??
        org.settings.approvalAmountThreshold ??
        Number.MAX_SAFE_INTEGER;
      if (input.estimatedAmount > threshold) {
        return { required: true, autoApproved: false, policyId: policy._id.toString() };
      }
    }
  }

  if (org.settings.requireBookingApproval && org.settings.approvalAmountThreshold != null) {
    if (input.estimatedAmount > org.settings.approvalAmountThreshold) {
      return { required: true, autoApproved: false };
    }
  }

  return { required: false, autoApproved: true };
}

export async function createApprovalRequest(input: {
  organizationId: string;
  resourceType: ApprovalResourceType;
  resourceId: string;
  requestedBy: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await ApprovalRequest.findOne({
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    status: ApprovalRequestStatus.PENDING,
  });
  if (existing) return existing;

  return ApprovalRequest.create({
    organizationId: input.organizationId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestedBy: input.requestedBy,
    status: ApprovalRequestStatus.PENDING,
    metadata: input.metadata,
  });
}

export async function listApprovals(userId: string, organizationId: string) {
  await assertOrganizationPermission(organizationId, userId, OrganizationPermission.APPROVE_BOOKING);
  const items = await ApprovalRequest.find({ organizationId }).sort({ createdAt: -1 }).limit(100);
  return items.map((a) => ({
    id: a._id.toString(),
    resourceType: a.resourceType,
    resourceId: a.resourceId,
    status: a.status,
    requestedBy: a.requestedBy.toString(),
    createdAt: a.createdAt,
    metadata: a.metadata,
  }));
}

export async function approveRequest(userId: string, approvalId: string, reason?: string) {
  const approval = await ApprovalRequest.findById(approvalId);
  if (!approval) throw new AppError('Approval not found.', 404, ErrorCode.NOT_FOUND);
  if (approval.status !== ApprovalRequestStatus.PENDING) {
    throw new AppError('Approval already resolved.', 409, ErrorCode.CONFLICT);
  }

  const member = await getActiveOrganizationMembership(
    approval.organizationId.toString(),
    userId,
  );
  if (!member || !memberHasPermission(member, OrganizationPermission.APPROVE_BOOKING)) {
    throw new AppError('Not authorized to approve.', 403, ErrorCode.FORBIDDEN);
  }

  const updated = await ApprovalRequest.findOneAndUpdate(
    { _id: approvalId, status: ApprovalRequestStatus.PENDING },
    {
      status: ApprovalRequestStatus.APPROVED,
      approvedBy: userId,
      reason,
      resolvedAt: new Date(),
    },
    { new: true },
  );
  if (!updated) throw new AppError('Approval race — already resolved.', 409, ErrorCode.CONFLICT);

  await logOrganizationAudit({
    organizationId: approval.organizationId.toString(),
    actorId: userId,
    action: 'APPROVAL_APPROVED',
    resourceType: 'ApprovalRequest',
    resourceId: approvalId,
    reason,
  });

  if (
    updated.resourceType === ApprovalResourceType.BOOKING &&
    updated.metadata &&
    typeof updated.metadata === 'object' &&
    'reservationId' in updated.metadata
  ) {
    const { finalizeOrganizationBookingAfterApproval } = await import(
      '@/modules/organizations/organization-booking.service.js'
    );
    const result = await finalizeOrganizationBookingAfterApproval(
      updated.requestedBy.toString(),
      updated,
    );
    await ApprovalRequest.findByIdAndUpdate(updated._id, {
      resourceId: result.bookingId,
      metadata: { ...updated.metadata, bookingId: result.bookingId, workOrderId: result.workOrderId },
    });
  }

  return updated;
}

export async function rejectRequest(userId: string, approvalId: string, reason: string) {
  const approval = await ApprovalRequest.findById(approvalId);
  if (!approval) throw new AppError('Approval not found.', 404, ErrorCode.NOT_FOUND);

  const member = await getActiveOrganizationMembership(
    approval.organizationId.toString(),
    userId,
  );
  if (!member || !memberHasPermission(member, OrganizationPermission.APPROVE_BOOKING)) {
    throw new AppError('Not authorized to reject.', 403, ErrorCode.FORBIDDEN);
  }

  const updated = await ApprovalRequest.findOneAndUpdate(
    { _id: approvalId, status: ApprovalRequestStatus.PENDING },
    {
      status: ApprovalRequestStatus.REJECTED,
      approvedBy: userId,
      reason,
      resolvedAt: new Date(),
    },
    { new: true },
  );
  if (!updated) throw new AppError('Approval race — already resolved.', 409, ErrorCode.CONFLICT);

  await logOrganizationAudit({
    organizationId: approval.organizationId.toString(),
    actorId: userId,
    action: 'APPROVAL_REJECTED',
    resourceType: 'ApprovalRequest',
    resourceId: approvalId,
    reason,
  });

  return updated;
}
