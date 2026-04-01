import { jest } from '@jest/globals';
import { schemaValidator } from '../src/utils/validators/index.js';
import ValidationError from '../src/utils/errors/ValidationError.js';

const { validateSchema, safeValidateSchema, createValidator, schemas, z } = schemaValidator;

describe('schemaValidator', () => {
  describe('validateSchema', () => {
    test('should validate correct data and return validated data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const data = { name: 'John', age: 30 };
      const result = validateSchema(schema, data);
      expect(result).toEqual(data);
    });

    test('should throw ValidationError on invalid data', () => {
      const schema = z.object({
        email: z.string().email(),
      });
      expect(() => validateSchema(schema, { email: 'invalid' })).toThrow(ValidationError);
    });

    test('should include error details in ValidationError', () => {
      const schema = z.object({
        email: z.string().email(),
      });
      try {
        validateSchema(schema, { email: 'invalid' });
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toBeDefined();
        expect(error.details.errors).toBeInstanceOf(Array);
        expect(error.details.errors[0]).toHaveProperty('field', 'email');
        expect(error.details.errors[0]).toHaveProperty('message');
      }
    });

    test('should strip unknown fields when stripUnknown option is true', () => {
      const schema = z.object({
        name: z.string(),
      });
      const data = { name: 'John', extra: 'field' };
      const result = validateSchema(schema, data, { stripUnknown: true });
      expect(result).toEqual({ name: 'John' });
      expect(result).not.toHaveProperty('extra');
    });

    test('should not strip unknown fields when stripUnknown option is false (default)', () => {
      const schema = z
        .object({
          name: z.string(),
        })
        .strict();
      const data = { name: 'John', extra: 'field' };
      expect(() => validateSchema(schema, data, { stripUnknown: false })).toThrow(ValidationError);
    });

    test('should validate nested objects', () => {
      const schema = z.object({
        user: z.object({
          id: z.number(),
          email: z.string().email(),
        }),
      });
      const data = { user: { id: 1, email: 'test@example.com' } };
      const result = validateSchema(schema, data);
      expect(result).toEqual(data);
    });

    test('should validate arrays', () => {
      const schema = z.object({
        tags: z.array(z.string()),
      });
      const data = { tags: ['js', 'ts'] };
      const result = validateSchema(schema, data);
      expect(result).toEqual(data);
    });

    test('should validate optional fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const data = { name: 'John' };
      const result = validateSchema(schema, data);
      expect(result).toEqual(data);
    });

    test('should validate nullable fields', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });
      const data = { value: null };
      const result = validateSchema(schema, data);
      expect(result).toEqual(data);
    });

    test('should throw on invalid nested data', () => {
      const schema = z.object({
        user: z.object({
          email: z.string().email(),
        }),
      });
      expect(() => validateSchema(schema, { user: { email: 'invalid' } })).toThrow(ValidationError);
    });
  });

  describe('safeValidateSchema', () => {
    test('should return success true with validated data', () => {
      const schema = z.object({ count: z.number() });
      const result = safeValidateSchema(schema, { count: 5 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ count: 5 });
    });

    test('should return success false with error details on invalid data', () => {
      const schema = z.object({ count: z.number() });
      const result = safeValidateSchema(schema, { count: 'not a number' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.details).toBeInstanceOf(Array);
      expect(result.details[0]).toHaveProperty('field', 'count');
    });

    test('should strip unknown fields when stripUnknown option is true', () => {
      const schema = z.object({ name: z.string() });
      const data = { name: 'John', extra: 'field' };
      const result = safeValidateSchema(schema, data, { stripUnknown: true });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John' });
    });

    test('should not strip unknown fields when stripUnknown option is false', () => {
      const schema = z.object({ name: z.string() }).strict();
      const data = { name: 'John', extra: 'field' };
      const result = safeValidateSchema(schema, data, { stripUnknown: false });
      expect(result.success).toBe(false);
      expect(result.details).toBeInstanceOf(Array);
      // Zod may represent unknown key errors with empty path; ensure the unknown key is reported
      const hasExtra = result.details.some(
        (d) => d.field === 'extra' || (d.message && d.message.includes('extra'))
      );
      expect(hasExtra).toBe(true);
    });

    test('should include error details for multiple errors', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });
      const result = safeValidateSchema(schema, { email: 'invalid', age: 15 });
      expect(result.success).toBe(false);
      expect(result.details).toHaveLength(2);
      expect(result.details.map((d) => d.field)).toEqual(expect.arrayContaining(['email', 'age']));
    });
  });

  describe('createValidator', () => {
    test('should return a function that validates data', () => {
      const schema = z.object({ id: z.number() });
      const validator = createValidator(schema);
      const data = { id: 42 };
      const result = validator(data);
      expect(result).toEqual(data);
    });

    test('should throw ValidationError when validation fails', () => {
      const schema = z.object({ id: z.number() });
      const validator = createValidator(schema);
      expect(() => validator({ id: 'not a number' })).toThrow(ValidationError);
    });

    test('should pass options to validateSchema', () => {
      const schema = z.object({ name: z.string() });
      const validator = createValidator(schema, { stripUnknown: true });
      const data = { name: 'John', extra: 'field' };
      const result = validator(data);
      expect(result).toEqual({ name: 'John' });
    });
  });

  describe('schemas', () => {
    test('nonEmptyString should reject empty strings', () => {
      const schema = schemas.nonEmptyString;
      expect(() => validateSchema(schema, '')).toThrow();
      expect(() => validateSchema(schema, 'hello')).not.toThrow();
      expect(() => validateSchema(schema, 123)).toThrow();
    });

    test('email should validate email format', () => {
      const schema = schemas.email;
      expect(() => validateSchema(schema, 'test@example.com')).not.toThrow();
      expect(() => validateSchema(schema, 'invalid')).toThrow();
      expect(() => validateSchema(schema, 'missing@')).toThrow();
    });

    test('password should enforce minimum length', () => {
      const schema = schemas.password;
      expect(() => validateSchema(schema, 'short')).toThrow();
      expect(() => validateSchema(schema, 'longenoughpassword')).not.toThrow();
    });

    test('url should validate URL format', () => {
      const schema = schemas.url;
      expect(() => validateSchema(schema, 'https://example.com')).not.toThrow();
      expect(() => validateSchema(schema, 'not-a-url')).toThrow();
    });

    test('uuid should validate UUID format', () => {
      const schema = schemas.uuid;
      expect(() => validateSchema(schema, '123e4567-e89b-12d3-a456-426614174000')).not.toThrow();
      expect(() => validateSchema(schema, 'invalid')).toThrow();
    });

    test('positiveNumber should reject non-positive numbers', () => {
      const schema = schemas.positiveNumber;
      expect(() => validateSchema(schema, 5)).not.toThrow();
      expect(() => validateSchema(schema, -1)).toThrow();
      expect(() => validateSchema(schema, 0)).toThrow();
      expect(() => validateSchema(schema, 3.14)).not.toThrow();
    });

    test('nonNegativeNumber should allow zero and positive numbers', () => {
      const schema = schemas.nonNegativeNumber;
      expect(() => validateSchema(schema, 0)).not.toThrow();
      expect(() => validateSchema(schema, 10)).not.toThrow();
      expect(() => validateSchema(schema, -0.1)).toThrow();
    });

    test('integer should reject non-integers', () => {
      const schema = schemas.integer;
      expect(() => validateSchema(schema, 42)).not.toThrow();
      expect(() => validateSchema(schema, 3.14)).toThrow();
      expect(() => validateSchema(schema, -5)).not.toThrow();
    });

    test('range should enforce min and max', () => {
      const rangeSchema = schemas.range(1, 10);
      expect(() => validateSchema(rangeSchema, 5)).not.toThrow();
      expect(() => validateSchema(rangeSchema, 0)).toThrow();
      expect(() => validateSchema(rangeSchema, 11)).toThrow();
      expect(() => validateSchema(rangeSchema, 1)).not.toThrow();
      expect(() => validateSchema(rangeSchema, 10)).not.toThrow();
    });

    test('objectId should validate 24 hex characters', () => {
      const schema = schemas.objectId;
      expect(() => validateSchema(schema, '507f1f77bcf86cd799439011')).not.toThrow();
      expect(() => validateSchema(schema, '507f1f77bcf86cd79943901')).toThrow(); // 23 chars
      expect(() => validateSchema(schema, '507f1f77bcf86cd799439011g')).toThrow(); // non-hex
    });

    test('dateString should validate ISO datetime', () => {
      const schema = schemas.dateString;
      expect(() => validateSchema(schema, '2023-01-01T00:00:00Z')).not.toThrow();
      expect(() => validateSchema(schema, '2023-01-01T00:00:00+05:30')).not.toThrow();
      expect(() => validateSchema(schema, 'invalid')).toThrow();
    });

    test('optional should make schema optional', () => {
      const base = z.string();
      const optionalSchema = schemas.optional(base);
      expect(() => validateSchema(optionalSchema, undefined)).not.toThrow();
      expect(() => validateSchema(optionalSchema, 'present')).not.toThrow();
      expect(() => validateSchema(optionalSchema, null)).toThrow(); // null is not undefined
    });

    test('nullable should allow null', () => {
      const base = z.string();
      const nullableSchema = schemas.nullable(base);
      expect(() => validateSchema(nullableSchema, null)).not.toThrow();
      expect(() => validateSchema(nullableSchema, 'string')).not.toThrow();
      expect(() => validateSchema(nullableSchema, undefined)).toThrow();
    });

    test('arrayOf should create array schema', () => {
      const itemSchema = z.number();
      const arraySchema = schemas.arrayOf(itemSchema);
      expect(() => validateSchema(arraySchema, [1, 2, 3])).not.toThrow();
      expect(() => validateSchema(arraySchema, [1, 'two'])).toThrow();
      expect(() => validateSchema(arraySchema, 'not array')).toThrow();
    });
  });

  describe('validateRequest middleware', () => {
    // Since validateRequest is a factory that returns middleware,
    // we can test it by simulating Express req/res/next.
    test('should validate request body and replace with validated data', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({ name: z.string() }),
      });
      const req = { body: { name: 'Alice' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice' });
    });

    test('should call next with ValidationError when validation fails', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({ name: z.string() }),
      });
      const req = { body: { name: 123 } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    test('should validate multiple request parts', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({ email: z.string().email() }),
        query: z.object({ page: z.number().min(1) }),
      });
      const req = {
        body: { email: 'test@example.com' },
        query: { page: 1 },
      };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ email: 'test@example.com' });
      expect(req.query).toEqual({ page: 1 });
    });

    test('should accumulate errors from multiple parts', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({ email: z.string().email() }),
        query: z.object({ page: z.number() }),
      });
      const req = {
        body: { email: 'invalid' },
        query: { page: 'not a number' },
      };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.details.errors).toHaveLength(2);
    });

    test('should error when request part is missing', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({}),
      });
      const req = {}; // no body property
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.details.errors[0].field).toBe('body');
    });

    test('should strip unknown fields by default', () => {
      const middleware = schemaValidator.validateRequest({
        body: z.object({ name: z.string() }),
      });
      const req = { body: { name: 'Alice', extra: 'field' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice' });
    });
  });

  describe('module exports and re-exports', () => {
    test('module namespace exports match `schemaValidator`', async () => {
      const validatorsModule = await import('../src/utils/validators/index.js');
      const exported = validatorsModule.schemaValidator;
      expect(exported.validateSchema).toBe(schemaValidator.validateSchema);
      expect(exported.safeValidateSchema).toBe(schemaValidator.safeValidateSchema);
      expect(exported.createValidator).toBe(schemaValidator.createValidator);
      expect(exported.schemas).toBe(schemaValidator.schemas);
      expect(exported.validateRequest).toBe(schemaValidator.validateRequest);

      const reZ = exported.z;
      expect(reZ).toBe(schemaValidator.z);
      const s = reZ.object({ a: reZ.number() });
      expect(() => schemaValidator.validateSchema(s, { a: 1 })).not.toThrow();
      expect(() => schemaValidator.validateSchema(s, { a: 'x' })).toThrow();
    });
  });
});
