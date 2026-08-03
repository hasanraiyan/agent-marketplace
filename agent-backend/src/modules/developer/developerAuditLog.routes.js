import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import developerAuditLogController from './developerAuditLog.controller.js';

/**
 * Developer Platform audit log read routes (Feature 6). Reuses the
 * existing `AuditLog` model/write path as-is — this is a read-only
 * addition, no changes to `auditLog.service.js`'s `record()` or any
 * resource service.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/audit-logs:
 *   get:
 *     tags: [Developer]
 *     summary: List this Project's audit log (control-plane only)
 *     description: >
 *       Control-plane only, mirroring Providers' own design — a
 *       ProjectRuntimeContext request (external user asserted) gets a
 *       silent empty result, not an error, since there is no
 *       per-ExternalUser audit trail concept.
 *
 *       Covers Project-lifecycle events only (credential minted/revoked,
 *       membership added/removed, suspended/restored, deletion
 *       requested/cancelled/completed) — does NOT cover resource CRUD
 *       (Agent/Skill/Knowledge/Provider/MCP create/update/delete aren't
 *       logged here yet).
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: eventType
 *         in: query
 *         schema: { type: string }
 *         description: Optional exact-match filter, e.g. "credential.created".
 *     responses:
 *       200: { description: "{ items: AuditLogEntry[], pagination: { total, page, limit, pages } }" }
 */
router.get('/', developerAuditLogController.list);

export default router;
