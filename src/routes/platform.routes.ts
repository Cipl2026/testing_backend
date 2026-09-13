import { Router } from 'express';
import * as platformBrandingController from '@/modules/platform/platform-branding.controller.js';

const router = Router();

router.get('/branding', platformBrandingController.getPublicBranding);

export default router;
