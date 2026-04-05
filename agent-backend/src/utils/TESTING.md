/\*\*

- TESTING.md - How to test utilities following SOLID principles
  \*/

// ============================================================
// VALIDATOR TESTS (Single Responsibility = Easy to test)
// ============================================================

import { stringValidator, numberValidator } from '../utils/validators';

describe('StringValidator', () => {
describe('isValidEmail', () => {
test('returns true for valid email', () => {
expect(stringValidator.isValidEmail('user@example.com')).toBe(true);
});

    test('returns false for invalid email', () => {
      expect(stringValidator.isValidEmail('invalid-email')).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(stringValidator.isValidEmail('')).toBe(false);
    });

});

describe('isValidLength', () => {
test('returns true within range', () => {
expect(stringValidator.isValidLength('hello', 1, 10)).toBe(true);
});

    test('returns false outside range', () => {
      expect(stringValidator.isValidLength('hello', 1, 3)).toBe(false);
    });

});
});

describe('NumberValidator', () => {
describe('isPositiveNumber', () => {
test('returns true for positive numbers', () => {
expect(numberValidator.isPositiveNumber(5)).toBe(true);
});

    test('returns false for zero', () => {
      expect(numberValidator.isPositiveNumber(0)).toBe(false);
    });

    test('returns false for negative numbers', () => {
      expect(numberValidator.isPositiveNumber(-5)).toBe(false);
    });

});
});

// ============================================================
// ERROR TESTS (Open/Closed = Easily extendable)
// ============================================================

import { ValidationError, NotFoundError } from '../utils/errors';

describe('ValidationError', () => {
test('extends BaseError', () => {
const error = new ValidationError('Invalid input', {
field: 'email',
});
expect(error).toBeInstanceOf(Error);
expect(error.statusCode).toBe(400);
expect(error.code).toBe('VALIDATION_ERROR');
});

test('toJSON includes details', () => {
const error = new ValidationError('Invalid', { field: 'email' });
const json = error.toJSON();
expect(json.details).toEqual({ field: 'email' });
});
});

describe('NotFoundError', () => {
test('returns 404 status code', () => {
const error = new NotFoundError('User not found', 'User');
expect(error.statusCode).toBe(404);
});
});

// ============================================================
// FORMATTER TESTS (Interface Segregation = Focused tests)
// ============================================================

import { successFormatter, errorFormatter } from '../utils/formatters';
import { ValidationError } from '../utils/errors';

describe('SuccessFormatter', () => {
test('formatSuccess creates correct structure', () => {
const result = successFormatter.formatSuccess(
{ id: 1 },
'Test message'
);
expect(result).toHaveProperty('success', true);
expect(result).toHaveProperty('statusCode', 200);
expect(result).toHaveProperty('message', 'Test message');
expect(result).toHaveProperty('data');
expect(result).toHaveProperty('timestamp');
});

test('formatList creates pagination structure', () => {
const items = [{ id: 1 }, { id: 2 }];
const result = successFormatter.formatList(items, 100, 1, 10);
expect(result.data).toHaveProperty('items', items);
expect(result.data).toHaveProperty('pagination');
expect(result.data.pagination.total).toBe(100);
expect(result.data.pagination.pages).toBe(10);
});
});

describe('ErrorFormatter', () => {
test('formats custom errors', () => {
const error = new ValidationError('Invalid input', { field: 'email' });
const result = errorFormatter.formatError(error);
expect(result.success).toBe(false);
expect(result.statusCode).toBe(400);
expect(result.code).toBe('VALIDATION_ERROR');
expect(result.details).toEqual({ field: 'email' });
});

test('formats standard errors', () => {
const error = new Error('Something went wrong');
const result = errorFormatter.formatError(error, 500);
expect(result.success).toBe(false);
expect(result.statusCode).toBe(500);
});
});

// ============================================================
// INTEGRATION TESTS (Service using Utils)
// ============================================================

import { UserService } from '../services/UserService';
import { loggerService } from '../utils/logger';

describe('UserService', () => {
let userService;

beforeEach(() => {
userService = new UserService();
// Can inject mock logger for testing
// loggerService.setLogger(new MockLogger());
});

test('creates user with valid data', () => {
const user = userService.createUser({
email: 'test@example.com',
name: 'John',
});
expect(user).toHaveProperty('id');
expect(user).toHaveProperty('email', 'test@example.com');
});

test('throws ValidationError for invalid email', () => {
expect(() => {
userService.createUser({
email: 'invalid-email',
name: 'John',
});
}).toThrow(ValidationError);
});

test('throws NotFoundError when user not found', () => {
expect(() => {
userService.getUserById(999);
}).toThrow(NotFoundError);
});
});

// ============================================================
// TESTING WITH DEPENDENCY INJECTION (Testability via DIP)
// ============================================================

class MockLogger {
info = jest.fn();
warn = jest.fn();
error = jest.fn();
debug = jest.fn();
}

describe('Service with Injected Logger', () => {
test('logs when user is created', () => {
const mockLogger = new MockLogger();
loggerService.setLogger(mockLogger);

    const service = new UserService();
    service.createUser({ email: 'test@example.com', name: 'John' });

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Creating user',
      expect.objectContaining({ email: 'test@example.com' })
    );

});
});

// ============================================================
// CONTROLLER TESTS (Using formatters)
// ============================================================

import { UserController } from '../controllers/UserController';

describe('UserController', () => {
test('returns formatted success response', () => {
const mockUserService = {
createUser: jest.fn().mockReturnValue({ id: 1, name: 'John' }),
};
const controller = new UserController(mockUserService);

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const req = { body: { email: 'test@example.com', name: 'John' } };

    controller.createUser(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'User created',
      })
    );

});

test('calls next with error on exception', () => {
const mockUserService = {
createUser: jest.fn().mockImplementation(() => {
throw new ValidationError('Invalid input');
}),
};
const controller = new UserController(mockUserService);
const nextHandler = jest.fn();

    controller.createUser(
      { body: {} },
      { status: jest.fn(), json: jest.fn() },
      nextHandler
    );

    expect(nextHandler).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );

});
});

// ============================================================
// KEY TESTING BENEFITS FROM SOLID
// ============================================================

/\*\*

- Single Responsibility:
- - Each module is small and focused
- - Quick to write tests (less cases to cover)
- - Easy to understand what's being tested
-
- Open/Closed:
- - New error types don't break existing tests
- - Can extend validators without modifying tests
-
- Liskov Substitution:
- - Can swap implementations (e.g., logger)
- - Tests work with any valid implementation
-
- Interface Segregation:
- - Mock only what you need
- - Focused, minimal test setup
-
- Dependency Inversion:
- - Inject mocks easily for testing
- - No need to depend on concrete implementations
- - Can test services in isolation
    \*/
