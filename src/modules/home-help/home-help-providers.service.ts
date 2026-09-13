import { ProviderDiscoverySort } from '@ghaarfix/shared-types';
import { Service } from '@/models/Service.js';
import { ProviderService } from '@/models/ProviderService.js';
import { ProviderServiceApprovalStatus } from '@ghaarfix/shared-types';
import { discoverProvidersForService } from '@/modules/provider-availability/availability.service.js';
import { getAnchorService } from '@/modules/home-help/home-help-catalog.service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';

export async function discoverHomeHelpProviders(
  customerId: string,
  input: {
    addressId: string;
    taskServiceIds: string[];
    page?: number;
    limit?: number;
    sort?: ProviderDiscoverySort;
  },
) {
  const anchorService = await getAnchorService();
  const taskIds = [...new Set(input.taskServiceIds.filter(Boolean))];
  if (!taskIds.length) {
    throw new AppError('Select at least one Home Help task.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const services = await Service.find({ _id: { $in: taskIds }, isActive: true }).select('_id');
  if (services.length !== taskIds.length) {
    throw new AppError('One or more selected tasks are unavailable.', 404, ErrorCode.NOT_FOUND);
  }

  const base = await discoverProvidersForService(
    customerId,
    anchorService._id.toString(),
    input.addressId,
    {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      sort: input.sort ?? ProviderDiscoverySort.RECOMMENDED,
    },
  );

  if (!base.items.length || taskIds.length === 1) {
    return base;
  }

  const approved = await ProviderService.find({
    serviceId: { $in: taskIds },
    approvalStatus: ProviderServiceApprovalStatus.APPROVED,
    isActive: true,
    providerId: { $in: base.items.map((item) => item.id) },
  }).select('providerId serviceId');

  const coverage = new Map<string, Set<string>>();
  for (const row of approved) {
    const pid = row.providerId.toString();
    if (!coverage.has(pid)) coverage.set(pid, new Set());
    coverage.get(pid)!.add(row.serviceId.toString());
  }

  const filteredItems = base.items.filter((provider) => {
    const covered = coverage.get(provider.id);
    return covered ? taskIds.every((taskId) => covered.has(taskId)) : false;
  });

  return {
    ...base,
    items: filteredItems,
    meta: base.meta
      ? {
          ...base.meta,
          total: filteredItems.length,
          totalPages: Math.max(1, Math.ceil(filteredItems.length / (input.limit ?? 20))),
        }
      : base.meta,
  };
}

export function getHomeHelpRequiredServiceIds(
  anchorServiceId: string,
  taskServiceIds: string[],
): string[] {
  return [...new Set([anchorServiceId, ...taskServiceIds.filter(Boolean)])];
}
