import express from 'express';
import authMiddleware from '../../auth/auth.middleware.js';
import projectAdminAuthMiddleware from '../../auth/projectAdminAuth.middleware.js';
import { validateBody } from '../../../middlewares/validationMiddleware.js';
import rateLimiter, { RATE_LIMITS } from '../../rateLimiter/rateLimiter.middleware.js';
import workflowController from './workflow.controller.js';
import {
  createWorkflowSchema,
  updateWorkflowSchema,
  saveDraftSchema,
  runWorkflowSchema,
} from './workflow.validator.js';

const router = express.Router({ mergeParams: true });
const mutateLimiter = rateLimiter('MUTATE', RATE_LIMITS.MUTATE);

// All workflow routes require authenticated Persona User with Project Admin authority
router.use(authMiddleware);
router.use(projectAdminAuthMiddleware);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows:
 *   get:
 *     tags: [Workflows]
 *     summary: List workflows for a project
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 20 }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *       - name: isEnabled
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of workflows with pagination
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *   post:
 *     tags: [Workflows]
 *     summary: Create a new workflow
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
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
 *               draft: { type: object }
 *     responses:
 *       201:
 *         description: Workflow created successfully
 *       400:
 *         description: Validation error or cycle detected
 *       401:
 *         description: Unauthorized
 */
router.get('/', workflowController.list);
router.post(
  '/',
  mutateLimiter,
  validateBody(createWorkflowSchema),
  workflowController.create
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/runs/{runId}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get a specific workflow run trace
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: runId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow run details with node execution traces
 *       404:
 *         description: Run not found
 */
router.get('/runs/:runId', workflowController.getRun);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/runs/{runId}/resume:
 *   get:
 *     tags: [Workflows]
 *     summary: Resume or re-attach to an in-flight workflow run stream (SSE)
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: runId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: sinceSeq
 *         in: query
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Replayed and live SSE stream of AG-UI events
 *       404:
 *         description: Run not found
 */
router.get('/runs/:runId/resume', workflowController.resume);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/runs/{runId}/cancel:
 *   post:
 *     tags: [Workflows]
 *     summary: Cancel an in-flight workflow run
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: runId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow run cancelled
 *       404:
 *         description: Run not found
 */
router.post('/runs/:runId/cancel', mutateLimiter, workflowController.cancel);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get a workflow by ID
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow details with active draft
 *       404:
 *         description: Workflow not found
 *   patch:
 *     tags: [Workflows]
 *     summary: Update workflow metadata or draft
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
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
 *               isEnabled: { type: boolean }
 *               draft: { type: object }
 *     responses:
 *       200:
 *         description: Workflow updated
 *       400:
 *         description: Validation error or cycle detected
 *   delete:
 *     tags: [Workflows]
 *     summary: Delete a workflow
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Workflow deleted
 */
router.get('/:workflowId', workflowController.getOne);
router.patch(
  '/:workflowId',
  mutateLimiter,
  validateBody(updateWorkflowSchema),
  workflowController.update
);
router.delete('/:workflowId', mutateLimiter, workflowController.remove);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/draft:
 *   put:
 *     tags: [Workflows]
 *     summary: Save workflow canvas draft
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
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
 *             required: [draft]
 *             properties:
 *               draft: { type: object }
 *     responses:
 *       200:
 *         description: Draft saved successfully
 *       400:
 *         description: Cycle detected or invalid graph
 */
router.put(
  '/:workflowId/draft',
  mutateLimiter,
  validateBody(saveDraftSchema),
  workflowController.saveDraft
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/publish:
 *   post:
 *     tags: [Workflows]
 *     summary: Publish workflow draft as an immutable version
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Workflow version published
 *       400:
 *         description: Empty draft or cycle detected
 */
router.post('/:workflowId/publish', mutateLimiter, workflowController.publish);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/versions:
 *   get:
 *     tags: [Workflows]
 *     summary: List published versions of a workflow
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of versions
 */
router.get('/:workflowId/versions', workflowController.listVersions);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/versions/{version}:
 *   get:
 *     tags: [Workflows]
 *     summary: Get a specific published version of a workflow
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: version
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Published version snapshot
 *       404:
 *         description: Version not found
 */
router.get('/:workflowId/versions/:version', workflowController.getVersion);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/mermaid:
 *   get:
 *     tags: [Workflows]
 *     summary: Export workflow as Mermaid flowchart markdown
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Mermaid flowchart string
 */
router.get('/:workflowId/mermaid', workflowController.getMermaid);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/run:
 *   post:
 *     tags: [Workflows]
 *     summary: Trigger a workflow run (supports live production or dryRun)
 *     description: Executes workflow with streaming AG-UI events (SSE) or JSON result
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: dryRun
 *         in: query
 *         required: false
 *         schema: { type: boolean }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input: { type: object }
 *               dryRun: { type: boolean }
 *               isDryRun: { type: boolean }
 *               version: { type: integer }
 *     responses:
 *       200:
 *         description: SSE event stream of AG-UI execution telemetry
 *       201:
 *         description: Non-streaming run initialization metadata
 *       400:
 *         description: Validation error
 *       402:
 *         description: Insufficient credits
 *       429:
 *         description: Concurrency limit exceeded
 */
router.post(
  '/:workflowId/run',
  mutateLimiter,
  validateBody(runWorkflowSchema),
  workflowController.run
);

/**
 * @openapi
 * /api/v1/projects/{projectId}/workflows/{workflowId}/runs:
 *   get:
 *     tags: [Workflows]
 *     summary: List runs for a workflow
 *     security: [{ clerkAuth: [] }]
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: workflowId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: status
 *         in: query
 *         schema: { type: string }
 *       - name: isDryRun
 *         in: query
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of workflow runs
 */
router.get('/:workflowId/runs', workflowController.listRuns);

export default router;
