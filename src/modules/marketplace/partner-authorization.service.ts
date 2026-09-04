import { ErrorCode, MarketplacePartnerStatus, PartnerMemberRole } from '@ghaarfix/shared-types';
import { MarketplacePartner, PartnerMember } from '@/models/Marketplace.js';
import { AppError } from '@/utils/AppError.js';

const ROLE_PERMISSIONS: Record<PartnerMemberRole, string[]> = {
  [PartnerMemberRole.OWNER]: ['*'],
  [PartnerMemberRole.CATALOG_MANAGER]: ['products', 'inventory:read'],
  [PartnerMemberRole.INVENTORY_MANAGER]: ['inventory'],
  [PartnerMemberRole.FULFILLMENT]: ['orders', 'fulfillment'],
  [PartnerMemberRole.FINANCE]: ['settlements', 'orders:read'],
  [PartnerMemberRole.VIEWER]: ['read'],
};

export async function getPartnerMembership(partnerId: string, userId: string) {
  return PartnerMember.findOne({ partnerId, userId, status: 'ACTIVE' });
}

export async function assertPartnerAccess(
  partnerId: string,
  userId: string,
  permission: string,
) {
  const partner = await MarketplacePartner.findById(partnerId);
  if (!partner) throw new AppError('Partner not found.', 404, ErrorCode.NOT_FOUND);
  if (partner.status === MarketplacePartnerStatus.SUSPENDED) {
    throw new AppError('Partner is suspended.', 403, ErrorCode.FORBIDDEN);
  }

  const member = await getPartnerMembership(partnerId, userId);
  if (!member) throw new AppError('Not a partner member.', 403, ErrorCode.FORBIDDEN);

  const allowed = ROLE_PERMISSIONS[member.role] ?? [];
  if (!allowed.includes('*') && !allowed.some((p) => permission.startsWith(p.replace(':read', '')))) {
    throw new AppError('Insufficient partner permission.', 403, ErrorCode.FORBIDDEN);
  }
  return { partner, member };
}

export function permissionsForPartnerRole(role: PartnerMemberRole) {
  return ROLE_PERMISSIONS[role] ?? [];
}
