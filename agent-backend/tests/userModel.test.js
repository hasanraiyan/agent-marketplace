import { jest } from '@jest/globals';
import { userSchema } from '../src/models/User.js';
import User from '../src/models/User.js';

describe('User Model', () => {
  describe('Zod Schema Validation', () => {
    test('should validate correct user data', () => {
      const validUser = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        isActive: true,
      };

      const result = userSchema.parse(validUser);
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.age).toBe(30);
      expect(result.isActive).toBe(true);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should set default values for optional fields', () => {
      const minimalUser = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      const result = userSchema.parse(minimalUser);
      expect(result.isActive).toBe(true);
      expect(result.age).toBeUndefined();
      expect(result.role).toBe('normal');
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should accept valid role values', () => {
      const userWithAdminRole = {
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = userSchema.parse(userWithAdminRole);
      expect(result.role).toBe('admin');

      const userWithNormalRole = {
        name: 'Normal User',
        email: 'normal@example.com',
        role: 'normal',
      };
      const result2 = userSchema.parse(userWithNormalRole);
      expect(result2.role).toBe('normal');
    });

    test('should reject invalid email', () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    test('should reject name that is too short', () => {
      const invalidUser = {
        name: 'J',
        email: 'john@example.com',
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    test('should reject name that is too long', () => {
      const invalidUser = {
        name: 'J'.repeat(101),
        email: 'john@example.com',
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    test('should reject age outside valid range', () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 200,
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });

    test('should reject invalid role value', () => {
      const invalidUser = {
        name: 'John Doe',
        email: 'john@example.com',
        role: 'superuser',
      };

      expect(() => userSchema.parse(invalidUser)).toThrow();
    });
  });

  describe('Mongoose Schema', () => {
    test('should have required fields', () => {
      const schema = User.schema;

      expect(schema.paths.name).toBeDefined();
      expect(schema.paths.name.instance).toBe('String');
      expect(schema.paths.name.isRequired).toBe(true);

      expect(schema.paths.email).toBeDefined();
      expect(schema.paths.email.instance).toBe('String');
      expect(schema.paths.email.isRequired).toBe(true);
      expect(schema.paths.email.options.unique).toBe(true);

      expect(schema.paths.age).toBeDefined();
      expect(schema.paths.age.instance).toBe('Number');

      expect(schema.paths.isActive).toBeDefined();
      expect(schema.paths.isActive.instance).toBe('Boolean');
      expect(schema.paths.isActive.options.default).toBe(true);

      expect(schema.paths.role).toBeDefined();
      expect(schema.paths.role.instance).toBe('String');
      expect(schema.paths.role.enumValues).toContain('normal');
      expect(schema.paths.role.enumValues).toContain('admin');
      expect(schema.paths.role.options.default).toBe('normal');
    });

    test('should have timestamps', () => {
      const schema = User.schema;
      expect(schema.options.timestamps).toBe(true);
    });

    test('should have toJSON transform', () => {
      const schema = User.schema;
      expect(typeof schema.options.toJSON.transform).toBe('function');
    });

    test('toJSON transform should rename _id to id and remove __v', () => {
      const schema = User.schema;
      const transform = schema.options.toJSON.transform;

      const ret = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test',
        email: 'test@example.com',
        __v: 0,
      };

      const result = transform({}, ret);
      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(result._id).toBeUndefined();
      expect(result.__v).toBeUndefined();
    });

    test('should have toObject transform', () => {
      const schema = User.schema;
      expect(typeof schema.options.toObject.transform).toBe('function');
    });

    test('toObject transform should rename _id to id and remove __v', () => {
      const schema = User.schema;
      const transform = schema.options.toObject.transform;

      const ret = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test',
        email: 'test@example.com',
        __v: 0,
      };

      const result = transform({}, ret);
      expect(result.id).toBe('507f1f77bcf86cd799439011');
      expect(result._id).toBeUndefined();
      expect(result.__v).toBeUndefined();
    });

    test('should have indexes defined', () => {
      const schema = User.schema;
      const indexes = schema.indexes();
      expect(Array.isArray(indexes)).toBe(true);

      const indexFields = indexes.map((idx) => Object.keys(idx[0])[0]);
      expect(indexFields).toContain('email');
      expect(indexFields).toContain('isActive');
      expect(indexFields).toContain('createdAt');
    });

    test('should have auth fields', () => {
      const schema = User.schema;

      expect(schema.paths.password).toBeDefined();
      expect(schema.paths.password.instance).toBe('String');
      expect(schema.paths.password.options.select).toBe(false);

      expect(schema.paths.emailVerified).toBeDefined();
      expect(schema.paths.emailVerified.instance).toBe('Boolean');
      expect(schema.paths.emailVerified.options.default).toBe(false);

      expect(schema.paths.emailVerificationOTP).toBeDefined();
      expect(schema.paths.emailVerificationOTP.options.select).toBe(false);

      expect(schema.paths.emailVerificationOTPExpires).toBeDefined();
      expect(schema.paths.emailVerificationOTPExpires.instance).toBe('Date');
      expect(schema.paths.emailVerificationOTPExpires.options.select).toBe(false);

      expect(schema.paths.passwordResetOTP).toBeDefined();
      expect(schema.paths.passwordResetOTP.options.select).toBe(false);

      expect(schema.paths.passwordResetOTPExpires).toBeDefined();
      expect(schema.paths.passwordResetOTPExpires.instance).toBe('Date');
      expect(schema.paths.passwordResetOTPExpires.options.select).toBe(false);

      expect(schema.paths.refreshToken).toBeDefined();
      expect(schema.paths.refreshToken.options.select).toBe(false);
    });
  });

  describe('Model Static Methods', () => {
    test('should have model name "User"', () => {
      expect(User.modelName).toBe('User');
    });

    test('should have collection name "users"', () => {
      expect(User.collection.name).toBe('users');
    });
  });
});
