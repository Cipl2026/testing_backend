import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DataExportStatus } from '@ghaarfix/shared-types';
import { DataExportRequest } from '@/models/Security.js';
import { User } from '@/models/User.js';
import { CustomerProfile } from '@/models/CustomerProfile.js';
import { Booking } from '@/models/Booking.js';
import { PrivacyConsentRecord } from '@/models/Security.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { logSecurityAudit } from '@/modules/security/security-audit.service.js';
import { env } from '@/config/env.js';

const EXPORT_DIR = path.join(env.storage.uploadDir, 'exports');
const EXPORT_TTL_HOURS = 72;

export async function requestDataExport(userId: string) {
  const existing = await DataExportRequest.findOne({
    userId,
    status: { $in: [DataExportStatus.PENDING, DataExportStatus.PROCESSING, DataExportStatus.READY] },
  });
  if (existing) {
    return formatExport(existing);
  }

  const exportReq = await DataExportRequest.create({
    userId,
    status: DataExportStatus.PENDING,
  });

  await logSecurityAudit({
    actorId: userId,
    actorType: 'CUSTOMER',
    action: 'data_export.requested',
    targetType: 'data_export',
    targetId: exportReq._id.toString(),
  });

  void processDataExport(exportReq._id.toString());
  return formatExport(exportReq);
}

async function processDataExport(exportId: string): Promise<void> {
  const exportReq = await DataExportRequest.findById(exportId);
  if (!exportReq) return;

  exportReq.status = DataExportStatus.PROCESSING;
  await exportReq.save();

  try {
    const userId = exportReq.userId.toString();
    const [user, profile, bookings, consents] = await Promise.all([
      User.findById(userId).select('-passwordHash'),
      CustomerProfile.findOne({ userId }),
      Booking.find({ customerId: userId }).limit(500).select('-addressSnapshot.phone'),
      PrivacyConsentRecord.find({ userId }),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      profile: {
        user: user ? { id: user._id, role: user.role, fullName: user.fullName, createdAt: user.createdAt } : null,
        customerProfile: profile,
      },
      bookings: bookings.map((b) => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        serviceName: b.serviceSnapshot?.name,
        createdAt: b.createdAt,
      })),
      consents,
    };

    await fs.mkdir(EXPORT_DIR, { recursive: true });
    const token = randomBytes(32).toString('hex');
    const filePath = path.join(EXPORT_DIR, `${exportId}.json`);
    await fs.writeFile(filePath, JSON.stringify(bundle, null, 2));

    exportReq.status = DataExportStatus.READY;
    exportReq.downloadToken = token;
    exportReq.filePath = filePath;
    exportReq.expiresAt = new Date(Date.now() + EXPORT_TTL_HOURS * 60 * 60 * 1000);
    exportReq.completedAt = new Date();
    await exportReq.save();
  } catch (error) {
    exportReq.status = DataExportStatus.FAILED;
    exportReq.errorMessage = error instanceof Error ? error.message : 'Export failed';
    await exportReq.save();
  }
}

export async function getDataExport(userId: string, exportId: string) {
  const exportReq = await DataExportRequest.findOne({ _id: exportId, userId });
  if (!exportReq) throw new AppError('Export not found', 404, ErrorCode.NOT_FOUND);
  if (exportReq.expiresAt && exportReq.expiresAt < new Date() && exportReq.status === DataExportStatus.READY) {
    exportReq.status = DataExportStatus.EXPIRED;
    await exportReq.save();
  }
  return formatExport(exportReq);
}

export async function downloadDataExport(userId: string, exportId: string, token: string) {
  const exportReq = await DataExportRequest.findOne({
    _id: exportId,
    userId,
    downloadToken: token,
    status: DataExportStatus.READY,
  });
  if (!exportReq || !exportReq.filePath) {
    throw new AppError('Export not available', 404, ErrorCode.NOT_FOUND);
  }
  if (exportReq.expiresAt && exportReq.expiresAt < new Date()) {
    exportReq.status = DataExportStatus.EXPIRED;
    await exportReq.save();
    throw new AppError('Export has expired', 410, ErrorCode.NOT_FOUND);
  }

  await logSecurityAudit({
    actorId: userId,
    actorType: 'CUSTOMER',
    action: 'data_export.downloaded',
    targetType: 'data_export',
    targetId: exportId,
  });

  const content = await fs.readFile(exportReq.filePath, 'utf-8');
  return JSON.parse(content);
}

function formatExport(exportReq: InstanceType<typeof DataExportRequest>) {
  return {
    id: exportReq._id.toString(),
    status: exportReq.status,
    expiresAt: exportReq.expiresAt,
    completedAt: exportReq.completedAt,
    downloadToken: exportReq.status === DataExportStatus.READY ? exportReq.downloadToken : undefined,
  };
}

export async function listDataExportsAdmin(limit = 50) {
  const rows = await DataExportRequest.find().sort({ createdAt: -1 }).limit(limit);
  return rows.map((r) => ({
    id: r._id.toString(),
    userId: r.userId.toString(),
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));
}
