import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../middlewares/rateLimiter.middleware.js';
import memoryController from '../controllers/memory.controller.js';

const router = Router();
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

router.use(authMiddleware);

router.get('/', memoryController.getAll);
router.post('/', mutateLimiter, memoryController.create);
router.put('/:agentId/:key', mutateLimiter, memoryController.update);
router.delete('/:agentId/:key', mutateLimiter, memoryController.remove);
router.delete('/all', mutateLimiter, memoryController.clearAll);

export default router;
