import { Router } from 'express';
import * as homeCarouselController from '@/modules/home-carousel/home-carousel.controller.js';

const router = Router();

router.get('/', homeCarouselController.getHomeCarousel);

export default router;
