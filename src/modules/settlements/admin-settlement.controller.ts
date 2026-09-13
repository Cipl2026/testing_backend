import * as settlementService from '@/modules/settlements/provider-settlement.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const listSettlements = asyncHandler(async (req, res) => {
  const result = await settlementService.listAdminSettlements({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
    status: req.query.status as never,
    kind: req.query.kind as never,
    providerId: req.query.providerId as string | undefined,
  });
  sendSuccess(res, 'Provider settlements', result, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const settleRecord = asyncHandler(async (req, res) => {
  const record = await settlementService.settleProviderRecord(
    req.auth!.userId,
    String(req.params.settlementId),
    {
      reference: req.body.reference,
      notes: req.body.notes,
    },
  );
  sendSuccess(res, 'Settlement marked as settled', record);
});
