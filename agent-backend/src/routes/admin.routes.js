import express from 'express';
import adminController from '../controllers/admin.controller.js';
import authMiddleware from '../modules/auth/auth.middleware.js';
import adminMiddleware from '../modules/users/admin.middleware.js';

const router = express.Router();

router.get('/users', authMiddleware, adminMiddleware, adminController.listUsers);
router.delete('/users/:id', authMiddleware, adminMiddleware, adminController.deleteUser);

export default router;
