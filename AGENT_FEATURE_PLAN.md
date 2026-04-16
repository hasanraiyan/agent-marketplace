# Agent Marketplace — Backend Feature Plan

> **Scope:** Everything that needs to be built inside `agent-backend/` to support
> user-created agents, provider key management, and live agent chat powered by `deep-agent`.
>
> **Do NOT touch:** `deep-agent/` — it runs as a standalone runtime, not modified here.

---

## 1. What We Are Building

| Feature | Summary |
|---------|---------|
| **Providers** | Users save their own LLM API keys + base URLs. Each provider is encrypted at rest. |
| **Agents** | Users create agents with a name, description, system prompt, a chosen provider, and optional web search toggle. |
| **Chat** | Users (or public visitors) send messages to an agent. The backend builds a `createDeepAgent` instance from the agent's config and streams tokens back via SSE. |
| **Web Search** | A per-agent boolean toggle (`webSearchEnabled`). When enabled, `TavilySearch` is injected into the agent's tools at runtime. No sub-agents in MVP. |

---

## 2. New Files Overview

All new files follow the **exact same layer pattern** as `auth`:

```
Model → Repository → Service → Controller → Route → Validator
```

```
agent-backend/src/
│
├── models/
│   ├── Agent.js                   ← NEW
│   ├── Provider.js                ← NEW
│   ├── Conversation.js            ← NEW
│   └── Message.js                 ← NEW
│
├── repositories/
│   ├── agentRepository.js         ← NEW
│   ├── providerRepository.js      ← NEW
│   └── conversationRepository.js  ← NEW
│
├── services/
│   ├── agent.service.js           ← NEW
│   ├── provider.service.js        ← NEW
│   ├── agentRuntime.service.js    ← NEW  (the deep-agent bridge)
│   └── chat.service.js            ← NEW  (SSE streaming logic)
│
├── controllers/
│   ├── agent.controller.js        ← NEW
│   ├── provider.controller.js     ← NEW
│   └── chat.controller.js         ← NEW
│
├── routes/
│   ├── agent.routes.js            ← NEW
│   ├── provider.routes.js         ← NEW
│   └── chat.routes.js             ← NEW
│
├── validators/
│   ├── agent.validator.js         ← NEW
│   └── provider.validator.js      ← NEW
│
└── utils/
    └── crypto.js                  ← NEW  (AES-256-GCM for API key encryption)
```

**Modified files:**
- `src/index.js` — register 3 new routers

---

## 3. Data Models (MongoDB + Zod)

### 3.1 `Agent.js`

**Purpose:** Stores the user's agent configuration.

```js
// Mongoose schema fields
{
  ownerId:          ObjectId,  // ref: 'User', required
  name:             String,    // 2–100 chars, required
  slug:             String,    // auto-generated, unique, url-safe (e.g. "my-research-agent-abc123")
  description:      String,    // optional, max 500 chars
  avatar:           String,    // optional — emoji or URL
  tags:             [String],  // optional — ["coding", "research"]
  systemPrompt:     String,    // required — defines how the agent behaves
  providerId:       ObjectId,  // ref: 'Provider', required
  modelName:        String,    // e.g. "gpt-4o", falls back to provider.defaultModel
  webSearchEnabled: Boolean,   // default: false — checkbox in builder UI
  visibility:       String,    // enum: ['private', 'unlisted', 'public'] — default: 'private'
  category:         String,    // enum: ['productivity', 'coding', 'creative', 'research', 'roleplay', 'other'] — default: 'other'
  messageCount:     Number,    // default: 0 — for marketplace ranking
  isActive:         Boolean,   // default: true
  timestamps:       true
}
```

> **`webSearchEnabled`** — When `true`, the runtime injects `TavilySearch` into the agent's tools.

**Visibility levels explained:**

| Value | Who can chat with the agent | Listed in marketplace? |
|-------|----------------------------|------------------------|
| `private` | Owner only | ❌ No |
| `unlisted` | Any **logged-in** user who has the link (`/a/:slug`) | ❌ No |
| `public` | Any **logged-in** user, findable in marketplace | ✅ Yes |

> **Important:** No visibility level allows unauthenticated (no-token) access. Even `unlisted` requires a valid login. The difference is only about **discoverability** — not about skipping auth.

**Indexes:** `ownerId`, `slug` (unique), `visibility`

