# Encryption Rotation Background Migration Plan

This document captures the planned background migration job for encryption key rotation.
It is intentionally design-only for now because the project does not yet have a database or persistence layer.

## Goal

When encryption keys are rotated, the system should be able to:

- keep decrypting old data with retired-but-still-configured keys
- re-encrypt old records with the current active key
- measure migration progress
- determine when it is safe to remove old keys from `DB_ENCRYPTION_KEYS`

## Current Building Blocks

The current encryption utility already supports the parts needed for rotation-aware reads:

- versioned encrypted tokens that include a key id
- decryption using the token key id
- `needsReencryption(token)` to detect values still encrypted with an older key

Those live in:

- `src/utils/encryption.js`
- `src/config/index.js`
- `scripts/generate-encryption-key.js`

## Future Job Responsibilities

The background migration job should:

1. Load the active encryption config from environment variables.
2. Read records in batches from the database.
3. Identify fields that contain encrypted values.
4. For each encrypted field:
   - skip empty or null values
   - check `needsReencryption(token)`
   - if `false`, count it as `already_current`
   - if `true`, decrypt it, re-encrypt it, and persist the updated token
5. Track progress counters.
6. Print a final summary.

## Required Counters

The job should report at least:

- `scanned`
- `already_current`
- `migrated`
- `skipped`
- `failed`

Optional but useful:

- `batches_processed`
- `elapsed_ms`
- `remaining_old_key_records`

## Safe Completion Rule

It is only safe to remove an old key after:

- a full migration run completes, and
- all encrypted records are either already on the active key or successfully migrated, and
- there are no unresolved failures

Practical rule:

- safe to retire old keys when `failed = 0` and `remaining_old_key_records = 0`

## Recommended Runtime Flow

### Phase 1: Rotation Start

Add a new key and make it active:

```env
DB_ENCRYPTION_ACTIVE_KEY_ID=next
DB_ENCRYPTION_KEYS={"current":"base64:...","next":"base64:..."}
```

At this point:

- new writes use `next`
- old records encrypted with `current` still decrypt normally
- old records should begin returning `true` from `needsReencryption(token)`

### Phase 2: Migration Run

Run the background job against every encrypted record.

For each encrypted field:

1. read stored token
2. if `needsReencryption(token)` is `false`, mark `already_current`
3. if `true`, decrypt with the old key
4. re-encrypt with the current active key
5. update the record
6. mark `migrated`

### Phase 3: Verification

Run the migration job again in dry-run mode.

Expected result:

- `remaining_old_key_records = 0`
- `failed = 0`

### Phase 4: Retire Old Key

Remove the old key from `DB_ENCRYPTION_KEYS` only after verification succeeds.

## Job Modes To Build Later

The future script should support:

- `--dry-run`
- `--batch-size`
- `--limit`
- `--cursor` or equivalent resume support if the chosen database supports it
- optional filtering by collection/table/model

## Data Access Shape To Implement Later

Once the database is chosen, define:

- which tables/collections contain encrypted data
- which fields are encrypted
- how records are paginated in batches
- how updates are applied safely

Suggested abstraction:

- `listEncryptedRecords({ batchSize, cursor })`
- `updateEncryptedRecord({ id, updates })`

That keeps the migration job separate from persistence specifics.

## Planned Mongoose Approach

The current plan is to use Mongoose later.

For Mongoose, the best approach is:

- store encrypted fields as normal `String` values in MongoDB
- store only the encrypted token in the field
- rely on the token prefix and embedded key id to detect encryption state

Example stored value:

```txt
enc:v1:current:iv:tag:ciphertext
```

That gives us:

- encryption detection by checking the `enc:v1:` prefix
- key identification by parsing the token key id
- re-encryption detection via `needsReencryption(token)`

### Recommended Schema Rule

For fields chosen as encrypted fields:

- always write encrypted tokens
- never store plaintext in those fields
- treat plaintext in those fields as invalid application state

That keeps auditing and migration simple.

### Recommended Mongoose Integration

When Mongoose is added, prefer using encryption inside the service or repository layer instead of hiding it deep inside schema setters/getters.

Recommended flow:

1. incoming plaintext enters service/repository code
2. service encrypts the value before saving
3. repository writes the encrypted token to MongoDB
4. repository/service decrypts after reading when the business logic needs plaintext

This is better than automatic schema getters/setters because:

- it keeps encryption explicit
- it makes migration jobs easier to write
- it avoids surprising behavior in queries, lean reads, and serialization

### Suggested Mongoose Migration Pattern

When the database exists, the migration job should:

1. select the target model
2. stream documents with a cursor or paginated `_id` batches
3. inspect each encrypted field
4. if `needsReencryption(token)` is `true`:
   - decrypt
   - re-encrypt with the active key
   - update only that field
5. count the result

Recommended Mongoose building blocks:

- `Model.find()` with projection for only encrypted fields and `_id`
- `.cursor()` for large collections
- `bulkWrite()` for efficient batch updates

### Recommended Update Safety

The safest update pattern in Mongo/Mongoose is:

- read `_id` and the encrypted field value
- compute the new encrypted token
- update with a filter that includes both `_id` and the old encrypted value

Example idea:

```js
await Model.updateOne({ _id: doc._id, secretField: oldToken }, { $set: { secretField: newToken } });
```

That prevents overwriting a value that changed after the job read it.

### Recommended Model Metadata To Add Later

When models are added, keep a central registry of encrypted fields, for example:

```js
const encryptedModels = [
  { model: UserModel, fields: ['ssn', 'phone'] },
  { model: BillingProfileModel, fields: ['accountNumber'] },
];
```

This is much cleaner than scattering migration knowledge across many files.

## Concurrency And Safety Notes

The job should be idempotent.

That means:

- rerunning it should not corrupt data
- records already on the active key should be skipped
- updates should ideally guard against overwriting newer concurrent writes

If the future database supports optimistic locking or version checks, use them.

## Logging Rules

The future migration job should never log:

- plaintext values
- encryption keys
- full encrypted payloads

It may log:

- record ids
- field names
- counters
- failure types/messages

## Suggested Implementation Order

1. Choose the database/persistence layer.
2. Define which models contain encrypted fields.
3. Add a helper that returns decryption metadata if needed.
4. Implement a repository-backed migration job.
5. Add dry-run mode.
6. Add progress reporting.
7. Run migration after the first real key rotation.

## Nice-To-Have Future Improvements

- `decryptWithMetadata(token)` helper returning:
  - `value`
  - `keyId`
  - `needsReencryption`
- structured migration output as JSON for CI/ops tooling
- metrics export for dashboards
- per-model migration summaries

## Decision Summary

Because the project has not added its database yet, the right move now is:

- keep the encryption utility rotation-ready
- keep key generation ready
- save this migration plan for later implementation

When the persistence layer is added, this document should be used as the implementation checklist.
