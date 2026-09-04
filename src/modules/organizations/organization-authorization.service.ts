import {
  ErrorCode,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  OrganizationPermission,
} from '@ghaarfix/shared-types';
import { OrganizationMember } from '@/models/Organization.js';
import { ManagedProperty } from '@/models/ManagedProperty.js';
import { AppError } from '@/utils/AppError.js';

const ROLE_PERMISSIONS: Record<OrganizationMemberRole, OrganizationPermission[]> = {
  [OrganizationMemberRole.OWNER]: Object.values(OrganizationPermission),
  [OrganizationMemberRole.ADMIN]: [
    OrganizationPermission.MANAGE_PROPERTIES,
    OrganizationPermission.CREATE_BOOKING,
    OrganizationPermission.APPROVE_BOOKING,
    OrganizationPermission.VIEW_FINANCE,
    OrganizationPermission.MANAGE_MEMBERS,
    OrganizationPermission.MANAGE_BILLING,
    OrganizationPermission.VIEW_ANALYTICS,
    OrganizationPermission.MANAGE_SETTINGS,
  ],
  [OrganizationMemberRole.PROPERTY_MANAGER]: [
    OrganizationPermission.MANAGE_PROPERTIES,
    OrganizationPermission.CREATE_BOOKING,
    OrganizationPermission.VIEW_ANALYTICS,
  ],
  [OrganizationMemberRole.FINANCE]: [
    OrganizationPermission.VIEW_FINANCE,
    OrganizationPermission.MANAGE_BILLING,
    OrganizationPermission.APPROVE_BOOKING,
    OrganizationPermission.VIEW_ANALYTICS,
  ],
  [OrganizationMemberRole.OPERATIONS]: [
    OrganizationPermission.CREATE_BOOKING,
    OrganizationPermission.APPROVE_BOOKING,
    OrganizationPermission.VIEW_ANALYTICS,
  ],
  [OrganizationMemberRole.VIEWER]: [OrganizationPermission.VIEW_ANALYTICS],
};

export function permissionsForRole(role: OrganizationMemberRole): OrganizationPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function memberHasPermission(
  member: { role: OrganizationMemberRole; permissions: OrganizationPermission[] },
  permission: OrganizationPermission,
): boolean {
  if (member.permissions.includes(permission)) return true;
  return ROLE_PERMISSIONS[member.role].includes(permission);
}

export async function getActiveOrganizationMembership(organizationId: string, userId: string) {
  return OrganizationMember.findOne({
    organizationId,
    userId,
    status: OrganizationMemberStatus.ACTIVE,
  });
}

export async function assertOrganizationPermission(
  organizationId: string,
  userId: string,
  permission: OrganizationPermission,
) {
  const member = await getActiveOrganizationMembership(organizationId, userId);
  if (!member) {
    throw new AppError('You are not a member of this organization.', 403, ErrorCode.FORBIDDEN);
  }
  if (!memberHasPermission(member, permission)) {
    throw new AppError('You do not have permission for this action.', 403, ErrorCode.FORBIDDEN);
  }
  return member;
}

export async function assertPropertyInOrganization(organizationId: string, propertyId: string) {
  const property = await ManagedProperty.findOne({ _id: propertyId, organizationId });
  if (!property) {
    throw new AppError('Property not found in this organization.', 404, ErrorCode.NOT_FOUND);
  }
  return property;
}

export async function assertOrganizationScope(
  organizationId: string,
  userId: string,
  permission: OrganizationPermission,
) {
  await assertOrganizationPermission(organizationId, userId, permission);
  return organizationId;
}
