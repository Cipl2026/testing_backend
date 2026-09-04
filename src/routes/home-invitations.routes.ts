import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-members/home-members.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import { acceptInvitationBodySchema, invitationIdParamSchema } from '@/validators/phase9.js';

const router = Router();

router.get('/pending', authenticate, authorize(UserRole.CUSTOMER), controller.listPendingInvitations);
router.post('/:invitationId/accept', authenticate, authorize(UserRole.CUSTOMER), validateParams(invitationIdParamSchema), validateBody(acceptInvitationBodySchema), controller.acceptInvitation);
router.post('/:invitationId/reject', authenticate, authorize(UserRole.CUSTOMER), validateParams(invitationIdParamSchema), controller.rejectInvitation);

export default router;
