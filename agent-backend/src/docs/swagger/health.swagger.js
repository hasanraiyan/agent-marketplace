export default {
  '/api/v1/health': {
    get: {
      tags: ['Health'],
      summary: 'Server health',
      responses: { 200: { description: 'Server is healthy' } },
    },
  },
  '/api/v1/health/db': {
    get: {
      tags: ['Health'],
      summary: 'Database health',
      responses: {
        200: { description: 'Database connected' },
        503: { description: 'Database disconnected' },
      },
    },
  },
};
