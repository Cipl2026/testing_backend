import { ErrorCode, ProviderServiceApprovalStatus } from '@ghaarfix/shared-types';
import { ProviderService } from '@/models/ProviderService.js';
import { Service } from '@/models/Service.js';
import { User } from '@/models/User.js';
import { AppError } from '@/utils/AppError.js';
import { buildPaginationMeta } from '@/utils/catalog.js';
import { serializeProviderService } from '@/utils/catalogSerializers.js';
import type { AdminListQuery } from '@/validators/catalog.js';

export async function listProviderServices(providerId: string) {
  const records = await ProviderService.find({ providerId }).sort({ createdAt: -1 });
  const services = await Service.find({ _id: { $in: records.map((r) => r.serviceId) } });
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));
  return records.map((record) =>
    serializeProviderService(record, { service: serviceMap.get(record.serviceId.toString()) }),
  );
}

export async function createProviderService(
  providerId: string,
  input: {
    serviceId: string;
    experienceYears?: number;
    description?: string;
    customPricing?: {
      enabled: boolean;
      visitCharge?: number;
      startingPrice?: number;
      notes?: string;
    };
  },
) {
  const service = await Service.findOne({ _id: input.serviceId, isActive: true });
  if (!service) throw new AppError('Service is not available.', 404, ErrorCode.NOT_FOUND);
  const duplicate = await ProviderService.findOne({ providerId, serviceId: input.serviceId });
  if (duplicate) throw new AppError('You already offer this service.', 409, ErrorCode.CONFLICT);
  const record = await ProviderService.create({
    providerId,
    serviceId: input.serviceId,
    experienceYears: input.experienceYears,
    description: input.description,
    customPricing: input.customPricing ?? { enabled: false },
    approvalStatus: ProviderServiceApprovalStatus.PENDING,
    isActive: true,
  });
  return serializeProviderService(record, { service });
}

export async function updateProviderService(
  providerId: string,
  id: string,
  input: Partial<{
    experienceYears: number;
    description: string;
    customPricing: {
      enabled: boolean;
      visitCharge?: number;
      startingPrice?: number;
      notes?: string;
    };
    isActive: boolean;
  }>,
) {
  const record = await ProviderService.findOne({ _id: id, providerId });
  if (!record) throw new AppError('Provider service not found.', 404, ErrorCode.NOT_FOUND);
  if (input.experienceYears !== undefined) record.experienceYears = input.experienceYears;
  if (input.description !== undefined) record.description = input.description;
  if (input.customPricing) record.customPricing = input.customPricing;
  if (input.isActive !== undefined) record.isActive = input.isActive;
  await record.save();
  const service = await Service.findById(record.serviceId);
  return serializeProviderService(record, { service: service ?? undefined });
}

export async function removeProviderService(providerId: string, id: string) {
  const deleted = await ProviderService.findOneAndDelete({ _id: id, providerId });
  if (!deleted) throw new AppError('Provider service not found.', 404, ErrorCode.NOT_FOUND);
}

export async function adminListProviderServices(query: AdminListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
  const total = await ProviderService.countDocuments(filter);
  const records = await ProviderService.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit);
  const [services, providers] = await Promise.all([
    Service.find({ _id: { $in: records.map((r) => r.serviceId) } }),
    User.find({ _id: { $in: records.map((r) => r.providerId) } }),
  ]);
  const serviceMap = new Map(services.map((s) => [s._id.toString(), s]));
  const providerMap = new Map(providers.map((p) => [p._id.toString(), p]));
  return {
    items: records.map((record) =>
      serializeProviderService(record, {
        service: serviceMap.get(record.serviceId.toString()),
        providerName: providerMap.get(record.providerId.toString())?.fullName,
      }),
    ),
    meta: buildPaginationMeta(query.page, query.limit, total),
  };
}

export async function adminApproveProviderService(id: string) {
  const record = await ProviderService.findById(id);
  if (!record) throw new AppError('Provider service not found.', 404, ErrorCode.NOT_FOUND);
  record.approvalStatus = ProviderServiceApprovalStatus.APPROVED;
  record.rejectionReason = undefined;
  record.isActive = true;
  await record.save();
  const service = await Service.findById(record.serviceId);
  return serializeProviderService(record, { service: service ?? undefined });
}

export async function adminRejectProviderService(id: string, reason: string) {
  const record = await ProviderService.findById(id);
  if (!record) throw new AppError('Provider service not found.', 404, ErrorCode.NOT_FOUND);
  record.approvalStatus = ProviderServiceApprovalStatus.REJECTED;
  record.rejectionReason = reason;
  record.isActive = false;
  await record.save();
  const service = await Service.findById(record.serviceId);
  return serializeProviderService(record, { service: service ?? undefined });
}
