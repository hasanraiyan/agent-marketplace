import healthSwagger from './swagger/health.swagger.js';
import authSwagger from './swagger/auth.swagger.js';
import profileSwagger from './swagger/profile.swagger.js';
import adminSwagger from './swagger/admin.swagger.js';
import agentsSwagger from './swagger/agents.swagger.js';
import chatsSwagger from './swagger/chats.swagger.js';
import skillsSwagger from './swagger/skills.swagger.js';
import schemasSwagger from './swagger/schemas.swagger.js';

const openapiSpecification = {
  openapi: '3.0.0',
  info: {
    title: 'Persona.ai Backend API',
    version: '1.0.0',
    description: 'API documentation for the Persona.ai intelligent agent orchestration platform',
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3000}`, description: 'Local server' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ...schemasSwagger,
    },
  },
  paths: {
    ...healthSwagger,
    ...authSwagger,
    ...profileSwagger,
    ...adminSwagger,
    ...agentsSwagger,
    ...chatsSwagger,
    ...skillsSwagger,
  },
};

export default openapiSpecification;
