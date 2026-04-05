import { jest } from '@jest/globals';
import {
  validateRequest,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
} from '../src/middlewares/validationMiddleware.js';
import ValidationError from '../src/utils/errors/ValidationError.js';
import { z } from 'zod';

describe('validationMiddleware', () => {
  describe('validateRequest', () => {
    test('should validate body and replace with validated data', () => {
      const schema = z.object({ name: z.string() });
      const middleware = validateRequest({ body: schema });
      const req = { body: { name: 'Alice' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice' });
    });

    test('should validate query and replace with validated data', () => {
      const schema = z.object({ page: z.number() });
      const middleware = validateRequest({ query: schema });
      const req = { query: { page: 1 } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.query).toEqual({ page: 1 });
    });

    test('should validate params and replace with validated data', () => {
      const schema = z.object({ id: z.string() });
      const middleware = validateRequest({ params: schema });
      const req = { params: { id: '123' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.params).toEqual({ id: '123' });
    });

    test('should validate headers and replace with validated data', () => {
      const schema = z.object({ 'x-api-key': z.string() });
      const middleware = validateRequest({ headers: schema });
      const req = { headers: { 'x-api-key': 'secret' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.headers).toEqual({ 'x-api-key': 'secret' });
    });

    test('should validate multiple parts simultaneously', () => {
      const middleware = validateRequest({
        body: z.object({ email: z.string().email() }),
        query: z.object({ page: z.number().min(1) }),
      });
      const req = {
        body: { email: 'test@example.com' },
        query: { page: 2 },
      };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ email: 'test@example.com' });
      expect(req.query).toEqual({ page: 2 });
    });

    test('should call next with ValidationError when validation fails', () => {
      const middleware = validateRequest({
        body: z.object({ name: z.string() }),
      });
      const req = { body: { name: 123 } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Request validation failed');
      expect(error.details.errors).toBeInstanceOf(Array);
      expect(error.details.errors[0]).toHaveProperty('field', 'body.name');
    });

    test('should accumulate errors from multiple parts', () => {
      const middleware = validateRequest({
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
      const fields = error.details.errors.map((e) => e.field);
      expect(fields).toContain('body.email');
      expect(fields).toContain('query.page');
    });

    test('should handle missing request part by treating as empty object', () => {
      const middleware = validateRequest({
        body: z.object({}),
      });
      const req = {}; // no body property
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      // Since body is missing, it's treated as empty object, which passes validation
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({});
    });

    test('should call next with ValidationError when missing required fields', () => {
      const middleware = validateRequest({
        body: z.object({ name: z.string() }),
      });
      const req = {}; // no body property
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('Request validation failed');
      expect(error.details.errors).toBeInstanceOf(Array);
      expect(error.details.errors[0]).toHaveProperty('field', 'body.name');
    });

    test('should strip unknown fields when stripUnknown option is true', () => {
      const middleware = validateRequest(
        { body: z.object({ name: z.string() }) },
        { stripUnknown: true }
      );
      const req = { body: { name: 'Alice', extra: 'field' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'Alice' });
    });

    test('should not strip unknown fields when stripUnknown option is false', () => {
      const middleware = validateRequest(
        { body: z.object({ name: z.string() }).strict() },
        { stripUnknown: false }
      );
      const req = { body: { name: 'Alice', extra: 'field' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      // strict schema will reject extra fields
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('convenience functions', () => {
    test('validateBody should create middleware that validates body', () => {
      const schema = z.object({ title: z.string() });
      const middleware = validateBody(schema);
      const req = { body: { title: 'Test' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ title: 'Test' });
    });

    test('validateQuery should create middleware that validates query', () => {
      const schema = z.object({ limit: z.number() });
      const middleware = validateQuery(schema);
      const req = { query: { limit: 10 } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.query).toEqual({ limit: 10 });
    });

    test('validateParams should create middleware that validates params', () => {
      const schema = z.object({ userId: z.string() });
      const middleware = validateParams(schema);
      const req = { params: { userId: 'abc123' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.params).toEqual({ userId: 'abc123' });
    });

    test('validateHeaders should create middleware that validates headers', () => {
      const schema = z.object({ authorization: z.string() });
      const middleware = validateHeaders(schema);
      const req = { headers: { authorization: 'Bearer token' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.headers).toEqual({ authorization: 'Bearer token' });
    });

    test('convenience functions should pass options', () => {
      const schema = z.object({ name: z.string() });
      const middleware = validateBody(schema, { stripUnknown: true });
      const req = { body: { name: 'John', extra: 'field' } };
      const res = {};
      const next = jest.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: 'John' });
    });
  });
});
