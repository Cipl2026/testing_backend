import { z } from 'zod';

export const platformBrandingBodySchema = z.object({
  customerLogoUrl: z.string().url().optional().or(z.literal('')),
  customerLogoDarkUrl: z.string().url().optional().or(z.literal('')),
  providerLogoUrl: z.string().url().optional().or(z.literal('')),
  providerLogoDarkUrl: z.string().url().optional().or(z.literal('')),
  customerAppName: z.string().trim().min(1).max(40).optional(),
  providerAppName: z.string().trim().min(1).max(40).optional(),
});
