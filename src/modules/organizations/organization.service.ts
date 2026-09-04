import {
  ErrorCode,
  OrganizationMemberRole,
  OrganizationMemberStatus,
  OrganizationPermission,
  OrganizationStatus,
  OrganizationType,
} from '@ghaarfix/shared-types';
import { Organization, OrganizationMember } from '@/models/Organization.js';
import { permissionsForRole } from '@/modules/organizations/organization-authorization.service.js';
import { logOrganizationAudit } from '@/modules/organizations/organization-audit.service.js';
import { slugify } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';

function serializeOrg(org: InstanceType<typeof Organization>) {
  return {
    id: org._id.toString(),
    name: org.name,
    slug: org.slug,
    type: org.type,
    status: org.status,
    billingProfile: org.billingProfile,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

export async function createOrganization(
  userId: string,
  input: { name: string; type: OrganizationType },
) {
  const slug = slugify(input.name);
  const existing = await Organization.findOne({ slug });
  if (existing) throw new AppError('Organization slug already exists.', 409, ErrorCode.CONFLICT);

  const org = await Organization.create({
    name: input.name,
    slug,
    type: input.type,
    status: OrganizationStatus.ACTIVE,
  });

  await OrganizationMember.create({
    organizationId: org._id,
    userId,
    role: OrganizationMemberRole.OWNER,
    permissions: permissionsForRole(OrganizationMemberRole.OWNER),
    status: OrganizationMemberStatus.ACTIVE,
    joinedAt: new Date(),
  });

  await logOrganizationAudit({
    organizationId: org._id.toString(),
    actorId: userId,
    action: 'ORGANIZATION_CREATED',
    resourceType: 'Organization',
    resourceId: org._id.toString(),
    after: { name: org.name, type: org.type },
  });

  return serializeOrg(org);
}

export async function listMyOrganizations(userId: string) {
  const memberships = await OrganizationMember.find({
    userId,
    status: OrganizationMemberStatus.ACTIVE,
  });
  const orgs = await Organization.find({
    _id: { $in: memberships.map((m) => m.organizationId) },
    status: { $ne: OrganizationStatus.ARCHIVED },
  });
  return orgs.map((o) => {
    const member = memberships.find((m) => m.organizationId.toString() === o._id.toString());
    return { ...serializeOrg(o), role: member?.role };
  });
}

export async function getOrganization(userId: string, organizationId: string) {
  const member = await OrganizationMember.findOne({
    organizationId,
    userId,
    status: OrganizationMemberStatus.ACTIVE,
  });
  if (!member) throw new AppError('Organization not found.', 404, ErrorCode.NOT_FOUND);
  const org = await Organization.findById(organizationId);
  if (!org) throw new AppError('Organization not found.', 404, ErrorCode.NOT_FOUND);
  return { ...serializeOrg(org), role: member.role, permissions: member.permissions };
}

export async function updateOrganization(
  userId: string,
  organizationId: string,
  input: Partial<{ name: string; settings: Record<string, unknown> }>,
) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  await assertOrganizationPermission(
    organizationId,
    userId,
    OrganizationPermission.MANAGE_SETTINGS,
  );
  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $set: input },
    { new: true },
  );
  if (!org) throw new AppError('Organization not found.', 404, ErrorCode.NOT_FOUND);
  await logOrganizationAudit({
    organizationId,
    actorId: userId,
    action: 'ORGANIZATION_UPDATED',
    resourceType: 'Organization',
    resourceId: organizationId,
    after: input as Record<string, unknown>,
  });
  return serializeOrg(org);
}

export async function inviteMember(
  actorId: string,
  organizationId: string,
  input: { userId: string; role: OrganizationMemberRole },
) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  await assertOrganizationPermission(organizationId, actorId, OrganizationPermission.MANAGE_MEMBERS);

  const member = await OrganizationMember.findOneAndUpdate(
    { organizationId, userId: input.userId },
    {
      role: input.role,
      permissions: permissionsForRole(input.role),
      status: OrganizationMemberStatus.INVITED,
      invitedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  await logOrganizationAudit({
    organizationId,
    actorId,
    action: 'MEMBER_INVITED',
    resourceType: 'OrganizationMember',
    resourceId: member._id.toString(),
    after: { userId: input.userId, role: input.role },
  });

  return {
    id: member._id.toString(),
    userId: member.userId.toString(),
    role: member.role,
    status: member.status,
  };
}

export async function activateMemberInvite(userId: string, organizationId: string) {
  const member = await OrganizationMember.findOneAndUpdate(
    { organizationId, userId, status: OrganizationMemberStatus.INVITED },
    { status: OrganizationMemberStatus.ACTIVE, joinedAt: new Date() },
    { new: true },
  );
  return member;
}

export async function listMembers(actorId: string, organizationId: string) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  await assertOrganizationPermission(organizationId, actorId, OrganizationPermission.MANAGE_MEMBERS);

  const members = await OrganizationMember.find({
    organizationId,
    status: { $ne: OrganizationMemberStatus.REMOVED },
  });
  return members.map((m) => ({
    id: m._id.toString(),
    userId: m.userId.toString(),
    role: m.role,
    status: m.status,
    permissions: m.permissions,
    joinedAt: m.joinedAt,
  }));
}

export async function updateMember(
  actorId: string,
  organizationId: string,
  memberId: string,
  input: { role?: OrganizationMemberRole; status?: OrganizationMemberStatus },
) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  await assertOrganizationPermission(organizationId, actorId, OrganizationPermission.MANAGE_MEMBERS);

  const member = await OrganizationMember.findOne({ _id: memberId, organizationId });
  if (!member) throw new AppError('Member not found.', 404, ErrorCode.NOT_FOUND);

  if (input.role) {
    member.role = input.role;
    member.permissions = permissionsForRole(input.role);
  }
  if (input.status) member.status = input.status;
  await member.save();

  await logOrganizationAudit({
    organizationId,
    actorId,
    action: 'MEMBER_UPDATED',
    resourceType: 'OrganizationMember',
    resourceId: memberId,
    after: input as Record<string, unknown>,
  });

  return {
    id: member._id.toString(),
    userId: member.userId.toString(),
    role: member.role,
    status: member.status,
  };
}

export async function removeMember(actorId: string, organizationId: string, memberId: string) {
  const { assertOrganizationPermission } = await import(
    '@/modules/organizations/organization-authorization.service.js'
  );
  await assertOrganizationPermission(organizationId, actorId, OrganizationPermission.MANAGE_MEMBERS);

  const member = await OrganizationMember.findOneAndUpdate(
    { _id: memberId, organizationId },
    { status: OrganizationMemberStatus.REMOVED },
    { new: true },
  );
  if (!member) throw new AppError('Member not found.', 404, ErrorCode.NOT_FOUND);

  await logOrganizationAudit({
    organizationId,
    actorId,
    action: 'MEMBER_REMOVED',
    resourceType: 'OrganizationMember',
    resourceId: memberId,
  });

  return { id: member._id.toString(), status: member.status };
}
