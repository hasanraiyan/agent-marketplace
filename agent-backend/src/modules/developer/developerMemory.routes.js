import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import developerMemoryController from './developerMemory.controller.js';
import BaseError from '../../utils/errors/BaseError.js';

/**
 * Developer Platform memory API (REQ-3) — full CRUD over a subject's memory
 * files, mirroring the existing Clerk-authenticated /api/v1/memory routes
 * but Project-credential authenticated and scoped to the asserted external
 * user (x-persona-external-user-id), same requirement as
 * developerThread.routes.js/developerAgui.routes.js for the same reason: a
 * memory namespace is per-Subject, and a bare Project credential has no
 * Subject to scope one to.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

router.use((req, res, next) => {
  if (req.projectContext?.principalType !== 'ProjectRuntime') {
    return next(
      new BaseError(
        'Managing memory requires an asserted external user (x-persona-external-user-id)',
        400,
        'EXTERNAL_USER_REQUIRED'
      )
    );
  }
  next();
});

/**
 * @openapi
 * /api/v1/developer/memory:
 *   get:
 *     tags: [Developer]
 *     summary: List all memory files for the asserted external user
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: >
 *           `{ userFiles: MemoryFile[], agentMemories: { agentId, agentName,
 *           files: MemoryFile[] }[] }` — user-global files plus one group
 *           per agent that has agent-scoped memory.
 */
router.get('/', developerMemoryController.list);

/**
 * @openapi
 * /api/v1/developer/memory/file:
 *   get:
 *     tags: [Developer]
 *     summary: Read one memory file
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: path
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: scope
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [user, agent]
 *         description: Defaults to "user". "agent" requires agentId (header x-agent-id or query param).
 *       - name: agentId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The memory file.
 *       404:
 *         description: No file at that path.
 *   put:
 *     tags: [Developer]
 *     summary: Create or overwrite one memory file
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path, content]
 *             properties:
 *               scope: { type: string, enum: [user, agent], description: Defaults to "user". }
 *               agentId: { type: string, description: Required when scope is "agent". }
 *               path: { type: string }
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: The written file.
 *   delete:
 *     tags: [Developer]
 *     summary: Delete one memory file
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: x-persona-external-user-id
 *         in: header
 *         required: true
 *         schema:
 *           type: string
 *       - name: path
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: scope
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [user, agent]
 *       - name: agentId
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted.
 *       404:
 *         description: No file at that path.
 */
router.get('/file', developerMemoryController.getFile);
router.put('/file', developerMemoryController.writeFile);
router.delete('/file', developerMemoryController.removeFile);

export default router;
