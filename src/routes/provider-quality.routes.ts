import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/provider-quality/provider-quality.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { uploadMiddleware } from '@/middleware/upload.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  submitSkillBodySchema,
  submitVerificationBodySchema,
  verificationIdParamSchema,
} from '@/validators/phase9.js';

const router = Router();

router.get('/verifications', authenticate, authorize(UserRole.PROVIDER), controller.listVerifications);
router.post('/verifications', authenticate, authorize(UserRole.PROVIDER), validateBody(submitVerificationBodySchema), controller.submitVerification);
router.post('/verifications/:id/documents', authenticate, authorize(UserRole.PROVIDER), validateParams(verificationIdParamSchema), uploadMiddleware.single('file'), controller.uploadVerificationDocument);
router.get('/skills', authenticate, authorize(UserRole.PROVIDER), controller.listSkills);
router.post('/skills', authenticate, authorize(UserRole.PROVIDER), uploadMiddleware.single('file'), validateBody(submitSkillBodySchema), controller.submitSkill);
router.get('/performance', authenticate, authorize(UserRole.PROVIDER), controller.getPerformance);

export default router;
