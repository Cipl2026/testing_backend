import {
  ErrorCode,
  HomeHelpCompatibilityGroup,
  HomeHelpTaskPriority,
  ServiceProviderType,
  type HomeHelpTaskSelection,
} from '@ghaarfix/shared-types';
import type { IService } from '@/models/Service.js';
import {
  DEFAULT_HOME_HELP_COMPATIBILITY,
  getHomeHelpCompatibilityConfig,
  type HomeHelpCompatibilityRuntimeConfig,
} from '@/modules/home-help/compatibility-config.service.js';
import { AppError } from '@/utils/AppError.js';

export const HOME_HELP_DISCLAIMER =
  'We will complete as many tasks as possible within your booked time. Extra tasks may need another booking.';

const SPECIALIST_GROUPS = new Set<HomeHelpCompatibilityGroup>([
  HomeHelpCompatibilityGroup.SPECIALIST,
]);

export function validateHomeHelpTaskSelection(
  tasks: HomeHelpTaskSelection[],
  services: IService[],
  anchorService?: IService,
  config: HomeHelpCompatibilityRuntimeConfig = DEFAULT_HOME_HELP_COMPATIBILITY,
) {
  if (!tasks.length) {
    throw new AppError('Select at least one Home Help task.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (tasks.length > config.maxTasksPerVisit) {
    throw new AppError(
      `You can add up to ${config.maxTasksPerVisit} tasks per visit.`,
      400,
      ErrorCode.VALIDATION_ERROR,
    );
  }

  const serviceMap = new Map(services.map((service) => [service._id.toString(), service]));
  for (const task of tasks) {
    const service = serviceMap.get(task.serviceId);
    if (!service) {
      throw new AppError('One or more selected tasks are unavailable.', 404, ErrorCode.NOT_FOUND);
    }
    if (service.providerType !== ServiceProviderType.HOME_HELP_PRO) {
      throw new AppError(`${service.name} is not a Home Help task.`, 400, ErrorCode.VALIDATION_ERROR);
    }
    if (!service.hourlyEligible) {
      throw new AppError(`${service.name} cannot be booked hourly.`, 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  const groups = services
    .map((service) => service.compatibilityGroup)
    .filter(Boolean) as HomeHelpCompatibilityGroup[];

  if (config.specialistExclusive && groups.some((group) => SPECIALIST_GROUPS.has(group))) {
    throw new AppError('Specialist tasks cannot be combined in a Home Help visit.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const uniqueGroups = new Set(groups);
  if (
    config.requireHomeHelpForMixedGroups &&
    uniqueGroups.size > 1 &&
    !groups.every((group) => group === HomeHelpCompatibilityGroup.HOME_HELP)
  ) {
    const hasHomeHelpGeneral = groups.includes(HomeHelpCompatibilityGroup.HOME_HELP);
    if (!hasHomeHelpGeneral) {
      throw new AppError('Selected tasks cannot be combined in one visit.', 400, ErrorCode.VALIDATION_ERROR);
    }
  }

  if (anchorService && anchorService.providerType !== ServiceProviderType.HOME_HELP_PRO) {
    throw new AppError('Home Help anchor service is misconfigured.', 500, ErrorCode.INTERNAL_ERROR);
  }
}

export function sortTasksByPriority<T extends { priority: HomeHelpTaskPriority }>(tasks: T[]) {
  const rank: Record<HomeHelpTaskPriority, number> = {
    [HomeHelpTaskPriority.HIGH]: 0,
    [HomeHelpTaskPriority.MEDIUM]: 1,
    [HomeHelpTaskPriority.LOW]: 2,
  };
  return [...tasks].sort((a, b) => rank[a.priority] - rank[b.priority]);
}

export async function validateHomeHelpTaskSelectionAsync(
  tasks: HomeHelpTaskSelection[],
  services: IService[],
  anchorService?: IService,
) {
  const config = await getHomeHelpCompatibilityConfig();
  validateHomeHelpTaskSelection(tasks, services, anchorService, config);
}

export function defaultTaskPriority(index: number): HomeHelpTaskPriority {
  if (index === 0) return HomeHelpTaskPriority.HIGH;
  if (index <= 2) return HomeHelpTaskPriority.MEDIUM;
  return HomeHelpTaskPriority.LOW;
}
