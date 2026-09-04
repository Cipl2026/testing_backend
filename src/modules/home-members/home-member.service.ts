import { randomBytes } from 'node:crypto';
import {
  ErrorCode,
  HomeCapability,
  HomeInvitationStatus,
  HomeMemberActivityType,
  HomeMemberRole,
  HomeMemberStatus,
} from '@ghaarfix/shared-types';
import { Home } from '@/models/Home.js';
import { HomeMember } from '@/models/HomeMember.js';
import { HomeMemberActivity } from '@/models/HomeMemberActivity.js';
import { HomeMemberInvitation } from '@/models/HomeMemberInvitation.js';
import { User } from '@/models/User.js';
import {
  assertHomeCapability,
  capabilitiesForRole,
  getActiveHomeMembership,
} from '@/modules/home-members/home-permission.service.js';
import { createNotification } from '@/modules/notifications/notification.service.js';
import { AppError } from '@/utils/AppError.js';
import { hashToken } from '@/utils/crypto.js';

const INVITATION_TTL_DAYS = 7;

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPhone(phone: string): string {
  return hashToken(normalizePhone(phone));
}

export async function ensureOwnerMembership(homeId: string, customerId: string, invitedBy?: string) {
  const existing = await HomeMember.findOne({ homeId, customerId });
  if (existing) {
    if (existing.status !== HomeMemberStatus.ACTIVE && existing.role === HomeMemberRole.OWNER) {
      existing.status = HomeMemberStatus.ACTIVE;
      await existing.save();
    }
    return existing;
  }
  return HomeMember.create({
    homeId,
    customerId,
    role: HomeMemberRole.OWNER,
    status: HomeMemberStatus.ACTIVE,
    invitedBy,
    joinedAt: new Date(),
  });
}

export async function listHomeMembers(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_VIEW);
  const members = await HomeMember.find({
    homeId,
    status: { $in: [HomeMemberStatus.ACTIVE, HomeMemberStatus.INVITED] },
  }).sort({ createdAt: 1 });

  const result = [];
  for (const member of members) {
    const user = await User.findById(member.customerId).select('fullName');
    result.push({
      id: member._id.toString(),
      customerId: member.customerId.toString(),
      name: user?.fullName ?? 'Member',
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt?.toISOString(),
      capabilities: capabilitiesForRole(member.role),
    });
  }
  return result;
}

export async function inviteHomeMember(
  customerId: string,
  homeId: string,
  input: { phone?: string; email?: string; role: HomeMemberRole },
) {
  if (input.role === HomeMemberRole.OWNER) {
    throw new AppError('Cannot invite as owner.', 400, ErrorCode.VALIDATION_ERROR);
  }
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_MEMBER_INVITE);
  if (!input.phone && !input.email) {
    throw new AppError('Phone or email is required.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await HomeMemberInvitation.updateMany(
    {
      homeId,
      status: HomeInvitationStatus.PENDING,
      ...(input.phone ? { phoneHash: hashPhone(input.phone) } : {}),
      ...(input.email ? { emailNormalized: normalizeEmail(input.email) } : {}),
    },
    { $set: { status: HomeInvitationStatus.REVOKED, revokedAt: new Date() } },
  );

  const invitation = await HomeMemberInvitation.create({
    homeId,
    invitedBy: customerId,
    phoneHash: input.phone ? hashPhone(input.phone) : undefined,
    emailNormalized: input.email ? normalizeEmail(input.email) : undefined,
    role: input.role,
    tokenHash: hashToken(token),
    status: HomeInvitationStatus.PENDING,
    expiresAt,
  });

  await HomeMemberActivity.create({
    homeId,
    actorId: customerId,
    type: HomeMemberActivityType.MEMBER_INVITED,
    metadata: { role: input.role, invitationId: invitation._id.toString() },
  });

  const targetUser = input.phone
    ? await User.findOne({ phone: normalizePhone(input.phone) })
    : input.email
      ? await User.findOne({ email: normalizeEmail(input.email) })
      : null;

  if (targetUser) {
    await createNotification({
      userId: targetUser._id.toString(),
      type: 'HOME_INVITATION',
      title: 'Home invitation',
      body: 'You have been invited to manage a shared home.',
      data: { invitationId: invitation._id.toString(), homeId },
    });
  }

  return {
    invitationId: invitation._id.toString(),
    role: input.role,
    expiresAt: expiresAt.toISOString(),
    message: 'If this person has a GhaarFix account, they will receive an invitation.',
  };
}

