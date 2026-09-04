import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from '@ghaarfix/validation';
import {
  ManagedPropertyType,
  OrganizationBudgetPeriod,
  OrganizationMemberRole,
  OrganizationType,
  PaymentMethod,
} from '@ghaarfix/shared-types';

export const organizationIdParamSchema = z.object({ id: objectIdSchema });
export const propertyIdParamSchema = z.object({ id: objectIdSchema });
export const memberIdParamSchema = z.object({ memberId: objectIdSchema });
export const approvalIdParamSchema = z.object({ id: objectIdSchema });
export const bulkBookingIdParamSchema = z.object({ id: objectIdSchema });
export const orgInvoiceIdParamSchema = z.object({ id: objectIdSchema });

export const createOrganizationBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.nativeEnum(OrganizationType),
});

export const updateOrganizationBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  settings: z
    .object({
      requireBookingApproval: z.boolean().optional(),
      approvalAmountThreshold: z.number().min(0).optional(),
      allowUrgentBypass: z.boolean().optional(),
    })
    .optional(),
});

export const inviteMemberBodySchema = z.object({
  userId: objectIdSchema,
  role: z.nativeEnum(OrganizationMemberRole),
});

export const updateMemberBodySchema = z.object({
  role: z.nativeEnum(OrganizationMemberRole).optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
});

export const createPropertyBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.nativeEnum(ManagedPropertyType),
  address: z.object({
    addressLine1: z.string().trim().min(3),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    postalCode: z.string().trim().min(3),
    country: z.string().trim().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  cityId: objectIdSchema.optional(),
  serviceZoneId: objectIdSchema.optional(),
  linkHomeId: objectIdSchema.optional(),
});

export const createUnitBodySchema = z.object({
  name: z.string().trim().min(1),
  unitNumber: z.string().trim().min(1),
  floor: z.string().trim().optional(),
  type: z.string().trim().optional(),
});

export const createOccupantBodySchema = z.object({
  unitId: objectIdSchema.optional(),
  userId: objectIdSchema.optional(),
  nameSnapshot: z.string().trim().min(2),
  phoneSnapshot: z.string().trim().optional(),
  type: z.enum(['OWNER', 'TENANT', 'EMPLOYEE', 'RESIDENT']),
});

export const createOrgBookingBodySchema = z.object({
  reservationId: objectIdSchema,
  managedPropertyId: objectIdSchema,
  propertyUnitId: objectIdSchema.optional(),
  paymentMethod: z.nativeEnum(PaymentMethod),
  customerNotes: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(1000).optional(),
  estimatedAmount: z.number().min(0).optional(),
  isUrgent: z.boolean().optional(),
});

export const createBulkBookingBodySchema = z.object({
  serviceId: objectIdSchema,
  properties: z.array(
    z.object({
      propertyId: objectIdSchema,
      unitId: objectIdSchema.optional(),
    }),
  ).min(1),
  scheduleStrategy: z.record(z.unknown()).optional(),
  templateId: objectIdSchema.optional(),
});

export const approvalActionBodySchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export const rejectApprovalBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const upsertBudgetBodySchema = z.object({
  propertyId: objectIdSchema.optional(),
  period: z.nativeEnum(OrganizationBudgetPeriod),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalBudget: z.number().min(0),
});

export const orgBookingsQuerySchema = paginationQuerySchema;
