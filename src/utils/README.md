# Utils Folder - SOLID Architecture

This folder contains reusable utilities organized following **SOLID principles** for maintainability, extensibility, and testability.

## 📁 Folder Structure

```
utils/
├── errors/            → Custom error classes (Open/Closed Principle)
├── logger/            → Logger service (Dependency Inversion)
├── validators/        → Input validation (Single Responsibility)
├── formatters/        → Response formatting (Interface Segregation)
├── constants.js       → App configuration (Dependency Inversion)
└── index.js           → Central exports
```

---

## 🏗️ SOLID Principles Applied

### **S - Single Responsibility Principle**

Each module has **one reason to change**.

- ✅ `schemaValidator.js` - Provides schema-based validation using Zod
- ✅ `successFormatter.js` - Only formats successful responses
- ✅ `errorFormatter.js` - Only formats error responses

```javascript
// ✅ GOOD: Single responsibility - schema validator handles validation logic
import { schemaValidator } from './utils/validators';
const { z } = schemaValidator;
const userSchema = z.object({
  email: z.string().email(),
  age: z.number().positive(),
});
schemaValidator.validateSchema(userSchema, data);

// ❌ BAD: Multiple responsibilities in one file
import { validateEverything } from './utils/validators';
validateEverything(email, age, data);
```

---

### **O - Open/Closed Principle**

Classes are **open for extension**, **closed for modification**.

- ✅ `BaseError` - Base class for custom errors
- ✅ `ValidationError` extends `BaseError` - New error type without modifying base
- ✅ `NotFoundError` extends `BaseError` - Another error type without changes

```javascript
// ✅ GOOD: Extend BaseError without modifying it
import { BaseError } from './utils/errors';

class CustomError extends BaseError {
  constructor(message) {
    super(message, 400, 'CUSTOM_CODE');
  }
}
```

---

### **L - Liskov Substitution Principle**

Subtypes are **substitutable** for their base types.

- ✅ All custom errors extend `BaseError` and can be used interchangeably
- ✅ Any logger implementation can replace `ConsoleLogger`

```javascript
// ✅ GOOD: Logger interface is consistent
const logger = loggerService.getLogger();
logger.info('message'); // Works with any logger implementation
logger.error('message', error);
```

---

### **I - Interface Segregation Principle**

Clients depend on **specific, focused interfaces**, not fat ones.

- ✅ `successFormatter` - Only success-related methods
- ✅ `errorFormatter` - Only error-related methods
- ✅ `stringValidator` - Only string validation methods
- ✅ Each validator is importable separately

```javascript
// ✅ GOOD: Import only what you need
import { stringValidator } from './utils/validators';
stringValidator.isValidEmail(email); // Don't need to import numberValidator

// ❌ BAD: Forcing dependency on everything
import validator from './utils/validators';
validator.everything(); // Fat interface
```

---

### **D - Dependency Inversion Principle**

Depend on **abstractions**, not concrete implementations.

- ✅ `loggerService` - Inject any logger implementation
- ✅ `constants` - Centralize config values
- ✅ `errors` - Use error abstractions, not strings

```javascript
// ✅ GOOD: Using abstraction (error interface)
throw new ValidationError('Invalid input', { field: 'email' });

// ✅ GOOD: Using injected logger
const logger = loggerService.getLogger();
logger.info('User created');

// ❌ BAD: Direct string errors and console logs
throw new Error('Invalid input');
console.log('User created');
```

---

## 📖 Usage Examples

### **Errors**

```javascript
import { ValidationError, NotFoundError } from './utils/errors';

// Throw specific, structured errors
throw new ValidationError('Email is invalid', { field: 'email' });
throw new NotFoundError('User not found', 'User');
```

### **Validators**

```javascript
import { stringValidator, numberValidator, objectValidator } from './utils/validators';

stringValidator.isValidEmail(email); // true/false
numberValidator.isPositiveNumber(5); // true/false
objectValidator.hasRequiredFields(obj, ['id', 'name']); // true/false
```

### **Formatters**

```javascript
import { successFormatter, errorFormatter } from './utils/formatters';

// Success response
res.json(successFormatter.formatSuccess(userData, 'User fetched'));

// Error response
res.status(error.statusCode).json(errorFormatter.formatError(error));
```

### **Logger Service**

```javascript
import { loggerService } from './utils';

const logger = loggerService.getLogger();
logger.info('Server started', { port: 3000 });
logger.error('DB connection failed', err);
logger.debug('Query executed', { query: 'SELECT * FROM users' });
```