export async function acceptHomeInvitation(
  customerId: string,
  invitationId: string,
  token?: string,
) {
  const invitation = await HomeMemberInvitation.findById(invitationId);
  if (!invitation || invitation.status !== HomeInvitationStatus.PENDING) {
    throw new AppError('Invitation not found.', 404, ErrorCode.NOT_FOUND);
  }
  if (invitation.expiresAt <= new Date()) {
    invitation.status = HomeInvitationStatus.EXPIRED;
    await invitation.save();
    throw new AppError('Invitation has expired.', 410, ErrorCode.CONFLICT);
  }

  const user = await User.findById(customerId);
  if (!user) throw new AppError('User not found.', 404, ErrorCode.NOT_FOUND);

  if (token) {
    if (invitation.tokenHash !== hashToken(token)) {
      throw new AppError('Invalid invitation token.', 403, ErrorCode.FORBIDDEN);
    }
  }

  const phoneMatch =
    Boolean(invitation.phoneHash && user.phone && hashPhone(user.phone) === invitation.phoneHash);
  const emailMatch =
    Boolean(
      invitation.emailNormalized &&
        user.email &&
        normalizeEmail(user.email) === invitation.emailNormalized,
    );

  if (!token && !phoneMatch && !emailMatch) {
    throw new AppError('This invitation is not for your account.', 403, ErrorCode.FORBIDDEN);
  }
  if (token) {
    if (invitation.phoneHash && user.phone && hashPhone(user.phone) !== invitation.phoneHash) {
      throw new AppError('Invitation not found.', 404, ErrorCode.NOT_FOUND);
    }
    if (
      invitation.emailNormalized &&
      user.email &&
      normalizeEmail(user.email) !== invitation.emailNormalized
    ) {
      throw new AppError('Invitation not found.', 404, ErrorCode.NOT_FOUND);
    }
  }

  const member = await HomeMember.findOneAndUpdate(
    { homeId: invitation.homeId, customerId },
    {
      $set: {
        role: invitation.role,
        status: HomeMemberStatus.ACTIVE,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );

  invitation.status = HomeInvitationStatus.ACCEPTED;
  invitation.acceptedAt = new Date();
  await invitation.save();

  await HomeMemberActivity.create({
    homeId: invitation.homeId,
    actorId: customerId,
    type: HomeMemberActivityType.INVITATION_ACCEPTED,
    targetCustomerId: customerId,
    metadata: { role: invitation.role },
  });

  return { homeId: invitation.homeId.toString(), memberId: member._id.toString(), role: member.role };
}

export async function rejectHomeInvitation(_customerId: string, invitationId: string) {
  const invitation = await HomeMemberInvitation.findById(invitationId);
  if (!invitation || invitation.status !== HomeInvitationStatus.PENDING) {
    throw new AppError('Invitation not found.', 404, ErrorCode.NOT_FOUND);
  }
  invitation.status = HomeInvitationStatus.REJECTED;
  invitation.revokedAt = new Date();
  await invitation.save();
  return { invitationId, status: invitation.status };
}

export async function listPendingInvitationsForUser(customerId: string) {
  const user = await User.findById(customerId);
  if (!user) return [];

  const or: Array<Record<string, string>> = [];
  if (user.phone) or.push({ phoneHash: hashPhone(user.phone) });
  if (user.email) or.push({ emailNormalized: normalizeEmail(user.email) });
  if (!or.length) return [];

  const invitations = await HomeMemberInvitation.find({
    status: HomeInvitationStatus.PENDING,
    expiresAt: { $gt: new Date() },
    $or: or,
  }).sort({ createdAt: -1 });

  const results = [];
  for (const invitation of invitations) {
    const home = await Home.findById(invitation.homeId).select('name');
    const inviter = await User.findById(invitation.invitedBy).select('fullName');
    results.push({
      id: invitation._id.toString(),
      homeId: invitation.homeId.toString(),
      homeName: home?.name ?? 'Shared home',
      role: invitation.role,
      invitedByName: inviter?.fullName ?? 'Someone',
      expiresAt: invitation.expiresAt.toISOString(),
    });
  }
  return results;
}

export async function updateHomeMember(
  customerId: string,
  homeId: string,
  memberId: string,
  input: { role?: HomeMemberRole },
) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_MEMBER_INVITE);
  const member = await HomeMember.findOne({ _id: memberId, homeId, status: HomeMemberStatus.ACTIVE });
  if (!member) throw new AppError('Member not found.', 404, ErrorCode.NOT_FOUND);
  if (member.role === HomeMemberRole.OWNER) {
    throw new AppError('Cannot change owner role here.', 403, ErrorCode.FORBIDDEN);
  }
  if (input.role === HomeMemberRole.OWNER) {
    throw new AppError('Use ownership transfer to assign owner.', 400, ErrorCode.VALIDATION_ERROR);
  }
  const previousRole = member.role;
  if (input.role) member.role = input.role;
  await member.save();

  await HomeMemberActivity.create({
    homeId,
    actorId: customerId,
    type: HomeMemberActivityType.ROLE_CHANGED,
    targetCustomerId: member.customerId,
    metadata: { from: previousRole, to: member.role },
  });

  return { id: member._id.toString(), role: member.role };
}

