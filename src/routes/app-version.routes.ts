import { Router } from 'express';
import * as appVersionController from '@/modules/app-updates/app-version.controller.js';

const router = Router();

router.get('/version', appVersionController.checkVersion);

export default router;