### **Constants**

```javascript
import { constants } from './utils';

const { HTTP_STATUS, VALIDATION, ERROR_CODES } = constants;
res.status(HTTP_STATUS.BAD_REQUEST).json({ code: ERROR_CODES.VALIDATION_ERROR });
```

---

## 🧪 Testing

Each module is **testable** due to SOLID design:

```javascript
// ✅ Easy to test: No side effects, pure functions
import { stringValidator } from './utils/validators';

test('isValidEmail returns true for valid email', () => {
  expect(stringValidator.isValidEmail('test@example.com')).toBe(true);
});
```

---

## 🔧 Extending the Utils

### Adding a New Validator

```javascript
// src/utils/validators/dateValidator.js
const isValidDate = (value) => !isNaN(Date.parse(value));

export default { isValidDate };
```

Then update `src/utils/validators/index.js`:

```javascript
export { default as dateValidator } from './dateValidator.js';
```

### Adding a New Error Type

```javascript
// src/utils/errors/UnauthorizedError.js
import BaseError from './BaseError.js';

class UnauthorizedError extends BaseError {
  constructor(message) {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export default UnauthorizedError;
```

---

## ✨ Benefits

| Principle | Benefit                                                   |
| --------- | --------------------------------------------------------- |
| **SRP**   | Easy to understand, test, and maintain each module        |
| **OCP**   | Add new errors/validators without modifying existing code |
| **LSP**   | Swap implementations (e.g., logger) seamlessly            |
| **ISP**   | Import only needed functionality, cleaner dependencies    |
| **DIP**   | Loose coupling, easier testing and mocking                |

---

## 🏆 Advantages of Using Zod Over Bespoke Validation

The migration from custom validators (`stringValidator`, `numberValidator`, `objectValidator`) to a schema‑based validation library (Zod) brings multiple tangible benefits:

| Aspect                | Bespoke Validation                                                   | Zod‑Based Validation                                                |
| --------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Development Time**  | Each validator must be written, tested, and maintained from scratch. | Leverages a mature, feature‑rich library with ready‑to‑use schemas. |
| **Maintainability**   | Changes require updating multiple files; risk of inconsistency.      | Centralized schema definitions; changes propagate automatically.    |
| **Security**          | Custom regexes and logic may have edge‑case vulnerabilities.         | Built‑in sanitization, type coercion, and robust parsing.           |
| **Community Support** | No external updates, bug fixes, or security patches.                 | Active community, regular updates, and extensive documentation.     |
| **Type Safety**       | Manual type checking; no compile‑time guarantees.                    | TypeScript‑first design with automatic type inference.              |
| **Error Handling**    | Basic error messages; limited detail.                                | Rich, structured error objects with field‑level messages and codes. |
| **Extensibility**     | Adding new validation rules requires modifying existing code.        | Extensible via schema composition, refinement, and transformation.  |
| **Performance**       | Optimized only as much as the custom implementation.                 | Highly optimized parsing engine used by thousands of projects.      |
| **Integration**       | Must build middleware and request validation manually.               | Pre‑built middleware patterns and seamless Express integration.     |

### Key Benefits Realized in This Project

1. **Reduced Code Volume** – Removed three separate validator files, replacing them with a single, reusable `schemaValidator`.
2. **Enhanced Validation Capabilities** – Zod supports complex schemas (nested objects, arrays, unions, literals) that would be cumbersome to implement manually.
3. **Automatic Error Transformation** – Zod validation errors are automatically mapped to our existing `ValidationError` class, preserving consistent error formatting.
4. **Future‑Proofing** – As Zod evolves, the project gains new validation features without additional development effort.
5. **Improved Developer Experience** – Developers can define schemas declaratively and get immediate feedback via TypeScript types (if used).

### When to Consider a Custom Validator

While libraries like Zod cover the vast majority of use cases, a custom validator may still be justified for:

- Extremely performance‑critical validation where every microsecond counts.
- Validation rules that depend on external systems (database lookups, third‑party APIs).
- Legacy systems that cannot introduce new dependencies.

For this project, Zod provides the optimal balance of robustness, maintainability, and development speed.

---

## 📝 Summary

This utils structure provides:

- ✅ Clear organization
- ✅ Reusable components
- ✅ Easy testing
- ✅ Extensible architecture
- ✅ Consistent error handling
- ✅ Centralized configuration
- ✅ Professional logging
