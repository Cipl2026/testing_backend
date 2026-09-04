import { Router, type Request } from 'express';
import * as postServiceController from '@/modules/post-service/post-service.controller.js';

const router = Router();

router.get('*', (req: Request & { params: { fileKey?: string } }, res, next) => {
  const fileKey = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  if (!fileKey) {
    res.status(404).json({ success: false, message: 'File not found', data: null });
    return;
  }
  req.params.fileKey = fileKey;
  void postServiceController.serveFile(req, res, next);
});

export default router;
