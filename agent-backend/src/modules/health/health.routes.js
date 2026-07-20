import express from 'express';
import healthController from './health.controller.js';

const router = express.Router();

router.get('/', healthController.getHealth);
router.get('/db', healthController.getDbHealth);

export default router;
