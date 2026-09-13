import {
  type HomeHelpQuote,
  type HomeHelpTaskSelection,
  type HomeHelpTaskSnapshot,
} from '@ghaarfix/shared-types';
import { Service } from '@/models/Service.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import {
  HOME_HELP_DISCLAIMER,
  sortTasksByPriority,
  validateHomeHelpTaskSelectionAsync,
} from '@/modules/home-help/compatibility.service.js';
import {
  getAnchorService,
  getDurationPackageById,
} from '@/modules/home-help/home-help-catalog.service.js';
import { resolveHomeHelpBundleDiscount } from '@/modules/home-help/home-help-pricing.service.js';

export async function quoteHomeHelpVisit(input: {
  durationPackageId: string;
  tasks: HomeHelpTaskSelection[];
  generalNotes?: string;
}): Promise<HomeHelpQuote> {
  const [durationPackage, anchorService] = await Promise.all([
    getDurationPackageById(input.durationPackageId),
    getAnchorService(),
  ]);

  const taskIds = input.tasks.map((task) => task.serviceId);
  const services = await Service.find({ _id: { $in: taskIds }, isActive: true });
  if (services.length !== taskIds.length) {
    throw new AppError('One or more selected tasks are unavailable.', 404, ErrorCode.NOT_FOUND);
  }

  await validateHomeHelpTaskSelectionAsync(input.tasks, services, anchorService);

  const serviceMap = new Map(services.map((service) => [service._id.toString(), service]));
  const snapshots: HomeHelpTaskSnapshot[] = sortTasksByPriority(
    input.tasks.map((task) => {
      const service = serviceMap.get(task.serviceId)!;
      return {
        serviceId: task.serviceId,
        name: service.name,
        priority: task.priority,
        notes: task.notes?.trim() || undefined,
      };
    }),
  );

  const taskAddonTotal = snapshots.reduce((sum, task) => {
    const service = serviceMap.get(task.serviceId);
    return sum + (service?.pricing.startingPrice ?? 0);
  }, 0);

  const bundle = resolveHomeHelpBundleDiscount(snapshots.length, taskAddonTotal);
  const subtotal = durationPackage.basePrice + taskAddonTotal - bundle.discountAmount;
  const lineItems = [
    { label: durationPackage.label, amount: durationPackage.basePrice },
    ...snapshots
      .filter((task) => (serviceMap.get(task.serviceId)?.pricing.startingPrice ?? 0) > 0)
      .map((task) => ({
        label: task.name,
        amount: serviceMap.get(task.serviceId)?.pricing.startingPrice ?? 0,
      })),
  ];
  if (bundle.discountAmount > 0 && bundle.label) {
    lineItems.push({ label: bundle.label, amount: -bundle.discountAmount });
  }

  return {
    durationPackage: {
      id: durationPackage._id.toString(),
      label: durationPackage.label,
      durationMinutes: durationPackage.durationMinutes,
      basePrice: durationPackage.basePrice,
      currency: durationPackage.currency,
      displayOrder: durationPackage.displayOrder,
    },
    tasks: snapshots,
    lineItems,
    taskAddonTotal,
    bundleDiscount: bundle.discountAmount,
    bundleDiscountLabel: bundle.label,
    subtotal,
    currency: durationPackage.currency,
    disclaimer: HOME_HELP_DISCLAIMER,
  };
}

export async function buildHomeHelpReservationPayload(input: {
  durationPackageId: string;
  tasks: HomeHelpTaskSelection[];
  generalNotes?: string;
}) {
  const quote = await quoteHomeHelpVisit(input);
  return {
    durationPackageId: quote.durationPackage.id,
    durationLabel: quote.durationPackage.label,
    durationMinutes: quote.durationPackage.durationMinutes,
    quotedAmount: quote.subtotal,
    generalNotes: input.generalNotes?.trim() || undefined,
    tasks: quote.tasks.map((task) => ({
      serviceId: task.serviceId,
      name: task.name,
      priority: task.priority,
      notes: task.notes,
    })),
  };
}
