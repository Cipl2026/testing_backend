import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid object id');

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const userRoleSchema = z.enum(['CUSTOMER', 'PROVIDER', 'ADMIN']);

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
","path":"/Users/deependrakumar/Downloads/Ghaarfix/server/shared-validation/src/index.ts"}}]}}
{"role":"assistant","message":{"content":[{"type":"text","text":"[REDACTED]