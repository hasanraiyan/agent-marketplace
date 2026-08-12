import express from 'express';
import profileController from './profile.controller.js';
import authMiddleware from '../auth/auth.middleware.js';
import rateLimiter, { RATE_LIMITS } from '../rateLimiter/rateLimiter.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { updateProfileSchema, markOnboardingSeenSchema } from './profile.validator.js';

const router = express.Router();

const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

/**
 * @openapi
 * /api/v1/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get authenticated user profile
 *     description: Returns the current user's profile including name, email, role, and preferences.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized — missing or invalid Clerk session
 *   patch:
 *     tags: [Profile]
 *     summary: Update profile fields
 *     description: Updates the authenticated user's profile information (name, preferences, etc.).
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Display name for the user
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   delete:
 *     tags: [Profile]
 *     summary: Delete own account
 *     description: Permanently deletes the user account and all associated data — agents, threads, providers, skills, MCP servers, knowledge bases, memories, and uploaded files.
 *     security: [{ clerkAuth: [] }]
 *     responses:
 *       200:
 *         description: Account permanently deleted
 *       401:
 *         description: Unauthorized
 */
router.get('/', authMiddleware, profileController.getProfile);
router.patch(
  '/',
  authMiddleware,
  mutateLimiter,
  validateBody(updateProfileSchema),
  profileController.updateProfile
);

router.delete('/', authMiddleware, mutateLimiter, profileController.deleteProfile);

/**
 * @openapi
 * /api/v1/profile/onboarding:
 *   post:
 *     tags: [Profile]
 *     summary: Mark a first-run onboarding tour section as seen
 *     description: Idempotent — marks a section (e.g. "dashboard", "studio") as completed or skipped so its guided tour doesn't resurface on later visits.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [section]
 *             properties:
 *               section:
 *                 type: string
 *                 enum: [dashboard, studio, developer]
 *     responses:
 *       200:
 *         description: Updated onboardingSeen list
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/onboarding',
  authMiddleware,
  mutateLimiter,
  validateBody(markOnboardingSeenSchema),
  profileController.markOnboardingSeen
);

export default router;
