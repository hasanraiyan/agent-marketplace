```
╔════════════════════════════════════════════════════════════════════════════════╗
║             UTILS FOLDER - SOLID PRINCIPLES ARCHITECTURE                       ║
║                      Structure & Design Patterns                               ║
╚════════════════════════════════════════════════════════════════════════════════╝

📁 src/utils/
│
├── 🔴 errors/                          ← OPEN/CLOSED PRINCIPLE
│   ├── BaseError.js                    │ Base abstraction
│   ├── ValidationError.js              │ Extends without modifying
│   ├── NotFoundError.js                │ Extend for new error types
│   └── index.js                        └ Central exports
│
├── 🟠 logger/                          ← DEPENDENCY INVERSION PRINCIPLE
│   ├── ConsoleLogger.js                │ Concrete implementation
│   └── index.js                        │ Abstraction interface
│                                       │ Can swap logger.setLogger()
│
├── 🟡 validators/                      ← SINGLE RESPONSIBILITY PRINCIPLE
│   ├── schemaValidator.js              │ Only validates schema
│   └── index.js                        └ Focused exports
│
├── 🟢 formatters/                      ← INTERFACE SEGREGATION PRINCIPLE
│   ├── successFormatter.js             │ Only formats success
│   ├── errorFormatter.js               │ Only formats errors
│   └── index.js                        └ Separated concerns
│
├── 💙 constants.js                     ← DEPENDENCY INVERSION PRINCIPLE
│   └── Centralized configuration       └ No magic numbers/strings
│
├── 📚 index.js                         ← Central exports
│   └── Re-exports all utilities
│
├── 📖 README.md                        ← Full documentation
├── 📋 EXAMPLES.md                      ← Usage examples
├── 🧪 TESTING.md                       ← Testing patterns
└── 🏗️ ARCHITECTURE.md                  ← This file


═══════════════════════════════════════════════════════════════════════════════
PRINCIPLE BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 OPEN/CLOSED PRINCIPLE - errors/                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ OPEN for extension (create new error types)                            │
│ ✅ CLOSED for modification (don't change BaseError)                       │
│                                                                             │
│ Structure:                                                                 │
│   BaseError (abstract, never modified)                                     │
│      ↑                                                                     │
│      │ extends                                                             │
│      ├─ ValidationError                                                   │
│      ├─ NotFoundError                                                     │
│      └─ [New]CustomError (add without touching base)                      │
│                                                                             │
│ Benefit: Add error types without breaking existing code                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🟠 DEPENDENCY INVERSION PRINCIPLE - logger/                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ Depend on abstraction (loggerService interface)                        │
│ ✅ NOT on implementation (ConsoleLogger)                                  │
│                                                                             │
│ Architecture:                                                              │
│                                                                             │
│   Service Code              Logger Service              Implementations   │
│   ────────────              ───────────────              ───────────────   │
│                                                                            │
│   logger.info()  ──────→  loggerService.getLogger()  ──→ ConsoleLogger   │
│   logger.error()          logger.setLogger()         ──→ FileLogger      │
│                                                      ──→ CloudLogger     │
│                                                      ──→ [New]Logger     │
│                                                                            │
│ Flow:                                                                      │
│   1. Service uses loggerService.getLogger() (abstraction)                 │
│   2. loggerService returns current logger implementation                   │
│   3. Can swap implementation: loggerService.setLogger(new FileLogger())   │
│   4. Services continue working without changes                            │
│                                                                             │
│ Benefit: Swap logger at app startup or test time                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🟡 SINGLE RESPONSIBILITY PRINCIPLE - validators/                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ Each validator handles ONE type                                        │
│ ✅ Each function has ONE reason to change                                 │
│                                                                             │
│ Structure:                                                                 │
│                                                                             │
│   stringValidator          numberValidator          objectValidator       │
│   ───────────────          ──────────────          ─────────────────      │
│   • isNonEmptyString()     • isPositiveNumber()   • hasRequiredFields() │
│   • isValidEmail()         • isNonNegativeNumber()• isValidObject()     │
│   • isValidLength()        • isInRange()          • isEmpty()           │
│                            • isInteger()                                 │
│                                                                             │
│ Why separate?                                                             │
│   • Clear naming (stringValidator.isValidEmail vs validator.email)       │
│   • Import only what needed                                               │
│   • Test each validator independently                                     │
│   • Reuse across projects                                                 │
│                                                                             │
│ Benefit: Easy to understand, test, extend, and reuse                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 🟢 INTERFACE SEGREGATION PRINCIPLE - formatters/                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ Don't force clients to depend on unused methods                        │
│ ✅ Specific, focused interfaces                                           │
│                                                                             │
│ BAD (Fat Interface):                   GOOD (Segregated):                 │
│ ────────────────────                   ──────────────────                 │
│ Formatter                              SuccessFormatter                   │
│  • formatSuccess()                      • formatSuccess()                 │
│  • formatError()                        • formatList()                    │
│  • formatList()                                                            │
│  • formatPagination()                  ErrorFormatter                     │
│  • formatErrorMessage()                 • formatError()                   │
│  • formatValidation()                                                      │
│                                                                             │
│ Usage:                                                                     │
│   ✅ import { successFormatter }       (small, focused)                   │
│   ❌ import { formatter }              (might not need all methods)       │
│                                                                             │
│ Benefit: Only import what you need; minimal dependencies                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 💙 LISKOV SUBSTITUTION PRINCIPLE - Implicit throughout                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ✅ Subtypes are substitutable for their base types                        │
│                                                                             │
│ Errors:                                Loggers:                           │
│   ValidationError                        ConsoleLogger                    │
│   NotFoundError                   can be ConsoleLogger                    │
│   [New]CustomError              ──→     FileLogger                        │
│                                          CloudLogger                       │
│   All can be used where                  (any implementation)             │
│   BaseError is expected                                                    │
│                                                                             │
│ Benefit: Code works with current AND future error/logger types            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
USAGE PATTERNS IN EXISTING CODE
═══════════════════════════════════════════════════════════════════════════════

📄 src/index.js
├─ import { loggerService } from './utils'      ← DIP: depends on abstraction
└─ const logger = loggerService.getLogger()     ← DI: inject at startup

📄 src/controllers/healthController.js
├─ import { successFormatter }                  ← ISP: only need success
├─ import { loggerService }                     ← DIP: inject logger
└─ Uses: successFormatter.formatSuccess()       (DI + formatting)

📄 src/middlewares/errorHandler.js
├─ import { errorFormatter }                    ← ISP: only error formatting
├─ import { loggerService }                     ← DIP: inject logger
└─ Uses: errorFormatter.formatError()           (DI + error handling)


═══════════════════════════════════════════════════════════════════════════════
EXTENSION ROADMAP
═══════════════════════════════════════════════════════════════════════════════

✅ Current Utils:
   ├─ errors/ (base errors)
   ├─ logger/ (console logger)
   ├─ validators/ (string, number, object)
   ├─ formatters/ (success, error)
   └─ constants/ (HTTP status, validation rules)

🚀 Easy to Add (Following SOLID):
   ├─ More Validators
   │  └─ Create dateValidator.js (SRP: just dates)
   │     → Export in validators/index.js
   │
   ├─ More Error Types
   │  └─ Create UnauthorizedError.js extending BaseError (OCP)
   │     → Export in errors/index.js
   │
   ├─ Alternative Logger
   │  └─ Create FileLogger.js (compatible interface)
   │     → loggerService.setLogger(new FileLogger()) at startup
   │
   ├─ More Formatters
   │  └─ Create cacheFormatter.js (ISP: only cache formatting)
   │     → Export in formatters/index.js
   │
   └─ Middleware Helpers
      └─ Create new util files without touching existing code


═══════════════════════════════════════════════════════════════════════════════
TIPS FOR MAINTAINING SOLID PRINCIPLES
═══════════════════════════════════════════════════════════════════════════════

✅ DO:
   • Create specific utilities for specific tasks
   • Extend base classes rather than modify them
   • Use dependency injection
   • Keep interfaces small and focused
   • Centralize configuration in constants
   • Test utilities independently

❌ DON'T:
   • Mix concerns (validation + formatting)
   • Create fat utilities (does too much)
   • Modify existing base classes
   • Hardcode values ("magic numbers")
   • Directly depend on implementations
   • Make utilities tightly coupled

═══════════════════════════════════════════════════════════════════════════════
```
