import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/intelligence/intelligence.controller.js';
import { noopMiddleware } from '@/middleware/noop.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  analysisIdParamSchema,
  analyzeIssueBodySchema,
  assistantMessageBodySchema,
  confirmActionBodySchema,
  submitFeedbackBodySchema,
} from '@/validators/phase14.js';
import { z } from 'zod';
import { objectIdSchema } from '@ghaarfix/validation';

const router = Router();

const aiRateLimit = noopMiddleware;

const homeIdParams = z.object({ homeId: objectIdSchema });
const assetIdParams = z.object({ assetId: objectIdSchema });

router.post(
  '/intelligence/issues/analyze',
  authenticate,
  authorize(UserRole.CUSTOMER),
  aiRateLimit,
  validateBody(analyzeIssueBodySchema),
  controller.analyzeIssue,
);

router.get(
  '/intelligence/analysis/:id',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(analysisIdParamSchema),
  controller.getAnalysis,
);

router.post(
  '/intelligence/analysis/:id/feedback',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(analysisIdParamSchema),
  validateBody(submitFeedbackBodySchema),
  controller.submitAnalysisFeedback,
);

router.get(
  '/intelligence/recommendations/home/:homeId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(homeIdParams),
  controller.getHomeRecommendations,
);

router.get(
  '/intelligence/recommendations/asset/:assetId',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateParams(assetIdParams),
  controller.getAssetRecommendations,
);

router.post(
  '/assistant/messages',
  authenticate,
  authorize(UserRole.CUSTOMER),
  aiRateLimit,
  validateBody(assistantMessageBodySchema),
  controller.sendAssistantMessage,
);

router.get(
  '/assistant/conversations',
  authenticate,
  authorize(UserRole.CUSTOMER),
  controller.listAssistantConversations,
);

router.post(
  '/assistant/actions/confirm',
  authenticate,
  authorize(UserRole.CUSTOMER),
  validateBody(confirmActionBodySchema),
  controller.confirmAssistantAction,
);

export default router;
