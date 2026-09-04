import {
  BookingParticipantPermission,
  ErrorCode,
  HomeCapability,
  HomeMemberRole,
  HomeMemberStatus,
} from '@ghaarfix/shared-types';
import { Home } from '@/models/Home.js';
import { HomeMember } from '@/models/HomeMember.js';
import { AppError } from '@/utils/AppError.js';

const ROLE_CAPABILITIES: Record<HomeMemberRole, HomeCapability[]> = {
  [HomeMemberRole.OWNER]: Object.values(HomeCapability),
  [HomeMemberRole.ADMIN]: [
    HomeCapability.HOME_VIEW,
    HomeCapability.HOME_EDIT,
    HomeCapability.HOME_MEMBER_INVITE,
    HomeCapability.HOME_MEMBER_REMOVE,
    HomeCapability.ASSET_VIEW,
    HomeCapability.ASSET_EDIT,
    HomeCapability.BOOKING_CREATE,
    HomeCapability.BOOKING_VIEW,
    HomeCapability.BOOKING_PAY,
    HomeCapability.BOOKING_CANCEL,
    HomeCapability.BOOKING_TRACK,
    HomeCapability.BOOKING_PARTICIPATE,
    HomeCapability.DEVICE_VIEW,
    HomeCapability.DEVICE_MANAGE,
    HomeCapability.DEVICE_ALERT_ACK,
  ],
  [HomeMemberRole.MEMBER]: [
    HomeCapability.HOME_VIEW,
    HomeCapability.ASSET_VIEW,
    HomeCapability.BOOKING_CREATE,
    HomeCapability.BOOKING_VIEW,
    HomeCapability.BOOKING_TRACK,
    HomeCapability.BOOKING_PARTICIPATE,
    HomeCapability.DEVICE_VIEW,
    HomeCapability.DEVICE_ALERT_ACK,
  ],
  [HomeMemberRole.VIEWER]: [
    HomeCapability.HOME_VIEW,
    HomeCapability.ASSET_VIEW,
    HomeCapability.BOOKING_VIEW,
    HomeCapability.DEVICE_VIEW,
  ],
};

export function capabilitiesForRole(role: HomeMemberRole): HomeCapability[] {
  return ROLE_CAPABILITIES[role];
}

export function roleHasCapability(role: HomeMemberRole, capability: HomeCapability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export async function getActiveHomeMembership(homeId: string, customerId: string) {
  const member = await HomeMember.findOne({
    homeId,
    customerId,
    status: HomeMemberStatus.ACTIVE,
  });
  if (member) return member;

  const home = await Home.findOne({ _id: homeId, customerId, isArchived: false });
  if (home) {
    return HomeMember.findOneAndUpdate(
      { homeId, customerId },
      {
        $setOnInsert: {
          role: HomeMemberRole.OWNER,
          status: HomeMemberStatus.ACTIVE,
          joinedAt: home.createdAt,
        },
      },
      { upsert: true, new: true },
    );
  }

  return null;
}

export async function assertHomeCapability(
  customerId: string,
  homeId: string,
  capability: HomeCapability,
) {
  const member = await getActiveHomeMembership(homeId, customerId);
  if (!member) throw new AppError('Home not found.', 404, ErrorCode.NOT_FOUND);
  if (!roleHasCapability(member.role, capability)) {
    throw new AppError('You do not have permission for this action.', 403, ErrorCode.FORBIDDEN);
  }
  return member;
}

export async function listAccessibleHomeIds(customerId: string): Promise<string[]> {
  const [owned, memberships] = await Promise.all([
    Home.find({ customerId, isArchived: false }).select('_id'),
    HomeMember.find({ customerId, status: HomeMemberStatus.ACTIVE }).select('homeId'),
  ]);
  const ids = new Set<string>();
  for (const home of owned) ids.add(home._id.toString());
  for (const m of memberships) ids.add(m.homeId.toString());
  return [...ids];
}

export function viewerCannotPay(role: HomeMemberRole): boolean {
  return !roleHasCapability(role, HomeCapability.BOOKING_PAY);
}

export const DEFAULT_BOOKER_PERMISSIONS: BookingParticipantPermission[] = [
  BookingParticipantPermission.VIEW_BOOKING,
  BookingParticipantPermission.TRACK_PROVIDER,
  BookingParticipantPermission.PAY,
  BookingParticipantPermission.VIEW_INVOICE,
  BookingParticipantPermission.RATE_SERVICE,
  BookingParticipantPermission.REPORT_ISSUE,
];

export const DEFAULT_RECIPIENT_PERMISSIONS: BookingParticipantPermission[] = [
  BookingParticipantPermission.VIEW_BOOKING,
  BookingParticipantPermission.TRACK_PROVIDER,
  BookingParticipantPermission.CONFIRM_COMPLETION,
  BookingParticipantPermission.CONTACT_PROVIDER,
];

export const DEFAULT_OBSERVER_PERMISSIONS: BookingParticipantPermission[] = [
  BookingParticipantPermission.VIEW_BOOKING,
  BookingParticipantPermission.TRACK_PROVIDER,
];
