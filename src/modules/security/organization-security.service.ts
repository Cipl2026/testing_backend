import { OrganizationMember } from '@/models/Organization.js';
import { OrganizationSecurityPolicy, SecurityEvent } from '@/models/Security.js';
import { OrganizationMemberStatus, OrganizationPermission } from '@ghaarfix/shared-types';
import { assertOrganizationPermission } from '@/modules/organizations/organization-authorization.service.js';
import { isSecurityComplianceEnabled } from '@/modules/security/security-feature.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function getOrganizationSecurity(organizationId: string, userId: string) {
  if (!(await isSecurityComplianceEnabled())) {
    throw new AppError('Security compliance is disabled.', 403, ErrorCode.FORBIDDEN);
  }
  await assertOrganizationPermission(
    organizationId,
    userId,
    OrganizationPermission.MANAGE_SETTINGS,
  );

  const [policy, memberCount, activeSessions] = await Promise.all([
    OrganizationSecurityPolicy.findOne({ organizationId }),
    OrganizationMember.countDocuments({
      organizationId,
      status: OrganizationMemberStatus.ACTIVE,
    }),
    OrganizationMember.find({ organizationId, status: OrganizationMemberStatus.ACTIVE }).select(
      'userId',
    ),
  ]);

  const memberUserIds = activeSessions.map((m) => m.userId);
  const recentEvents = await SecurityEvent.find({
    actorId: { $in: memberUserIds },
  })
    .sort({ createdAt: -1 })
    .limit(20);

  return {
    policy: policy
      ? {
          requireMfaForAdmins: policy.requireMfaForAdmins,
          sessionTimeoutMinutes: policy.sessionTimeoutMinutes,
          allowedDomains: policy.allowedDomains,
          updatedAt: policy.updatedAt,
        }
      : {
          requireMfaForAdmins: false,
          sessionTimeoutMinutes: 480,
          allowedDomains: [],
        },
    memberCount,
    recentEvents: recentEvents.map((e) => ({
      id: e._id.toString(),
      type: e.type,
      severity: e.severity,
      status: e.status,
      createdAt: e.createdAt,
    })),
  };
}

export async function getOrganizationSecurityEvents(organizationId: string, userId: string) {
  if (!(await isSecurityComplianceEnabled())) {
    throw new AppError('Security compliance is disabled.', 403, ErrorCode.FORBIDDEN);
  }
  await assertOrganizationPermission(
    organizationId,
    userId,
    OrganizationPermission.MANAGE_SETTINGS,
  );

  const members = await OrganizationMember.find({
    organizationId,
    status: OrganizationMemberStatus.ACTIVE,
  }).select('userId');

  const memberUserIds = members.map((m) => m.userId);
  const events = await SecurityEvent.find({ actorId: { $in: memberUserIds } })
    .sort({ createdAt: -1 })
    .limit(50);

  return events.map((e) => ({
    id: e._id.toString(),
    type: e.type,
    severity: e.severity,
    actorId: e.actorId?.toString(),
    status: e.status,
    metadata: e.metadata,
    createdAt: e.createdAt,
  }));
}
