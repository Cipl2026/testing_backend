import { Router } from 'express';
import { UserRole } from '@ghaarfix/shared-types';
import * as controller from '@/modules/home-members/home-members.controller.js';
import { authenticate, authorize } from '@/middleware/auth.js';
import { validateBody, validateParams } from '@/middleware/validate.js';
import {
  homeIdParamSchema,
  inviteMemberBodySchema,
  memberIdParamSchema,
  notificationPrefsBodySchema,
  trustedContactBodySchema,
  trustedContactIdParamSchema,
  updateMemberBodySchema,
} from '@/validators/phase9.js';

const router = Router({ mergeParams: true });

router.get('/members', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listMembers);
router.get('/members/activity', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listActivity);
router.post('/members/invite', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(inviteMemberBodySchema), controller.inviteMember);
router.patch('/members/:memberId', authenticate, authorize(UserRole.CUSTOMER), validateParams(memberIdParamSchema), validateBody(updateMemberBodySchema), controller.updateMember);
router.delete('/members/:memberId', authenticate, authorize(UserRole.CUSTOMER), validateParams(memberIdParamSchema), controller.removeMember);
router.get('/trusted-contacts', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listTrustedContacts);
router.post('/trusted-contacts', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(trustedContactBodySchema), controller.createTrustedContact);
router.get('/notification-preferences', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), controller.listNotificationPreferences);
router.patch('/notification-preferences', authenticate, authorize(UserRole.CUSTOMER), validateParams(homeIdParamSchema), validateBody(notificationPrefsBodySchema), controller.updateNotificationPreferences);

export default router;

const trustedRouter = Router();
trustedRouter.patch('/:contactId', authenticate, authorize(UserRole.CUSTOMER), validateParams(trustedContactIdParamSchema), validateBody(trustedContactBodySchema.partial()), controller.updateTrustedContact);
trustedRouter.delete('/:contactId', authenticate, authorize(UserRole.CUSTOMER), validateParams(trustedContactIdParamSchema), controller.deleteTrustedContact);

export { trustedRouter };
