export default {
  '/api/v1/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'List all users (admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'isActive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
      ],
      responses: {
        200: { description: 'Users listed' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden - Admin access required' },
      },
    },
  },
  '/api/v1/admin/users/{id}': {
    delete: {
      tags: ['Admin'],
      summary: 'Permanently delete a user (admin only)',
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        200: { description: 'User permanently deleted' },
        400: { description: 'Bad request - Cannot delete own account' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden - Admin access required' },
        404: { description: 'User not found' },
      },
    },
  },
};
