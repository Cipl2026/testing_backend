import { createApiClient, revokeApiClient, rotateApiKey } from '@/modules/globalization/partner.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { sendSuccess } from '@/utils/apiResponse.js';

export const createClient = asyncHandler(async (req, res) => {
  const { client, apiKey } = await createApiClient(req.body);
  sendSuccess(
    res,
    'API client created. Store the API key securely — it will not be shown again.',
    { id: client._id.toString(), name: client.name, scopes: client.scopes, keyPrefix: client.keyPrefix, apiKey },
    201,
  );
});

export const rotateKey = asyncHandler(async (req, res) => {
  const { apiKey, keyPrefix } = await rotateApiKey(String(req.params.id));
  sendSuccess(res, 'API key rotated', { keyPrefix, apiKey });
});

export const revokeClient = asyncHandler(async (req, res) => {
  await revokeApiClient(String(req.params.id));
  sendSuccess(res, 'API client revoked', { revoked: true });
});
