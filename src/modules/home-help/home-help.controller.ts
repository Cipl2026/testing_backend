import type { Request, Response } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '@/utils/asyncHandler.js';
import { getHomeHelpCatalog } from '@/modules/home-help/home-help-catalog.service.js';
import { quoteHomeHelpVisit } from '@/modules/home-help/home-help-quote.service.js';
import { createHomeHelpReservation } from '@/modules/home-help/home-help-booking.service.js';
import { createInstantHomeHelpRequest } from '@/modules/home-help/home-help-instant.service.js';
import { discoverHomeHelpProviders } from '@/modules/home-help/home-help-providers.service.js';
import type { homeHelpProvidersQuerySchema } from '@/validators/home-help.js';

type HomeHelpProvidersQuery = z.infer<typeof homeHelpProvidersQuerySchema>;

export const getCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getHomeHelpCatalog();
  res.json({ success: true, message: 'Home Help catalog loaded.', data, meta: null });
});

export const postQuote = asyncHandler(async (req: Request, res: Response) => {
  const data = await quoteHomeHelpVisit(req.body);
  res.json({ success: true, message: 'Home Help quote generated.', data, meta: null });
});

export const postReservation = asyncHandler(async (req: Request, res: Response) => {
  const data = await createHomeHelpReservation(req.auth!.userId, req.body);
  res.status(201).json({ success: true, message: 'Home Help slot reserved.', data, meta: null });
});

export const postInstant = asyncHandler(async (req: Request, res: Response) => {
  const data = await createInstantHomeHelpRequest(req.auth!.userId, req.body);
  res.status(201).json({ success: true, message: 'Instant Home Help search started.', data, meta: null });
});

export const getProviders = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as HomeHelpProvidersQuery;
  const data = await discoverHomeHelpProviders(req.auth!.userId, query);
  res.json({
    success: true,
    message: 'Home Help professionals loaded.',
    data,
    meta: data.meta ?? null,
  });
});
