import { z } from 'zod';

const optionalApiUrl = z
  .string()
  .trim()
  .url({ message: 'Enter a valid URL (e.g. https://api.example.com or http://192.168.1.10:8008/api/v1)' })
  .optional()
  .or(z.literal(''));

export const platformBrandingBodySchema = z.object({
  customerLogoUrl: z.string().url().optional().or(z.literal('')),
  customerLogoDarkUrl: z.string().url().optional().or(z.literal('')),
  providerLogoUrl: z.string().url().optional().or(z.literal('')),
  providerLogoDarkUrl: z.string().url().optional().or(z.literal('')),
  customerAppName: z.string().trim().min(1).max(40).optional(),
  providerAppName: z.string().trim().min(1).max(40).optional(),
  customerApiUrl: optionalApiUrl,
  providerApiUrl: optionalApiUrl,
});
