import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Persona.ai Backend API',
      version: '1.0.0',
      description:
        'REST API for the Persona.ai intelligent agent orchestration platform.\n\n' +
        'Authentication is handled by **Clerk**. Send the Clerk session token as\n' +
        'an `Authorization: Bearer <token>` header.\n' +
        'Some endpoints (agent search, get) work with optional auth — unauthenticated\n' +
        'requests see only public data.\n' +
        'Admin endpoints require the user to have `role: admin`.\n\n' +
        '**Developer Platform (`/api/v1/developer/*`)** endpoints use a separate ' +
        '`projectCredential` scheme instead of Clerk — see the security scheme below ' +
        'for the wire format. For guidance on *where in your own stack* to call these ' +
        'endpoints from (backend vs. frontend, and how to act on behalf of your own ' +
        'end users), see `docs/developer-api-integration-guide.md` in the repository.',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || 'https://api.persona.hasanraiyan.me',
        description: 'Production API server',
      },
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        clerkAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk session token (send as Bearer token or via __session cookie)',
        },
        projectCredential: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: '<keyId>.<secret>',
          description:
            'Developer Platform Project credential, minted via POST /api/v1/projects/{projectId}/credentials. ' +
            'Send as `Authorization: Bearer <keyId>.<secret>`. Optionally pair with the ' +
            "`x-persona-external-user-id` header to act on behalf of one of the Project's own external users.",
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js', './src/docs/swagger.schemas.js'],
};

const spec = swaggerJsdoc(options);
export default spec;
