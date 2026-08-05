import express from 'express';
import developerMachineAuthMiddleware from '../auth/developerMachineAuth.middleware.js';
import { validateBody } from '../../middlewares/validationMiddleware.js';
import { createStoreSchema, updateStoreSchema } from '../stores/store.validator.js';
import developerStoreController from './developerStore.controller.js';

/**
 * Developer Store CRUD — named, scoped mount points a developer can create
 * and assign to Agents (Agent.storeMounts), generalizing the fixed
 * /memories/user//memories/agent/ mounts. Config CRUD works with a bare
 * Project credential (a Store's config isn't per-founder); file CRUD only
 * requires x-persona-external-user-id when the target store's own `scope`
 * is `externalUser` — enforced in the controller, not here, since it
 * depends on which store is being addressed.
 */
const router = express.Router();

router.use(developerMachineAuthMiddleware);

/**
 * @openapi
 * /api/v1/developer/stores:
 *   post:
 *     tags: [Developer]
 *     summary: Create a named Store
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, scope]
 *             properties:
 *               name: { type: string, description: "lowercase letters, numbers, hyphens only" }
 *               description: { type: string }
 *               scope: { type: string, enum: [domain, externalUser] }
 *               accessMode: { type: string, enum: [readonly, readwrite], default: readwrite }
 *     responses:
 *       201: { description: Store created }
 *       409: { description: A Store with this exact name already exists }
 *   get:
 *     tags: [Developer]
 *     summary: List this Project's Stores
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer }
 *       - name: limit
 *         in: query
 *         schema: { type: integer }
 *       - name: search
 *         in: query
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{ items: Store[], pagination: { total, page, limit, pages } }" }
 */
router.post('/', validateBody(createStoreSchema), developerStoreController.create);
router.get('/', developerStoreController.discover);

/**
 * @openapi
 * /api/v1/developer/stores/{storeId}:
 *   get:
 *     tags: [Developer]
 *     summary: Get a Store's config
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: Store }
 *       404: { description: Store not found }
 *   patch:
 *     tags: [Developer]
 *     summary: Update a Store's name/description/accessMode (scope is immutable)
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: Updated Store }
 *       404: { description: Store not found }
 *       409: { description: Another Store with this name already exists }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete a Store — also removes it from every Agent that mounted it and purges its data
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: Store deleted }
 *       404: { description: Store not found }
 */
router.get('/:storeId', developerStoreController.getOne);
router.patch('/:storeId', validateBody(updateStoreSchema), developerStoreController.update);
router.delete('/:storeId', developerStoreController.remove);

/**
 * @openapi
 * /api/v1/developer/stores/{storeId}/files:
 *   get:
 *     tags: [Developer]
 *     summary: List files in a Store
 *     description: >
 *       For an externalUser-scoped store, requires x-persona-external-user-id
 *       and lists only that founder's own partition — never another
 *       founder's data, even to the same Project credential.
 *     security: [{ projectCredential: [] }]
 *     responses:
 *       200: { description: "{ files: StoreFile[] }" }
 *       400: { description: Store requires x-persona-external-user-id but none was asserted }
 *       404: { description: Store not found }
 */
router.get('/:storeId/files', developerStoreController.listFiles);

/**
 * @openapi
 * /api/v1/developer/stores/{storeId}/file:
 *   get:
 *     tags: [Developer]
 *     summary: Read one file from a Store
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: path
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The file }
 *       404: { description: Store or file not found }
 *   put:
 *     tags: [Developer]
 *     summary: Create or overwrite one file in a Store
 *     description: >
 *       Not gated by the Store's accessMode — readonly only blocks an
 *       Agent's own tool calls (write_file/edit_file) at mount time; this
 *       is how a readonly store's content actually gets populated.
 *     security: [{ projectCredential: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path, content]
 *             properties:
 *               path: { type: string }
 *               content: { type: string }
 *     responses:
 *       201: { description: The written file }
 *   delete:
 *     tags: [Developer]
 *     summary: Delete one file from a Store
 *     security: [{ projectCredential: [] }]
 *     parameters:
 *       - name: path
 *         in: query
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Store or file not found }
 */
router.get('/:storeId/file', developerStoreController.getFile);
router.put('/:storeId/file', developerStoreController.writeFile);
router.delete('/:storeId/file', developerStoreController.removeFile);

export default router;
