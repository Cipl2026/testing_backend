import { SecurityPermission as SecurityPermissionEnum } from '@ghaarfix/shared-types';
import { SecurityPermission, SecurityRole } from '@/models/Security.js';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode, UserRole } from '@ghaarfix/shared-types';
import { recordSecurityEvent } from '@/modules/security/security-event.service.js';
import { SecurityEventSeverity, SecurityEventType } from '@ghaarfix/shared-types';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';

const DEFAULT_PERMISSIONS = Object.values(SecurityPermissionEnum).map((key) => ({
  key,
  name: key.replace('.', ' '),
  category: key.split('.')[0],
}));

export async function seedSecurityPermissions(): Promise<void> {
  for (const perm of DEFAULT_PERMISSIONS) {
    await SecurityPermission.findOneAndUpdate({ key: perm.key }, perm, { upsert: true });
  }

  await SecurityRole.findOneAndUpdate(
    { key: 'super_admin' },
    {
      key: 'super_admin',
      name: 'Super Admin',
      permissions: DEFAULT_PERMISSIONS.map((p) => p.key),
      isSystem: true,
    },
    { upsert: true },
  );

  await SecurityRole.findOneAndUpdate(
    { key: 'support_admin' },
    {
      key: 'support_admin',
      name: 'Support Admin',
      permissions: ['booking.read', 'security.audit.read', 'user.manage'],
      isSystem: true,
    },
    { upsert: true },
  );
}

export async function listPermissions() {
  return SecurityPermission.find().sort({ category: 1, key: 1 });
}

export async function listRoles() {
  return SecurityRole.find().sort({ name: 1 });
}

export async function createRole(input: {
  key: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  return SecurityRole.create({ ...input, isSystem: false });
}

export async function updateRole(
  key: string,
  input: { name?: string; description?: string; permissions?: string[] },
  actorId: string,
) {
  const role = await SecurityRole.findOne({ key });
  if (!role) throw new AppError('Role not found', 404, ErrorCode.NOT_FOUND);
  if (role.isSystem && input.permissions) {
    throw new AppError('Cannot modify system role permissions', 403, ErrorCode.FORBIDDEN);
  }

  if (input.name) role.name = input.name;
  if (input.description !== undefined) role.description = input.description;
  if (input.permissions) role.permissions = input.permissions;
  await role.save();

  await logSecurityAudit({
    actorId,
    actorType: UserRole.ADMIN,
    action: 'role.updated',
    targetType: 'role',
    targetId: role._id.toString(),
    metadata: { key, permissions: input.permissions },
  });

  return role;
}

export async function assertAdminPermission(userId: string, permission: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.role !== UserRole.ADMIN) {
    throw new AppError('Admin access required.', 403, ErrorCode.FORBIDDEN);
  }

  const role = await SecurityRole.findOne({ key: 'super_admin' });
  if (role?.permissions.includes(permission)) {
    return;
  }

  await recordSecurityEvent({
    type: SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT,
    severity: SecurityEventSeverity.HIGH,
    actorId: userId,
    metadata: { permission },
  });
  throw new AppError('Insufficient permissions.', 403, ErrorCode.FORBIDDEN);
}

export function authorizePermission(permission: string) {
  return async (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    try {
      if (!req.auth?.userId) {
        next(new AppError('Authentication required.', 401, ErrorCode.UNAUTHORIZED));
        return;
      }
      await assertAdminPermission(req.auth.userId, permission);
      next();
    } catch (error) {
      next(error);
    }
  };
}