export async function removeHomeMember(customerId: string, homeId: string, memberId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_MEMBER_REMOVE);
  const member = await HomeMember.findOne({ _id: memberId, homeId, status: HomeMemberStatus.ACTIVE });
  if (!member) throw new AppError('Member not found.', 404, ErrorCode.NOT_FOUND);

  if (member.role === HomeMemberRole.OWNER) {
    const ownerCount = await HomeMember.countDocuments({
      homeId,
      role: HomeMemberRole.OWNER,
      status: HomeMemberStatus.ACTIVE,
    });
    if (ownerCount <= 1) {
      throw new AppError('Cannot remove the last owner.', 409, ErrorCode.CONFLICT);
    }
  }

  const actor = await getActiveHomeMembership(homeId, customerId);
  if (member.role === HomeMemberRole.OWNER && actor?.role !== HomeMemberRole.OWNER) {
    throw new AppError('Only owners can remove another owner.', 403, ErrorCode.FORBIDDEN);
  }
  if (member.role === HomeMemberRole.ADMIN && actor?.role === HomeMemberRole.ADMIN && member.customerId.toString() !== customerId) {
    throw new AppError('Admins cannot remove other admins.', 403, ErrorCode.FORBIDDEN);
  }

  member.status = HomeMemberStatus.REMOVED;
  await member.save();

  await HomeMemberActivity.create({
    homeId,
    actorId: customerId,
    type: HomeMemberActivityType.MEMBER_REMOVED,
    targetCustomerId: member.customerId,
  });

  return { id: member._id.toString(), status: member.status };
}

export async function listHomeMemberActivity(customerId: string, homeId: string) {
  await assertHomeCapability(customerId, homeId, HomeCapability.HOME_MEMBER_INVITE);
  const items = await HomeMemberActivity.find({ homeId }).sort({ createdAt: -1 }).limit(50);
  return items.map((a) => ({
    id: a._id.toString(),
    type: a.type,
    actorId: a.actorId.toString(),
    targetCustomerId: a.targetCustomerId?.toString(),
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function expirePendingInvitations(): Promise<number> {
  const now = new Date();
  const result = await HomeMemberInvitation.updateMany(
    { status: HomeInvitationStatus.PENDING, expiresAt: { $lte: now } },
    { $set: { status: HomeInvitationStatus.EXPIRED } },
  );
  return result.modifiedCount ?? 0;
}

export async function backfillHomeOwners(): Promise<number> {
  const homes = await Home.find({ isArchived: false });
  let count = 0;
  for (const home of homes) {
    const exists = await HomeMember.findOne({
      homeId: home._id,
      customerId: home.customerId,
      status: HomeMemberStatus.ACTIVE,
    });
    if (!exists) {
      await ensureOwnerMembership(home._id.toString(), home.customerId.toString());
      count += 1;
    }
  }
  return count;
}
