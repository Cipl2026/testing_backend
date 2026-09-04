import { ImprovementPlanStatus } from '@ghaarfix/shared-types';
import { ProviderQualityImprovementPlan } from '@/models/TrustProtection.js';
import { AdminAuditLog } from '@/models/AdminAuditLog.js';

export async function createImprovementPlan(
  adminId: string,
  providerId: string,
  input: { issues: string[]; actions: string[]; deadline: Date; reviewNotes?: string },
) {
  const plan = await ProviderQualityImprovementPlan.create({
    providerId,
    issues: input.issues,
    actions: input.actions,
    deadline: input.deadline,
    reviewNotes: input.reviewNotes,
    status: ImprovementPlanStatus.ACTIVE,
    createdBy: adminId,
  });

  await AdminAuditLog.create({
    adminId,
    action: 'IMPROVEMENT_PLAN_CREATED',
    entityType: 'ProviderQualityImprovementPlan',
    entityId: plan._id,
    after: { issues: input.issues, actions: input.actions },
    reason: input.reviewNotes ?? 'Quality improvement plan',
  });

  return plan;
}

export async function getActiveImprovementPlan(providerId: string) {
  return ProviderQualityImprovementPlan.findOne({
    providerId,
    status: ImprovementPlanStatus.ACTIVE,
  }).sort({ createdAt: -1 });
}

export async function updateImprovementPlanStatus(
  planId: string,
  adminId: string,
  status: ImprovementPlanStatus,
  reviewNotes?: string,
) {
  const plan = await ProviderQualityImprovementPlan.findByIdAndUpdate(
    planId,
    { $set: { status, reviewNotes } },
    { new: true },
  );

  if (plan) {
    await AdminAuditLog.create({
      adminId,
      action: 'IMPROVEMENT_PLAN_UPDATE',
      entityType: 'ProviderQualityImprovementPlan',
      entityId: plan._id,
      after: { status },
      reason: reviewNotes ?? 'Plan status update',
    });
  }

  return plan;
}
