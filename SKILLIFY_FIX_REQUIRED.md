# Action needed: 2 fixes in your Persona tools integration

**File affected:** `src/lib/skilify/persona-tools.js`
**Symptom:** `get_learner_profile`, `get_notebook`, `get_next_action`, `youtube_search`, etc. failing
with errors like `Error calling skillify__get_next_action: Project secret not found`.

We found two separate bugs. Both need fixing. Good news: the second one now has a simpler fix
than before — you no longer need to reference any secret ID at all.

---

## 1. Update the package

```bash
npm install @personaai/sdk@^0.7.1
```

This version adds the simplified auth behavior described in fix #2 below.

---

## 2. Fix your headers — they're currently being silently dropped

`JSON_HEADERS` is defined as a **function**, but `defineRestTool`'s `headers` option needs a
**plain object** (whose values can themselves be functions, per key).

```js
// ❌ Current — headers is a function, not an object
const JSON_HEADERS = (t) => ({
  'X-Skilify-External-User-Id': t.externalUserId,
  'Content-Type': 'application/json',
});
```

```js
// ✅ Fixed — a plain object, one callback per key
const JSON_HEADERS = {
  'X-Skilify-External-User-Id': (t) => t.externalUserId,
  'Content-Type': 'application/json',
};
```

Because of this mismatch, **none of your headers have actually been sent** on any of the 9 tools
so far — including `X-Skilify-External-User-Id`, which your `/api/skilify-tools/*` endpoints
presumably rely on to know which learner is asking. It failed silently (no error), so this has
likely been broken since the integration went live, independent of the secret error below.

---

## 3. Simplify auth — remove `secretRef` entirely

You don't need to name a secret ID at all. Your REST Tool Source already has a secret configured
in Studio (the "tool group" level) — as of `@personaai/sdk@^0.7.1`, a tool can just declare that it
needs auth, with no ID:

```js
// ❌ Current — secretRef is not a real Persona secret ID
const TOOLS_AUTH = { type: 'bearerSecret', secretRef: 'skilify-tools' };
```

```js
// ✅ Fixed — no secretRef at all
const TOOLS_AUTH = { type: 'bearerSecret' };
```

Keep `auth: TOOLS_AUTH` exactly as-is on all 9 tool definitions — nothing else changes there. At
call time, since none of your tools set their own `secretRef`, Persona automatically uses the
secret already saved on your REST Tool Source.

<details>
<summary>Why <code>secretRef: 'skilify-tools'</code> failed</summary>

`secretRef` has to be a real Persona-generated secret ID (a Mongo ObjectId, e.g.
`507f1f77bcf86cd799439011`) — not a name or label you choose yourself. `'skilify-tools'` isn't a
real ID, so every call trying to resolve it failed. The new fallback avoids this whole class of
mistake: just omit the field.

</details>

> **Important:** the fallback only kicks in when `secretRef` is *completely absent* from the
> object. A placeholder string — even the old `'skilify-tools'` — is treated as "use this exact
> ID," not as "no secret set," and will keep failing. Removing the key entirely (as shown above)
> is what makes the fallback apply.

---

## Summary checklist

- [ ] `npm install @personaai/sdk@^0.7.1`
- [ ] `JSON_HEADERS` is a plain object with per-key callbacks, not a function
- [ ] `TOOLS_AUTH` is `{ type: 'bearerSecret' }` — the `secretRef` key is gone, not just emptied
- [ ] Redeploy
- [ ] Re-test all 9 tools in a live conversation (not just Test Connection in Studio — Test
      Connection only checks the manifest fetch, never an individual tool's own auth)

**No dashboard changes needed on your end** — the secret you already added to the REST Tool Source
is exactly what will be used once the code above is fixed.
