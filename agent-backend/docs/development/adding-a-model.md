# How to Add a Model

Models define the **data schema** and **database structure** for a module.

## Mongoose Model Pattern

```javascript
import mongoose from 'mongoose';

const mySchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      minlength: 2,
      maxlength: 100,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  {
    timestamps: true,    // Adds createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound index
mySchema.index({ ownerId: 1, name: 1 }, { unique: true });

// Virtual property
mySchema.virtual('displayName').get(function () {
  return this.name.charAt(0).toUpperCase() + this.name.slice(1);
});

export default mongoose.model('MyEntity', mySchema);
```

## Model Best Practices

### 1. Owner Reference
If the resource is user-owned, include `ownerId` with an index:

```javascript
ownerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  required: true,
  index: true,
}
```

### 2. Timestamps
Always use `{ timestamps: true }` for automatic `createdAt` / `updatedAt`.

### 3. Indexes
Create indexes for fields used in queries:

| Query Pattern | Index |
|--------------|-------|
| Find by owner | `{ ownerId: 1 }` |
| Find by owner + name | `{ ownerId: 1, name: 1 }` |
| Find unique slug | `{ slug: 1 }` (unique) |
| Find active users | `{ isActive: 1 }` |
| Sort by creation date | `{ createdAt: -1 }` |

### 4. Validation
Add field-level validation in the schema:

```javascript
name: {
  type: String,
  required: [true, 'Name is required'],
  minlength: [2, 'Name must be at least 2 characters'],
  maxlength: [100, 'Name must not exceed 100 characters'],
  match: /^[a-z0-9-]+$/,
}
```

### 5. References
Use ObjectId references for related entities:

```javascript
skills: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Skill',
}],
```

## Zod Schema (Optional)

Some modules also define a Zod schema for validation:

```javascript
import { z } from 'zod';

export const myEntitySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  isActive: z.boolean().default(true),
});
```

## When to Create a Model

Create a model when:
- Your module owns a distinct data entity
- The data has relationships to other entities
- The data needs indexes for query performance
- The data needs field-level validation

If your module doesn't own data (e.g., it's just middleware or an integration), you don't need a model.
