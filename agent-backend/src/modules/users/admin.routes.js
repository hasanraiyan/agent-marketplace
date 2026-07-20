import express from 'express';
import adminController from './admin.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import adminMiddleware from './admin.middleware.js';

const router = express.Router();

router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deleteUser);

export default router;