**Zod schema** (for validation):
```js
export const VisibilityEnum = z.enum(['private', 'unlisted', 'public']);
export const CategoryEnum = z.enum(['productivity', 'coding', 'creative', 'research', 'roleplay', 'other']);

export const createAgentSchema = z.object({
  name:             z.string().min(2).max(100),
  description:      z.string().max(500).optional(),
  avatar:           z.string().optional(),
  tags:             z.array(z.string()).optional(),
  systemPrompt:     z.string().min(10),
  providerId:       z.string(),
  modelName:        z.string().optional(),
  webSearchEnabled: z.boolean().default(false),
  visibility:       VisibilityEnum.default('private'),
  category:         CategoryEnum.default('other'),
});

export const updateAgentSchema = createAgentSchema.partial();
```

---

### 3.2 `Provider.js`

**Purpose:** Stores a user's LLM provider config. The API key is **always encrypted** before saving to MongoDB.

```js
{
  ownerId:         ObjectId,  // ref: 'User', required
  label:           String,    // "My OpenAI", "Azure East", required
  baseURL:         String,    // https://api.openai.com/v1, required
  apiKeyEncrypted: String,    // AES-256-GCM encrypted, select: false
  defaultModel:    String,    // e.g. "gpt-4o", required
  timestamps:      true
}
```

**Note:** `apiKeyEncrypted` has `select: false` — it is NEVER returned in API responses. It is only fetched when building an agent runtime.

**Zod schema:**
```js
export const createProviderSchema = z.object({
  label:        z.string().min(1).max(100),
  baseURL:      z.string().url(),
  apiKey:       z.string().min(1),      // plain text coming in, encrypted before save
  defaultModel: z.string().min(1),
  isDefault:    z.boolean().default(false),
});
```

---

### 3.3 `Conversation.js`

**Purpose:** Tracks a chat session between a specific user and an agent.

```js
{
  agentId:       ObjectId,  // ref: 'Agent', required
  userId:        ObjectId,  // ref: 'User', required — every conversation is owned by a user
  threadId:      String,    // UUID v4 — used as LangGraph thread_id for memory continuity
  title:         String,    // "First message..." or AI generated
  lastMessageAt: Date,      // for sorting
  isArchived:    Boolean,   // default: false
  timestamps:    true
}
```

**Conversation Ownership Rules:**

| Rule | Detail |
|------|--------|
| **One conversation per user per agent session** | A new conversation is created when the user explicitly starts one (e.g. clicks "New Chat"). |
| **User A cannot access User B's conversation** | The backend always validates `conversation.userId === req.user.id` before returning messages or accepting new ones. |
| **Owner vs other users** | Both the agent owner and other authorized users (unlisted/public agents) create their own **separate** conversations. They do NOT share conversation history. |
| **Conversation list** | `GET /api/v1/chat/conversations?agentId=:id` returns only conversations belonging to `req.user`. |
| **threadId isolation** | Because `threadId` is unique per conversation, LangGraph memory is fully isolated between users. |

---

### 3.4 `Message.js`

**Purpose:** Stores every message in a conversation (user + assistant turns).

```js
{
  conversationId: ObjectId,  // ref: 'Conversation', required
  role:           String,    // enum: ['user', 'assistant']
  content:        String,    // required
  createdAt:      Date
}
```

**Index:** `conversationId + createdAt` (for fetching history in chronological order)

---

## 4. API Routes

### 4.1 Providers — `/api/v1/providers`

All routes require auth (`authMiddleware`).

| Method | Path | Controller fn | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/v1/providers` | `getAll` | List user's providers |
| `POST` | `/api/v1/providers` | `create` | Create new provider |
| `POST` | `/api/v1/providers/:id/test` | `testConnection` | Verify API key/URL works |
| `PUT` | `/api/v1/providers/:id` | `update` | Update provider |
| `DELETE` | `/api/v1/providers/:id` | `remove` | Delete provider |

**Response shape for GET (never returns the raw key):**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "label": "My OpenAI",
      "baseURL": "https://api.openai.com/v1",
      "defaultModel": "gpt-4o",
      "createdAt": "..."
    }
  ]
}
```

---

### 4.2 Agents — `/api/v1/agents`

All agent management routes require auth. The `visibility` field replaces `isPublic`.

