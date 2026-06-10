export default {
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
};
