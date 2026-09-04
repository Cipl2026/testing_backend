import { createHash } from 'node:crypto';
import { UserRole } from '@ghaarfix/shared-types';
import { Session } from '@/models/Security.js';
import { RefreshToken } from '@/models/RefreshToken.js';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';
import { recordSecurityEvent } from '@/modules/security/security-event.service.js';
import { SecurityEventSeverity, SecurityEventType } from '@ghaarfix/shared-types';

export interface SessionContext {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  ip?: string;
  userAgent?: string;
}

export function hashClientValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export async function createSession(
  userId: string,
  userType: UserRole,
  familyId: string,
  context?: SessionContext,
): Promise<string> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    userId,
    userType,
    deviceId: context?.deviceId,
    deviceName: context?.deviceName,
    platform: context?.platform,
    appVersion: context?.appVersion,
    ipHash: context?.ip ? hashClientValue(context.ip) : undefined,
    userAgentHash: context?.userAgent ? hashClientValue(context.userAgent) : undefined,
    refreshFamilyId: familyId,
    lastSeenAt: new Date(),
    expiresAt,
  });

  await logSecurityAudit({
    actorId: userId,
    actorType: userType,
    action: 'session.created',
    targetType: 'session',
    targetId: session._id.toString(),
    ipHash: context?.ip ? hashClientValue(context.ip) : undefined,
    sessionId: session._id.toString(),
  });

  return session._id.toString();
}

export async function touchSession(sessionId: string): Promise<void> {
  await Session.updateOne({ _id: sessionId, revokedAt: null }, { lastSeenAt: new Date() });
}

export async function listUserSessions(userId: string) {
  const sessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ lastSeenAt: -1 });

  return sessions.map((s) => ({
    id: s._id.toString(),
    deviceName: s.deviceName ?? 'Unknown device',
    platform: s.platform ?? 'unknown',
    appVersion: s.appVersion,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    isCurrent: false,
  }));
}

export async function revokeSession(
  userId: string,
  sessionId: string,
  reason = 'user_revoked',
): Promise<boolean> {
  const session = await Session.findOne({ _id: sessionId, userId, revokedAt: null });
  if (!session) return false;

  session.revokedAt = new Date();
  session.revokeReason = reason;
  await session.save();

  await RefreshToken.updateMany(
    { userId, familyId: session.refreshFamilyId, isRevoked: false },
    { isRevoked: true },
  );

  await logSecurityAudit({
    actorId: userId,
    actorType: session.userType,
    action: 'session.revoked',
    targetType: 'session',
    targetId: sessionId,
    metadata: { reason },
    sessionId,
  });

  return true;
}

export async function revokeOtherSessions(userId: string, currentSessionId?: string): Promise<number> {
  const query: Record<string, unknown> = { userId, revokedAt: null };
  if (currentSessionId) query._id = { $ne: currentSessionId };

  const sessions = await Session.find(query);
  let count = 0;
  for (const session of sessions) {
    await revokeSession(userId, session._id.toString(), 'revoke_others');
    count += 1;
  }
  return count;
}

export async function revokeSessionFamily(familyId: string, reason: string): Promise<void> {
  await Session.updateMany(
    { refreshFamilyId: familyId, revokedAt: null },
    { revokedAt: new Date(), revokeReason: reason },
  );
  await RefreshToken.updateMany({ familyId, isRevoked: false }, { isRevoked: true });
}

export async function handleTokenReuse(
  userId: string,
  familyId: string,
  ip?: string,
): Promise<void> {
  await revokeSessionFamily(familyId, 'token_reuse_detected');
  await recordSecurityEvent({
    type: SecurityEventType.TOKEN_REUSE,
    severity: SecurityEventSeverity.CRITICAL,
    actorId: userId,
    sourceIpHash: ip ? hashClientValue(ip) : undefined,
    metadata: { familyId },
  });
}

export async function expireStaleSessions(): Promise<number> {
  const result = await Session.updateMany(
    { expiresAt: { $lt: new Date() }, revokedAt: null },
    { revokedAt: new Date(), revokeReason: 'expired' },
  );
  return result.modifiedCount;
}