| Method | Path | Auth | Controller fn | Description |
|--------|------|------|---------------|-------------|
| `GET` | `/api/v1/agents` | ✅ | `getAll` | List the current user's own agents |
| `POST` | `/api/v1/agents` | ✅ | `create` | Create a new agent |
| `GET` | `/api/v1/agents/:id` | ✅ | `getOne` | Get full agent config — owner only |
| `PUT` | `/api/v1/agents/:id` | ✅ | `update` | Update agent config — owner only |
| `DELETE` | `/api/v1/agents/:id` | ✅ | `remove` | Delete agent — owner only |
| `PATCH` | `/api/v1/agents/:id/visibility` | ✅ | `setVisibility` | Set visibility |
| `GET` | `/api/v1/agents/discover` | ✅ | `discover` | List `public` agents |
| `GET` | `/api/v1/agents/by-slug/:slug` | ✅ | `getBySlug` | Get info by slug |
| `GET` | `/api/v1/agents/:id/stats` | ✅ | `getStats` | Owner stats (message count, use counts) |

**`getBySlug` access control:**
```
private  → 403 unless req.user.id === agent.ownerId
unlisted → 200 if authenticated (any logged-in user with the link)
public   → 200 if authenticated (any logged-in user)
```

**Response for `getBySlug` / `discover`:** Only returns safe fields:
```json
{ "id", "name", "slug", "description", "visibility", "webSearchEnabled", "ownerId", "avatar", "tags" }
```
`systemPrompt`, `providerId`, `modelName` — **never returned** to non-owners.

---

### 4.3 Chat — `/api/v1/chat`

All chat routes require auth (`authMiddleware`).

| Method | Path | Auth | Controller fn | Description |
|--------|------|------|---------------|-------------|
| `POST` | `/api/v1/chat/:agentId/conversations` | ✅ | `startConversation` | Create conversation |
| `GET` | `/api/v1/chat/conversations` | ✅ | `listAllConversations` | List all user's chats |
| `GET` | `/api/v1/chat/conversations?agentId=:id` | ✅ | `listConversations` | List user's chats for agent |
| `DELETE` | `/api/v1/chat/conversations/:id` | ✅ | `deleteConversation` | Remove a chat |
| `POST` | `/api/v1/chat/conversations/:id/messages` | ✅ | `sendMessage` | Send message (SSE) |
| `GET` | `/api/v1/chat/conversations/:id/messages` | ✅ | `getHistory` | Get message history (paginated) |

**Access control for all chat routes:**
```
If agent.visibility === 'private'  → only agent.ownerId can start/access conversations
If agent.visibility === 'unlisted' → any authenticated user can start their own conversation
If agent.visibility === 'public'   → any authenticated user can start their own conversation

For existing conversations: conversation.userId MUST equal req.user.id — no exceptions.
User A can never read, write to, or even know about User B's conversations.
```

---

## 5. The Deep-Agent Runtime Bridge

### 5.1 `utils/crypto.js`

Encrypts/decrypts provider API keys using AES-256-GCM and a `CRYPTO_SECRET` env variable.

```js
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.CRYPTO_SECRET, 'hex'); // 32-byte hex string

export function encryptApiKey(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv:tag:encrypted (all hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored) {
  const [ivHex, tagHex, encHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

**Env variable to add:**
```env
# agent-backend/.env
CRYPTO_SECRET=<64 hex chars = 32 bytes>
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### 5.2 `services/agentRuntime.service.js`

This is the **core bridge** between user config in MongoDB and the live `createDeepAgent` runtime.

```js
import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { MongoDBSaver } from 'langgraph-checkpoint-mongodb'; // Persistent memory
import { TavilySearch } from '@langchain/tavily';
import { decryptApiKey } from '../utils/crypto.js';
import mongoose from 'mongoose';

// In-process cache: cacheKey → compiled agent graph
const runtimeCache = new Map();

// Checkpointer: Shared MongoDB instance for all agents
// Each conversation is isolated by thread_id within the DB
const checkpointer = new MongoDBSaver({
  client: mongoose.connection.getClient(),
  dbName: 'agent-marketplace',
});

// Web search tool — shared instance (stateless, safe to reuse)
const webSearchTool = new TavilySearch({
  maxResults: 5,
  searchDepth: 'advanced',
  name: 'search_web',
  description: 'Search the web for up-to-date information on any topic.',
});

export async function getOrBuildRuntime(agentDoc, providerDoc) {
  const cacheKey = `${agentDoc._id}-${agentDoc.updatedAt.getTime()}`;

  if (runtimeCache.has(cacheKey)) {
    return runtimeCache.get(cacheKey);
  }

  const model = new ChatOpenAI({
    model: agentDoc.modelName || providerDoc.defaultModel,
    apiKey: decryptApiKey(providerDoc.apiKeyEncrypted), // Creator's Key
    configuration: {
      baseURL: providerDoc.baseURL,                    // Creator's Base URL
    },
  });

  // Conditionally inject web search tool based on agent config
  const tools = agentDoc.webSearchEnabled ? [webSearchTool] : [];

  const runtime = await createDeepAgent({
    model,
    tools,
    checkpointer,                      // Now fully persistent!
    systemPrompt: agentDoc.systemPrompt,
  });

  runtimeCache.set(cacheKey, runtime);
  return runtime;
}

// Called when agent config is updated — clears stale cache entries
export function invalidateRuntime(agentId) {
  for (const key of runtimeCache.keys()) {
    if (key.startsWith(String(agentId))) {
      runtimeCache.delete(key);
    }
  }
}
```

