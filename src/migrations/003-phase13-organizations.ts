import { Organization } from '@/models/Organization.js';
import { ManagedProperty } from '@/models/ManagedProperty.js';
import {
  ApprovalPolicy,
  ApprovalRequest,
  BulkBookingItem,
  BulkBookingRequest,
  OrganizationBudget,
  OrganizationInvoice,
  OrganizationMaintenanceSchedule,
  ServiceLevelAgreement,
  SLATracker,
  WorkOrder,
} from '@/models/OrganizationOperations.js';
import { PropertyHealthScore, PropertyOccupant, PropertyUnit } from '@/models/ManagedProperty.js';
import { OrganizationAuditLog } from '@/models/Organization.js';
import { Booking } from '@/models/Booking.js';
import { logger } from '@/utils/logger.js';

async function ensureModelIndexes(): Promise<void> {
  await Promise.all([
    Organization.syncIndexes(),
    ManagedProperty.syncIndexes(),
    PropertyUnit.syncIndexes(),
    PropertyOccupant.syncIndexes(),
    PropertyHealthScore.syncIndexes(),
    ApprovalPolicy.syncIndexes(),
    ApprovalRequest.syncIndexes(),
    BulkBookingRequest.syncIndexes(),
    BulkBookingItem.syncIndexes(),
    OrganizationMaintenanceSchedule.syncIndexes(),
    ServiceLevelAgreement.syncIndexes(),
    SLATracker.syncIndexes(),
    OrganizationBudget.syncIndexes(),
    OrganizationInvoice.syncIndexes(),
    WorkOrder.syncIndexes(),
    OrganizationAuditLog.syncIndexes(),
    Booking.syncIndexes(),
  ]);
}

export async function runPhase13Migrations(): Promise<void> {
  await ensureModelIndexes();
  logger.info('Phase 13 organization indexes ensured');
}
