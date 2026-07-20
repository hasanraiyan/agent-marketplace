import { Router } from 'express';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import memoryController from './memory.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.use(authMiddleware);

// File-based memory: memories are markdown virtual files, the same ones agents
// read/write through their /memories/ filesystem routes.
router.get('/', memoryController.getAll);
router.put('/file', mutateLimiter, memoryController.writeFile);
router.delete('/file', mutateLimiter, memoryController.removeFile);
router.delete('/all', mutateLimiter, memoryController.clearAll);

export default router;
