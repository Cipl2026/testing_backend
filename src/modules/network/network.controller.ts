import * as slotService from '@/modules/network/slot-intelligence.service.js';
import * as waitTimeService from '@/modules/network/wait-time.service.js';
import { evaluateFlag } from '@/modules/discovery-growth/feature-flag.service.js';
import { FeatureFlagKey } from '@ghaarfix/shared-types';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const getServiceAvailability = asyncHandler(async (req, res) => {
  const customerId = req.auth?.userId;
  const enabled = await evaluateFlag(FeatureFlagKey.ENABLE_NETWORK_INTELLIGENCE, customerId);
  if (!enabled) {
    sendSuccess(res, 'Service availability', {
      serviceId: req.params.serviceId,
      available: true,
      legacy: true,
    });
    return;
  }

  const data = await slotService.getServiceAvailability(String(req.params.serviceId), {
    zoneId: req.query.zoneId as string | undefined,
    date: req.query.date as string | undefined,
  });
  sendSuccess(res, 'Service availability', data);
});

export const getWaitTime = asyncHandler(async (req, res) => {
  const customerId = req.auth?.userId;
  const enabled = await evaluateFlag(FeatureFlagKey.ENABLE_NETWORK_INTELLIGENCE, customerId);
  const zoneId = req.query.zoneId as string;
  if (!enabled || !zoneId) {
    sendSuccess(res, 'Wait time', {
      label: 'Availability may vary',
      disclaimer: 'Enable network intelligence for estimates.',
    });
    return;
  }

  const data = await waitTimeService.estimateWaitTime({
    zoneId,
    serviceId: String(req.params.serviceId),
    distanceKm: req.query.distanceKm ? Number(req.query.distanceKm) : undefined,
    isUrgent: req.query.urgent === 'true',
  });
  sendSuccess(res, 'Wait time estimate', data);
});
