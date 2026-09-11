import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  saveDraftSchema,
  runWorkflowSchema,
} from './workflows/workflow.validator.js';
import workflowController from './workflows/workflow.controller.js';

/**
 * Developer Platform Machine / Runtime Workflow routes (Finding #10 in review.md).
 * Mounted at /api/v1/developer/workflows, authenticated by Project credential
 * (developerMachineAuth.middleware.js), with optional x-persona-external-user-id header.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/workflows:
 *   get:
 *     tags: [Developer]
 *     summary: Discover/list Workflows (Project-owned, ExternalUser-owned, or Public)
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: scope
 *         in: query
 *         schema: { type: string, enum: [mine, public, all] }
 *     responses:
 *       200: { description: Paginated list of workflows }
 *       401: { description: Missing or invalid Project credential }
 */
router.get('/', workflowController.list);

/**
 * @openapi
 * /api/v1/developer/workflows:
 *   post:
 *     tags: [Developer]
 *     summary: Create a Workflow (Project-owned or ExternalUser-owned)
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               visibility: { type: string, enum: [private, unlisted, public] }
 *     responses:
 *       201: { description: Workflow created }
 *       400: { description: Validation error }
 */
router.post('/', validateBody(createWorkflowSchema), workflowController.create);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get Workflow by ID
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workflow object }
 *       404: { description: Workflow not found }
 */
router.get('/:workflowId', workflowController.getOne);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}:
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Workflow
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               visibility: { type: string, enum: [private, unlisted, public] }
 *     responses:
 *       200: { description: Workflow updated }
 *       404: { description: Workflow not found }
 */
router.patch('/:workflowId', validateBody(updateWorkflowSchema), workflowController.update);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}:
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Workflow
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workflow deleted }
 *       404: { description: Workflow not found }
 */
router.delete('/:workflowId', workflowController.remove);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/draft:
 *   put:
 *     tags: [Developer]
 *     summary: Save Workflow Draft
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Draft saved }
 *       400: { description: Cycle detected or validation error }
 */
router.put('/:workflowId/draft', validateBody(saveDraftSchema), workflowController.saveDraft);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/publish:
 *   post:
 *     tags: [Developer]
 *     summary: Publish Workflow Version Snapshot
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Version published }
 *       400: { description: Empty workflow or cycle detected }
 */
router.post('/:workflowId/publish', workflowController.publish);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/runs:
 *   post:
 *     tags: [Developer]
 *     summary: Execute a Workflow (live run or dryRun sandbox)
 *     description: >
 *       Triggers execution of a workflow on behalf of a Project machine or external user.
 *       Supports SSE streaming when requested or JSON response.
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input: { type: object }
 *               dryRun: { type: boolean }
 *               version: { type: integer }
 *     responses:
 *       201: { description: Run started or stream attached }
 *       429: { description: Concurrency limit reached }
 */
router.post('/:workflowId/runs', validateBody(runWorkflowSchema), workflowController.run);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/runs:
 *   get:
 *     tags: [Developer]
 *     summary: List Runs for a Workflow
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list of workflow runs }
 */
router.get('/:workflowId/runs', workflowController.listRuns);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/runs/{runId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get Workflow Run Details
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: runId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Run object }
 *       404: { description: Run not found }
 */
router.get('/:workflowId/runs/:runId', workflowController.getRun);

/**
 * @openapi
 * /api/v1/developer/workflows/{workflowId}/runs/{runId}/cancel:
 *   post:
 *     tags: [Developer]
 *     summary: Cancel in-flight Workflow Run
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: runId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Run cancelled }
 */
router.post('/:workflowId/runs/:runId/cancel', workflowController.cancel);

export default router;
