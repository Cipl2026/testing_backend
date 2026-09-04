import { Router } from 'express';
import * as controller from '@/modules/home-health/home-health.controller.js';

const router = Router();
router.get('/', controller.listAssetTypes);
export default router;
