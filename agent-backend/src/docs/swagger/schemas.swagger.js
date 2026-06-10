export default {
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
};
