import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';
import {
  BookingParticipantPermission,
  BookingParticipantRole,
  HomeMemberRole,
  HomeNotificationEventType,
  OperationalRiskSignalStatus,
  ProviderSkillLevel,
  ProviderVerificationStatus,
  ProviderVerificationType,
} from '@ghaarfix/shared-types';

export const homeIdParamSchema = z.object({ homeId: objectIdSchema });
export const memberIdParamSchema = z.object({ homeId: objectIdSchema, memberId: objectIdSchema });
export const invitationIdParamSchema = z.object({ invitationId: objectIdSchema });
export const trustedContactIdParamSchema = z.object({ contactId: objectIdSchema });
export const participantIdParamSchema = z.object({ bookingId: objectIdSchema, participantId: objectIdSchema });

export const inviteMemberBodySchema = z.object({
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(HomeMemberRole),
});

export const acceptInvitationBodySchema = z.object({
  token: z.string().min(16).optional(),
});

export const updateMemberBodySchema = z.object({
  role: z.nativeEnum(HomeMemberRole).optional(),
});

export const addParticipantBodySchema = z.object({
  customerId: objectIdSchema.optional(),
  role: z.nativeEnum(BookingParticipantRole),
  permissions: z.array(z.nativeEnum(BookingParticipantPermission)).optional(),
});

export const updateParticipantBodySchema = z.object({
  role: z.nativeEnum(BookingParticipantRole).optional(),
  permissions: z.array(z.nativeEnum(BookingParticipantPermission)).optional(),
});

export const guestRecipientBodySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  relationship: z.string().max(80).optional(),
});

export const trustedContactBodySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(10).max(15),
  relationship: z.string().max(80).optional(),
  isEmergencyContact: z.boolean().optional(),
  notificationPreferences: z.array(z.string()).optional(),
  linkedCustomerId: objectIdSchema.optional(),
});

export const notificationPrefsBodySchema = z.object({
  preferences: z.array(
    z.object({
      eventType: z.nativeEnum(HomeNotificationEventType),
      enabled: z.boolean(),
    }),
  ),
});

export const submitVerificationBodySchema = z.object({
  type: z.nativeEnum(ProviderVerificationType),
  metadata: z.record(z.unknown()).optional(),
});

export const adminReviewVerificationBodySchema = z.object({
  status: z.enum([ProviderVerificationStatus.VERIFIED, ProviderVerificationStatus.REJECTED]),
  reason: z.string().max(500).optional(),
});

export const submitSkillBodySchema = z.object({
  skillId: objectIdSchema,
  level: z.nativeEnum(ProviderSkillLevel),
});

export const adminSkillStatusBodySchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  reason: z.string().max(500).optional(),
});

export const adminSignalUpdateBodySchema = z.object({
  status: z.nativeEnum(OperationalRiskSignalStatus),
  resolutionNote: z.string().max(500).optional(),
});

export const verificationIdParamSchema = z.object({ id: objectIdSchema });
export const skillIdParamSchema = z.object({ id: objectIdSchema });
export const signalIdParamSchema = z.object({ id: objectIdSchema });
export const providerIdAdminParamSchema = z.object({ providerId: objectIdSchema });
