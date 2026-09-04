import {
  ClaimResolutionType,
  GuaranteePolicyStatus,
  ProtectionClaimType,
} from '@ghaarfix/shared-types';
import { ServiceGuaranteePolicy } from '@/models/TrustProtection.js';

const DEFAULT_COVERED = [
  ProtectionClaimType.REPEAT_ISSUE,
  ProtectionClaimType.POOR_QUALITY,
  ProtectionClaimType.PART_FAILURE,
];

const DEFAULT_RESOLUTIONS = [
  ClaimResolutionType.FREE_REVISIT,
  ClaimResolutionType.REWORK,
  ClaimResolutionType.PARTIAL_REFUND,
  ClaimResolutionType.REFUND,
];

export async function findActivePolicyForService(serviceId: string, categoryId?: string) {
  const byService = await ServiceGuaranteePolicy.findOne({
    serviceId,
    status: GuaranteePolicyStatus.ACTIVE,
  }).sort({ version: -1 });

  if (byService) return byService;

  if (categoryId) {
    return ServiceGuaranteePolicy.findOne({
      categoryId,
      status: GuaranteePolicyStatus.ACTIVE,
    }).sort({ version: -1 });
  }

  return null;
}

export async function createGuaranteePolicy(input: {
  serviceId?: string;
  categoryId?: string;
  coverageDays?: number;
  coveredIssueTypes?: ProtectionClaimType[];
  exclusions?: string[];
  maxClaims?: number;
  resolutionOptions?: ClaimResolutionType[];
}) {
  const latest = await ServiceGuaranteePolicy.findOne({
    serviceId: input.serviceId,
    categoryId: input.categoryId,
  }).sort({ version: -1 });

  return ServiceGuaranteePolicy.create({
    serviceId: input.serviceId,
    categoryId: input.categoryId,
    version: (latest?.version ?? 0) + 1,
    coverageDays: input.coverageDays ?? 30,
    coveredIssueTypes: input.coveredIssueTypes ?? DEFAULT_COVERED,
    exclusions: input.exclusions ?? ['customer misuse', 'pre-existing damage'],
    maxClaims: input.maxClaims ?? 2,
    resolutionOptions: input.resolutionOptions ?? DEFAULT_RESOLUTIONS,
    status: GuaranteePolicyStatus.DRAFT,
  });
}

export async function activateGuaranteePolicy(policyId: string) {
  return ServiceGuaranteePolicy.findByIdAndUpdate(
    policyId,
    { status: GuaranteePolicyStatus.ACTIVE },
    { new: true },
  );
}

export async function listGuaranteePolicies(query?: { status?: GuaranteePolicyStatus }) {
  const filter: Record<string, unknown> = {};
  if (query?.status) filter.status = query.status;
  const items = await ServiceGuaranteePolicy.find(filter).sort({ updatedAt: -1 });
  return items.map((p) => ({
    id: p._id.toString(),
    serviceId: p.serviceId?.toString(),
    categoryId: p.categoryId?.toString(),
    version: p.version,
    coverageDays: p.coverageDays,
    coveredIssueTypes: p.coveredIssueTypes,
    exclusions: p.exclusions,
    maxClaims: p.maxClaims,
    resolutionOptions: p.resolutionOptions,
    status: p.status,
  }));
}

export async function updateGuaranteePolicy(
  policyId: string,
  input: Partial<{
    coverageDays: number;
    coveredIssueTypes: ProtectionClaimType[];
    exclusions: string[];
    maxClaims: number;
    resolutionOptions: ClaimResolutionType[];
    status: GuaranteePolicyStatus;
  }>,
) {
  return ServiceGuaranteePolicy.findByIdAndUpdate(policyId, { $set: input }, { new: true });
}
