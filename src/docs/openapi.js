const openapiSpecification = {
  openapi: '3.0.0',
  info: {
    title: 'Agent Marketplace Backend API',
    version: '1.0.0',
    description: 'API documentation for the Agent Marketplace backend',
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
  },
};

export default openapiSpecification;
