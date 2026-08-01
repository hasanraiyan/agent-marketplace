import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Developer Platform's own, physically-scoped OpenAPI spec (Phase 12 API-2)
 * — a deliberate second config, not a tag-filtered view of `swagger.config.js`.
 * That distinction is the whole point: `apis` below globs only the 9
 * `developer*.routes.js` files, so a Persona-internal route can never end up
 * in this spec no matter how (or whether) it's tagged. `swagger.config.js`
 * (internal, everything, served at /docs) is untouched by this file.
 *
 * This spec is exported to a static `openapi.json` (see
 * `scripts/export-developer-openapi.js`) for the public Mintlify docs site
 * at `developer-docs/` — it is never served live from this process.
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Persona.ai Developer Platform API',
      version: '1.0.0',
      description:
        "REST + AG-UI API for integrating your product with Persona's agent infrastructure.\n\n" +
        'Every endpoint here is a server-to-server call — see the Integration Guide for where ' +
        'in your own stack to call each one from, and how the same endpoint serves both ' +
        'Project-level and per-end-user requests via the `x-persona-external-user-id` header.',
    },
    servers: [
      {
        url: 'https://api.personaai.com',
        description: 'Production',
      },
    ],
    components: {
      securitySchemes: {
        projectCredential: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: '<keyId>.<secret>',
          description:
            'Developer Platform Project credential, minted via POST /api/v1/projects/{projectId}/credentials. ' +
            'Send as `Authorization: Bearer <keyId>.<secret>`. Optionally pair with the ' +
            "`x-persona-external-user-id` header to act on behalf of one of the Project's own external users. " +
            'This credential is a server-side secret — see the Integration Guide.',
        },
      },
    },
  },
  apis: ['./src/modules/developer/*.routes.js', './src/docs/swagger.schemas.js'],
};

const spec = swaggerJsdoc(options);
export default spec;
