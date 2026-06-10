export default {
  '/api/v1/profile': {
    get: {
      tags: ['Profile'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Profile retrieved successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  statusCode: { type: 'number' },
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/ProfileResponse' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized - Invalid or missing token' },
        404: { description: 'User not found' },
      },
    },
    patch: {
      tags: ['Profile'],
      summary: 'Update profile fields',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateProfileBody' },
          },
        },
      },
      responses: {
        200: {
          description: 'Profile updated successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  statusCode: { type: 'number' },
                  message: { type: 'string' },
                  data: { $ref: '#/components/schemas/ProfileResponse' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { description: 'Bad request - Validation error or no fields to update' },
        401: { description: 'Unauthorized' },
        404: { description: 'User not found' },
      },
    },
  },
  '/api/v1/profile/change-password': {
    post: {
      tags: ['Profile'],
      summary: 'Change password',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChangePasswordBody' },
          },
        },
      },
      responses: {
        200: {
          description: 'Password changed successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  statusCode: { type: 'number' },
                  message: { type: 'string' },
                  data: { type: 'null' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { description: 'Bad request - Wrong current password or validation error' },
        401: { description: 'Unauthorized' },
        404: { description: 'User not found' },
      },
    },
  },
  '/api/v1/profile/me': {
    delete: {
      tags: ['Profile'],
      summary: 'Delete own account (soft delete)',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['password'],
              properties: {
                password: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Account deletion scheduled' },
        400: { description: 'Bad request - Wrong password or validation error' },
        401: { description: 'Unauthorized' },
        404: { description: 'User not found' },
      },
    },
  },
};