---

### 5.3 `services/chat.service.js`

Orchestrates the full chat turn: load docs → stream from runtime → save messages.

```js
import { v4 as uuidv4 } from 'uuid';
import agentRepository from '../repositories/agentRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import conversationRepository from '../repositories/conversationRepository.js';
import messageRepository from '../repositories/messageRepository.js';
import { getOrBuildRuntime } from './agentRuntime.service.js';
import BaseError from '../utils/errors/BaseError.js';

export async function startConversation({ agentId, userId }) {
  const agent = await agentRepository.findById(agentId);

  // Access control: private agents only for owner
  if (!agent.isPublic && String(agent.ownerId) !== String(userId)) {
    throw new BaseError('Agent not found', 404, 'NOT_FOUND');
  }

  const threadId = uuidv4();
  const conversation = await conversationRepository.create({
    agentId,
    userId: userId || null,
    threadId,
  });

  return { conversationId: conversation.id, threadId };
}

export async function* streamChat({ conversationId, userContent, userId }) {
  const conversation = await conversationRepository.findById(conversationId);
  const agent = await agentRepository.findByIdWithOwner(conversation.agentId);
  const provider = await providerRepository.findByIdWithKey(agent.providerId);

  // Access control
  if (!agent.isPublic && String(agent.ownerId) !== String(userId)) {
    throw new BaseError('Forbidden', 403, 'FORBIDDEN');
  }

  // Save user message
  await messageRepository.create({
    conversationId,
    role: 'user',
    content: userContent,
  });

  // Load history
  const history = await messageRepository.findByConversation(conversationId);
  const messages = history.map((m) => ({ role: m.role, content: m.content }));

  // Build / fetch cached runtime
  const runtime = await getOrBuildRuntime(agent, provider);

  // Stream from deep-agent
  let fullResponse = '';
  const stream = await runtime.stream(
    { messages },
    { configurable: { thread_id: conversation.threadId } }
  );

  for await (const chunk of stream) {
    const token = chunk?.messages?.at(-1)?.content ?? '';
    if (token) {
      fullResponse += token;
      yield token;
    }
  }

  // Save assistant message
  await messageRepository.create({
    conversationId,
    role: 'assistant',
    content: fullResponse,
  });
}
```

---

### 5.4 `controllers/chat.controller.js`

Handles SSE headers and pipes the generator to the HTTP response.

```js
import * as chatService from '../services/chat.service.js';
import { successFormatter } from '../utils/formatters/index.js';

export const startConversation = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const userId = req.user?.id || null;
    const data = await chatService.startConversation({ agentId, userId });
    res.status(201).json(successFormatter.formatSuccess(data, 'Conversation started', 201));
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { content } = req.body;
    const userId = req.user?.id || null;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const generator = chatService.streamChat({ conversationId, userContent: content, userId });

    for await (const token of generator) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    // If headers already sent, we can't use next(error) normally
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      next(error);
    }
  }
};

export const getHistory = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const messages = await messageRepository.findByConversation(conversationId);
    res.json(successFormatter.formatSuccess(messages));
  } catch (error) {
    next(error);
  }
};

export default { startConversation, sendMessage, getHistory };
```

---

## 6. Register Routes in `index.js`

```js
// Add these 3 imports to agent-backend/src/index.js
import agentRouter    from './routes/agent.routes.js';
import providerRouter from './routes/provider.routes.js';
import chatRouter     from './routes/chat.routes.js';

// Add these 3 lines after the existing route registrations
app.use('/api/v1/agents',    agentRouter);
app.use('/api/v1/providers', providerRouter);
app.use('/api/v1/chat',      chatRouter);
```

---

## 7. Dependencies to Install

