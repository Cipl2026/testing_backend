import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import { authenticate, authorize } from '@/middleware/auth.js';
import {
  checkLiveness,
  checkReadiness,
  getDetailedHealth,
} from '@/modules/reliability/health-check.service.js';
import { asyncHandler } from '@/utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const liveness = await checkLiveness();
    res.status(200).json({
      success: true,
      message: 'GhaarFix API is running',
      ...liveness,
    });
  }),
);

router.get(
  '/live',
  asyncHandler(async (_req, res) => {
    const liveness = await checkLiveness();
    res.status(200).json({ success: true, ...liveness });
  }),
);

router.get(
  '/liveness',
  asyncHandler(async (_req, res) => {
    const liveness = await checkLiveness();
    res.status(200).json({ success: true, ...liveness });
  }),
);

router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const readiness = await checkReadiness();
    res.status(readiness.ready ? 200 : 503).json({
      success: readiness.ready,
      ...readiness,
    });
  }),
);

router.get(
  '/readiness',
  asyncHandler(async (_req, res) => {
    const readiness = await checkReadiness();
    res.status(readiness.ready ? 200 : 503).json({
      success: readiness.ready,
      ...readiness,
    });
  }),
);

router.get(
  '/detailed',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const health = await getDetailedHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json({
      success: health.status === 'healthy',
      data: health,
    });
  }),
);

export default router;
