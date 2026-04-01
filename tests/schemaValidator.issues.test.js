import { schemaValidator } from '../src/utils/validators/index.js';
import ValidationError from '../src/utils/errors/ValidationError.js';

const { validateSchema, safeValidateSchema } = schemaValidator;

describe('schemaValidator - non-Zod error fallback', () => {
  test('validateSchema converts non-Zod errors into ValidationError with empty details', () => {
    const badSchema = {
      parse: () => {
        throw new Error('boom');
      },
    };

    let thrown;
    try {
      validateSchema(badSchema, {});
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ValidationError);
    expect(thrown.details).toBeDefined();
    expect(thrown.details.errors).toEqual([]);
    expect(thrown.details.raw).toBeDefined();
    expect(thrown.details.raw.message).toBe('boom');
  });

  test('safeValidateSchema returns success:false and empty details when parse throws non-Zod error', () => {
    const badSchema = {
      parse: () => {
        throw new Error('boom2');
      },
    };
    const res = safeValidateSchema(badSchema, {});
    expect(res.success).toBe(false);
    expect(res.details).toEqual([]);
    expect(res.error).toBeDefined();
    expect(res.error.message).toBe('boom2');
  });
});
