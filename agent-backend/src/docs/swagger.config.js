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
        'Admin endpoints require the user to have `role: admin`.',
    },
    servers: [
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
      },
    },
  },
  apis: [
    './src/modules/**/*.routes.js',
    './src/docs/swagger.schemas.js',
  ],
};

const spec = swaggerJsdoc(options);
export default spec;
