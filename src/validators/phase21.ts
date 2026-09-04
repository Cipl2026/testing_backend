import { z } from 'zod';
import { IncidentSeverity, IncidentStatus } from '@ghaarfix/shared-types';

export const incidentBodySchema = z.object({
  title: z.string().min(3).max(200),
  severity: z.nativeEnum(IncidentSeverity),
  impact: z.string().max(1000).optional(),
  affectedServices: z.array(z.string()).optional(),
});

export const incidentUpdateSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  impact: z.string().max(1000).optional(),
  rootCause: z.string().max(2000).optional(),
  followUpActions: z.array(z.string()).optional(),
  timelineMessage: z.string().max(1000).optional(),
});

export const dlqDiscardSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});
