/\*\*

- EXAMPLES.md - Usage examples for all utils
- This demonstrates SOLID principles in action
  \*/

// ============================================================
// 1. USING SCHEMA VALIDATOR (Single Responsibility Principle)
// ============================================================

import { schemaValidator } from './validators/index.js';
import { z } from 'zod';

// Define a schema for user validation
const userSchema = z.object({
email: z.string().email('Invalid email format'),
name: z.string().min(1, 'Name is required').max(255),
age: z.number().int().positive('Age must be a positive integer'),
});

// Validate data against schema
const validatedUser = schemaValidator.validateSchema(userSchema, {
email: 'user@example.com',
name: 'John',
age: 30,
}); // returns validated data

// Safe validation (doesn't throw)
const result = schemaValidator.safeValidateSchema(userSchema, { email: 'invalid' });
if (!result.success) {
console.log(result.details); // array of validation errors
}

// Use common schemas
const { schemas } = schemaValidator;
const emailSchema = schemas.email;
const positiveSchema = schemas.positiveNumber;

// ============================================================
// 2. USING CUSTOM ERRORS (Open/Closed Principle)
// ============================================================

import { ValidationError, NotFoundError, BaseError } from './errors/index.js';

// Extend without modifying base class
try {
if (!isValidEmail(email)) {
throw new ValidationError('Invalid email format', { field: 'email' });
}
} catch (err) {
console.log(err.toJSON()); // Structured error response
}

// ============================================================
// 3. USING LOGGER (Dependency Inversion Principle)
// ============================================================

import { loggerService } from './logger/index.js';

const logger = loggerService.getLogger();

logger.info('User created', { userId: 123 });
logger.error('Database connection failed', error);
logger.warn('Memory usage high', { usage: '85%' });
logger.debug('Query executed', { query: 'SELECT \* FROM users' });

// Can inject different logger implementation:
// loggerService.setLogger(new FileLogger());
// loggerService.setLogger(new CloudLogger());

// ============================================================
// 4. USING FORMATTERS (Interface Segregation Principle)
// ============================================================

import {
successFormatter,
errorFormatter,
} from './formatters/index.js';

// Success formatter - only for success responses
const successResponse = successFormatter.formatSuccess(
{ userId: 1, name: 'John' },
'User fetched successfully'
);
res.json(successResponse);

// List formatter - specific for paginated data
const listResponse = successFormatter.formatList(
users,
totalCount,
page,
limit
);
res.json(listResponse);

// Error formatter - only for error responses
const errorResponse = errorFormatter.formatError(
new ValidationError('Invalid input'),
400
);
res.status(400).json(errorResponse);

// ============================================================
// 5. USING CONSTANTS (Dependency Inversion Principle)
// ============================================================

import { constants } from './index.js';

const { HTTP_STATUS, VALIDATION, ERROR_CODES } = constants;

// No magic numbers scattered in code
res.status(HTTP_STATUS.OK).json(data);

// Centralized validation rules
if (name.length < VALIDATION.MIN_STRING_LENGTH) {
throw new ValidationError('Name too short');
}

// ============================================================
// COMPLETE EXAMPLE: Service using all utils
// ============================================================

import { schemaValidator } from './validators/index.js';
import { ValidationError, NotFoundError } from './errors/index.js';
import { loggerService } from './logger/index.js';
import { constants } from './index.js';

// Define user schema using Zod (exported as z from schemaValidator)
const { z } = schemaValidator;
const userSchema = z.object({
email: z.string().email('Invalid email format'),
name: z.string().min(1, 'Name is required').max(255),
age: z.number().int().positive('Age must be a positive integer'),
});

class UserService {
constructor() {
this.logger = loggerService.getLogger();
}

createUser(userData) {
// Validate using schema validator (SRP)
// This will throw ValidationError automatically if validation fails
const validated = schemaValidator.validateSchema(userSchema, userData);

    // Use constants (DIP)
    if (validated.age < constants.VALIDATION.MIN_PASSWORD_LENGTH) {
      throw new ValidationError('Age invalid');
    }

    // Log using injected logger (DIP)
    this.logger.info('Creating user', { email: validated.email });

    // Simulate DB insert
    const user = { id: 1, ...validated };

    this.logger.info('User created successfully', { userId: user.id });
    return user;

}

getUserById(id) {
// Validate ID using schema
const idSchema = z.number().int().positive();
try {
schemaValidator.validateSchema(idSchema, id);
} catch (error) {
throw new ValidationError('Invalid user ID', { field: 'id' });
}

    // Simulate DB query
    const user = null;

    if (!user) {
      throw new NotFoundError('User not found', 'User');
    }

    this.logger.info('User retrieved', { userId: id });
    return user;

}
}

// ============================================================
// CONTROLLER using Service (Clean separation)
// ============================================================

class UserController {
constructor(userService) {
this.userService = userService;
this.logger = loggerService.getLogger();
}

createUser(req, res, next) {
try {
const user = this.userService.createUser(req.body);
res
.status(HTTP_STATUS.CREATED)
.json(successFormatter.formatSuccess(user, 'User created'));
} catch (err) {
// Errors propagate to error middleware
next(err);
}
}
}

// ============================================================
// Response Examples
// ============================================================

// Success Response:
// {
// "success": true,
// "statusCode": 200,
// "message": "User fetched successfully",
// "data": { "id": 1, "name": "John", "email": "john@example.com" },
// "timestamp": "2024-03-26T10:30:45.123Z"
// }

// Error Response:
// {
// "success": false,
// "statusCode": 400,
// "message": "Invalid email",
// "code": "VALIDATION_ERROR",
// "details": { "field": "email" },
// "timestamp": "2024-03-26T10:30:45.123Z"
// }

// List Response:
// {
// "success": true,
// "statusCode": 200,
// "message": "Data retrieved successfully",
// "data": {
// "items": [...],
// "pagination": {
// "total": 100,
// "page": 1,
// "limit": 10,
// "pages": 10
// }
// },
// "timestamp": "2024-03-26T10:30:45.123Z"
// }
