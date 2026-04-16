import { Router } from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import schemaValidator from '../utils/validators/schemaValidator.js';
import { createSkillSchema, updateSkillSchema } from '../validators/skill.validator.js';
import skillController from '../controllers/skill.controller.js';

const router = Router();

// Publicly searchable skills
router.get('/public', authMiddleware, skillController.getPublicSkills);

// User's own skills
router.get('/', authMiddleware, skillController.getMySkills);

// CRUD
router.post('/', authMiddleware, schemaValidator(createSkillSchema), skillController.create);
router.get('/:id', authMiddleware, skillController.getById);
router.patch('/:id', authMiddleware, schemaValidator(updateSkillSchema), skillController.update);
router.delete('/:id', authMiddleware, skillController.delete);

export default router;
