import { PaymentMethod, ServiceProviderType } from '@ghaarfix/shared-types';
import { Types } from 'mongoose';
import { CustomerAddress } from '@/models/CustomerAddress.js';
import { UrgentRequest } from '@/models/UrgentRequest.js';
import { AppError } from '@/utils/AppError.js';
import { ErrorCode } from '@ghaarfix/shared-types';
import { getAnchorService } from '@/modules/home-help/home-help-catalog.service.js';
import { buildHomeHelpReservationPayload } from '@/modules/home-help/home-help-quote.service.js';
import { calculateUrgentPricing, resolveUrgentConfig } from '@/modules/urgent/urgent.service.js';
import { generateUrgentRequestNumber } from '@/utils/urgentNumber.js';
import { env } from '@/config/env.js';
import { UrgentRequestStatus } from '@ghaarfix/shared-types';
import { startUrgentSearchWaves } from '@/modules/urgent/urgent-wave.service.js';
import { serializeUrgentRequestSummary } from '@/utils/urgentSerializers.js';
import type { HomeHelpTaskSelection, QuickServicesSnapshot } from '@ghaarfix/shared-types';

export async function createInstantHomeHelpRequest(
  customerId: string,
  input: {
    addressId: string;
    durationPackageId: string;
    tasks: HomeHelpTaskSelection[];
    generalNotes?: string;
    paymentMethod: PaymentMethod;
    quickServices?: QuickServicesSnapshot;
  },
) {
  const [anchorService, address, homeHelpPayload] = await Promise.all([
    getAnchorService(),
    CustomerAddress.findOne({ _id: input.addressId, customerId }),
    buildHomeHelpReservationPayload({
      durationPackageId: input.durationPackageId,
      tasks: input.tasks,
      generalNotes: input.generalNotes,
    }),
  ]);

  if (!address) throw new AppError('Address not found.', 404, ErrorCode.NOT_FOUND);
  if (!address.location?.coordinates?.length) {
    throw new AppError('Address coordinates are required for instant Home Help.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (anchorService.providerType !== ServiceProviderType.HOME_HELP_PRO || !anchorService.instantEligible) {
    throw new AppError('Instant Home Help is not available.', 400, ErrorCode.VALIDATION_ERROR);
  }
  if (!anchorService.isUrgentAvailable || !anchorService.urgentConfig?.enabled) {
    throw new AppError('Instant dispatch is not enabled for Home Help.', 400, ErrorCode.VALIDATION_ERROR);
  }

  const [lng, lat] = address.location.coordinates;
  const urgentConfig = resolveUrgentConfig(anchorService);
  const pricing = calculateUrgentPricing(anchorService, urgentConfig, homeHelpPayload.quotedAmount);
  const timeoutSeconds = urgentConfig.responseTimeoutMinutes * 60;
  const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

  const request = await UrgentRequest.create({
    requestNumber: await generateUrgentRequestNumber(),
    customerId,
    serviceId: anchorService._id,
    addressSnapshot: {
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      location: { latitude: lat, longitude: lng },
    },
    location: { type: 'Point', coordinates: [lng, lat] },
    customerNotes: input.generalNotes,
    status: UrgentRequestStatus.SEARCHING,
    paymentMethod: input.paymentMethod,
    pricing,
    searchConfig: {
      maxDistanceKm: urgentConfig.maxProviderDistanceKm,
      maxBroadcastProviders: Math.min(
        urgentConfig.maxBroadcastProviders,
        env.urgent.maxBroadcastProviders,
      ),
      broadcastCount: 0,
    },
    expiresAt,
    homeHelp: {
      durationPackageId: new Types.ObjectId(homeHelpPayload.durationPackageId),
      durationLabel: homeHelpPayload.durationLabel,
      durationMinutes: homeHelpPayload.durationMinutes,
      quotedAmount: homeHelpPayload.quotedAmount,
      generalNotes: homeHelpPayload.generalNotes,
      tasks: homeHelpPayload.tasks.map((task) => ({
        serviceId: new Types.ObjectId(task.serviceId),
        name: task.name,
        priority: task.priority,
        notes: task.notes,
      })),
    },
    quickServices: input.quickServices,
  });

  await startUrgentSearchWaves(request._id.toString());
  return serializeUrgentRequestSummary(request);
}
