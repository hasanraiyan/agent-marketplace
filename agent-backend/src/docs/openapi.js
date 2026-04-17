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
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['normal', 'admin'] },
          emailVerified: { type: 'boolean' },
        },
      },
      RegisterBody: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      LoginBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      ProfileResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          age: { type: 'number', nullable: true },
          isActive: { type: 'boolean' },
          role: { type: 'string', enum: ['normal', 'admin'] },
          emailVerified: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UpdateProfileBody: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          age: { type: 'integer', minimum: 0, maximum: 150 },
        },
      },
      ChangePasswordBody: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  },
  paths: {
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
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterBody' } },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
          400: {
            description: 'Bad request',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout user (requires auth)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Logged out' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/v1/auth/verify-email-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string', format: 'email' }, otp: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'Email verified' }, 400: { description: 'Invalid OTP' } },
      },
    },
    '/api/v1/auth/resend-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Resend verification OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OTP sent' } },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OTP sent' } },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using OTP',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  otp: { type: 'string' },
                  newPassword: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Password reset' } },
      },
    },
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
  },
};

export default openapiSpecification;