Check if these are already in `agent-backend/package.json`. Install any missing ones:

```bash
# In agent-backend/
pnpm add deepagents @langchain/openai @langchain/langgraph @langchain/tavily langgraph-checkpoint-mongodb uuid
```

**Env variables to add to `agent-backend/.env`:**
```env
CRYPTO_SECRET=<64 hex chars>   # AES-256 key for encrypting provider API keys
TAVILY_API_KEY=tvly-...        # Only needed when any agent has webSearchEnabled: true
```

---

## 8. Build Checklist (in order)

### Phase 1 — Crypto + Models
- [ ] `utils/crypto.js` — `encryptApiKey` / `decryptApiKey`
- [ ] Add `CRYPTO_SECRET` to `.env` and `.env.example`
- [ ] `models/Provider.js` — Mongoose schema + Zod
- [ ] `models/Agent.js` — Mongoose schema + Zod (with slug auto-gen)
- [ ] `models/Conversation.js` — Mongoose schema
- [ ] `models/Message.js` — Mongoose schema

### Phase 2 — Provider Feature
- [ ] `repositories/providerRepository.js` — class, singleton export
- [ ] `validators/provider.validator.js` — Zod `createProviderSchema`, `updateProviderSchema`
- [ ] `services/provider.service.js` — `create`, `getAll`, `update`, `remove`
- [ ] `controllers/provider.controller.js` — `create`, `getAll`, `update`, `remove`
- [ ] `routes/provider.routes.js` — 4 routes, all behind `authMiddleware`

### Phase 3 — Agent Feature
- [ ] `repositories/agentRepository.js` — class, singleton export
- [ ] `validators/agent.validator.js` — Zod `createAgentSchema`, `updateAgentSchema`
- [ ] `services/agent.service.js` — `create`, `getAll`, `getOne`, `update`, `remove`, `toggleShare`
- [ ] `controllers/agent.controller.js` — 7 handlers
- [ ] `routes/agent.routes.js` — 7 routes

### Phase 4 — Chat + Runtime
- [ ] `repositories/conversationRepository.js` — `create`, `findById`, `findByUser`, `updateTitle`, `updateLastMessage`
- [ ] `repositories/messageRepository.js` — `create`, `findByConversation` (paginated)
- [ ] `services/agentRuntime.service.js` — `getOrBuildRuntime`, `invalidateRuntime` (Now uses `MongoDBSaver`)
- [ ] `services/chat.service.js` — `startConversation`, `streamChat` (includes auto-titling logic)
- [ ] `controllers/chat.controller.js` — SSE handler
- [ ] `routes/chat.routes.js` — 6 routes

### Phase 5 — Wire Up
- [ ] Update `src/index.js` to register 3 new routers
- [ ] Call `invalidateRuntime(agentId)` in `agent.service.js` when agent is updated
- [ ] Verify deps installed (`deepagents`, `@langchain/openai`, `@langchain/langgraph`, `uuid`)

---

## 9. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| API key storage | AES-256-GCM, encrypted in DB | User owns their key; we must not expose it |
| Runtime caching | In-process `Map` keyed by `agentId + updatedAt` | Avoids rebuilding LangGraph on every message |
| Chat streaming | SSE (`text/event-stream`) | Works in standard browsers, no WebSocket setup |
| Thread memory | `MongoDBSaver` (Persistent) | Chat history survives server restarts; highly reliable |
| Visibility model | 3-state enum: `private` / `unlisted` / `public` | More expressive than boolean |
| Auth on all chat | All chat routes require login (no anonymous) | Simplifies access control; conversations always have an owner |
| Conversation isolation | `conversation.userId === req.user.id` always enforced | User A's history is never visible to User B, even on the same agent |
| **Budget Model** | **Creator-Pays** (MVP) | Creator's key is used for all chats to ensure model compatibility (prevents bugs caused by guests using weak models) |
| `systemPrompt` privacy | Never returned to non-owners | Protects creator's prompt engineering |
| Web search | `webSearchEnabled` boolean on Agent doc | Checkbox in builder. `TavilySearch` injected conditionally at runtime |
| Marketplace Categorization | 6-item enum field | Organized discovery for `public` agents |
| Sub-agents | **None in MVP** | Removed for simplicity. Can be added in Phase 2 |
| Web search key | Single `TAVILY_API_KEY` on the platform | All web-search-enabled agents share the platform's Tavily key |
| Billing & Quotas | **Deferred** | Out of scope for MVP; will be added when we migrate to platform-wide credits |
