# How to Add a Repository

Repositories handle **data access** — they are the only layer that should interact with Mongoose models.

## Repository Pattern

```javascript
import Model from './<module>.model.js';

class MyRepository {
  // Create
  async create(data) {
    return Model.create(data);
  }

  // Read
  async findById(id) {
    return Model.findById(id);
  }

  async findByOwner(ownerId, skip = 0, limit = 10) {
    return Model.find({ ownerId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async count(filter = {}) {
    return Model.countDocuments(filter);
  }

  // Update
  async update(id, data) {
    return Model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  // Delete
  async delete(id) {
    return Model.findByIdAndDelete(id);
  }

  // Custom queries
  async findByName(name, ownerId) {
    return Model.findOne({ name, ownerId });
  }
}

export default new MyRepository();
```

## Repository Best Practices

### 1. No Business Logic
Repositories should contain only database operations, no business rules.

```javascript
// ✅ Correct
async findActive() {
  return Model.find({ isActive: true });
}

// ❌ Incorrect — business logic in repository
async findActive() {
  // Should only be active if not deleted for more than 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return Model.find({
    $or: [
      { isActive: true },
      { deletedAt: { $gte: cutoff } }
    ]
  });
}
```

### 2. Return Mongoose Documents
Repositories should return raw Mongoose documents. Formatting is the service/controller's job.

### 3. Use Indexes
Ensure queries are covered by MongoDB indexes defined in the model.

### 4. Ownership Filtering
For owned resources, always include `ownerId` in queries:

```javascript
async findByOwnerAndId(ownerId, id) {
  return Model.findOne({ _id: id, ownerId });
}
```

## Standard Repository Methods

| Method | Description |
|--------|-------------|
| `create(data)` | Create a new document |
| `findById(id)` | Find by primary key |
| `findByOwner(ownerId, skip, limit)` | Find all owned by user |
| `count(filter)` | Count matching documents |
| `update(id, data)` | Update document |
| `delete(id)` | Delete document |
| `findOne(filter)` | Find single matching document |
| `find(filter, skip, limit)` | Find with complex filters |
