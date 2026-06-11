---
title: "API-Key Encryption Is Silently Optional — Misconfigured Env Stores Provider Keys in Plaintext; Decrypt Failures Surface as Misleading 'Missing API Key' Errors"
labels: bug, backend, security, encryption, dx
assignees: []
---

## 🔐 Security / DX Report — Encryption Fails Open

### Summary

Provider API keys (users' OpenAI/compatible secrets) are supposed to be AES-256-GCM encrypted at rest. But the entire encryption layer **turns itself off** when the env vars are missing, with no warning:

```js
// agent-backend/src/utils/encryption.js  Line 198-200
export function encrypt(value) {
  if (!enabled) return value;        // ← plaintext written to MongoDB, silently
  ...
}

// Line 213-215
export function decrypt(token) {
  if (!enabled) return token;        // ← and read back as-is
  ...
}
```

`enabled` is true only when **both** `DB_ENCRYPTION_KEYS` and `DB_ENCRYPTION_ACTIVE_KEY_ID` are set. Any developer or deployment that forgets them gets a fully working app that quietly writes **plaintext third-party API keys** into the `providers` collection (`apiKeyEncrypted` field name says encrypted; content isn't). Nothing logs, nothing warns at startup.

### Failure-mode matrix

| Scenario | Behavior today |
|---|---|
| Env never set | Keys stored **plaintext**, silently |
| Env set *after* plaintext rows exist | `decrypt()` is called on a plaintext string → `parseVersionedToken` throws → caught → **returns `null`** |
| Key rotated and old key dropped from keyring | Same — `decrypt()` returns `null` |
| Encrypted in env A, deployed to env B with different keys | Same — `null` |

### The `null` is then misreported to the user

```js
// agent-backend/src/utils/encryption.js  Line 222-227
} catch (err) {
  console.warn('decrypt failed:', errorDetail);   // server console only
  return null;                                    // ← swallowed
}
```

```js
// agent-backend/src/factories/agentFactory.js  Line 63-64, 37-41
const apiKey = encryption.decrypt(provider.apiKeyEncrypted);
this._assertProviderCredentials(provider, apiKey);
// → throws: Provider "X" is missing an API key. Update it in Settings...
```

The user *did* configure a key. They're told it's missing. They re-enter it; if the env is still wrong it breaks again next deploy. There's no path that says "the server cannot decrypt your stored key (encryption key mismatch)".

There is even a `needsReencryption()` helper (Line 182) for detecting plaintext/stale-key tokens — **nothing calls it**.

---

## ✅ Proposed Fix

1. **Fail closed in production:** if `NODE_ENV === 'production'` and encryption is not enabled, throw at startup. In dev, log a loud one-time warning instead of nothing.
2. **Distinguish decrypt failure from missing key:** have `decrypt()` throw a typed `DecryptionError` (or return a sentinel) and make `_assertProviderCredentials` map it to a clear message: *"Stored API key for provider X can't be decrypted — the server encryption key changed. Please re-enter the key."*
3. **Use `needsReencryption()`:** on provider read/update (e.g. in `provider.service.js`), lazily re-encrypt tokens that are plaintext or on a stale key — this is the intended migration path and it's already written.
4. Optional hardening: a startup audit that counts `providers` whose `apiKeyEncrypted` is not a versioned `enc:v1:` token and logs it.

---

## 📁 Files Involved

| File | Change |
|---|---|
| `agent-backend/src/utils/encryption.js` | Fail-closed gate, typed error instead of `return null` |
| `agent-backend/src/factories/agentFactory.js` | Clear user-facing message for decrypt failure |
| `agent-backend/src/services/provider.service.js` | Lazy re-encryption via `needsReencryption()` |
| `agent-backend/src/config/index.js` | Startup validation of encryption env in production |
