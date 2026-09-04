import { createHash, randomBytes } from 'node:crypto';
import {
  Partner,
  PartnerRegionAssignment,
  PartnerAgreement,
  PartnerPerformanceSnapshot,
  ApiClient,
} from '@/models/Globalization.js';
import { PartnerStatus, PartnerAgreementType, ApiClientStatus } from '@ghaarfix/shared-types';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function listPartners(status?: PartnerStatus) {
  const query = status ? { status } : {};
  return Partner.find(query).sort({ createdAt: -1 });
}

export async function createPartner(input: {
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
}) {
  const existing = await Partner.findOne({ code: input.code.toUpperCase() });
  if (existing) throw new AppError('Partner code exists.', 409, ErrorCode.CONFLICT);
  return Partner.create({ ...input, code: input.code.toUpperCase(), status: PartnerStatus.APPLIED });
}

export async function assignPartnerRegion(partnerId: string, regionId: string) {
  return PartnerRegionAssignment.findOneAndUpdate(
    { partnerId, regionId },
    { isActive: true, assignedAt: new Date() },
    { upsert: true, new: true },
  );
}

export async function createPartnerAgreement(input: {
  partnerId: string;
  regionId?: string;
  type: PartnerAgreementType;
  commissionPercent?: number;
  revenueSharePercent?: number;
  fixedFeeMinor?: number;
  currency: string;
}) {
  return PartnerAgreement.create(input);
}

export async function assertPartnerRegionAccess(partnerId: string, regionId: string): Promise<void> {
  const assignment = await PartnerRegionAssignment.findOne({
    partnerId,
    regionId,
    isActive: true,
  });
  if (!assignment) {
    throw new AppError('Partner not authorized for this region.', 403, ErrorCode.FORBIDDEN);
  }
}

export async function getPartnerPerformance(partnerId: string, limit = 12) {
  return PartnerPerformanceSnapshot.find({ partnerId })
    .sort({ periodStart: -1 })
    .limit(limit);
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function createApiClient(input: {
  name: string;
  organizationId?: string;
  partnerId?: string;
  scopes: string[];
}): Promise<{ client: InstanceType<typeof ApiClient>; apiKey: string }> {
  const apiKey = `gf_${randomBytes(24).toString('hex')}`;
  const keyPrefix = apiKey.slice(0, 10);
  const client = await ApiClient.create({
    ...input,
    keyHash: hashApiKey(apiKey),
    keyPrefix,
    status: ApiClientStatus.ACTIVE,
  });
  return { client, apiKey };
}

export async function rotateApiKey(clientId: string): Promise<{ apiKey: string; keyPrefix: string }> {
  const apiKey = `gf_${randomBytes(24).toString('hex')}`;
  const client = await ApiClient.findByIdAndUpdate(
    clientId,
    { keyHash: hashApiKey(apiKey), keyPrefix: apiKey.slice(0, 10) },
    { new: true },
  );
  if (!client) throw new AppError('API client not found.', 404, ErrorCode.NOT_FOUND);
  return { apiKey, keyPrefix: client.keyPrefix };
}

export async function revokeApiClient(clientId: string) {
  return ApiClient.findByIdAndUpdate(clientId, { status: ApiClientStatus.REVOKED }, { new: true });
}

export async function verifyApiKey(
  apiKey: string,
  requiredScope: string,
): Promise<InstanceType<typeof ApiClient>> {
  const client = await ApiClient.findOne({
    keyHash: hashApiKey(apiKey),
    status: ApiClientStatus.ACTIVE,
  });
  if (!client) throw new AppError('Invalid API key.', 401, ErrorCode.UNAUTHORIZED);
  if (!client.scopes.includes(requiredScope)) {
    throw new AppError('Insufficient API scope.', 403, ErrorCode.FORBIDDEN);
  }
  await ApiClient.findByIdAndUpdate(client._id, { lastUsedAt: new Date() });
  return client;
}
