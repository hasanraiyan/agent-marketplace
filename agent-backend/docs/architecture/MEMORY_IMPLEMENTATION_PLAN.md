# Implementation Plan: AI Memory Persistence & Personalization

This document outlines the step-by-step roadmap to implement persistent, production-grade memory in the **Agent-Marketplace** repository.

---

## Phase 1: Persistent Long-Term Agent Store (LangGraph Store)

Currently, `globalStore` in `agentFactory.js` uses `InMemoryStore`, which resets on server restarts. We will replace this with a custom MongoDB-backed store implementing LangGraph's `BaseStore` interface.

### Step 1.1: Create the MongoDB Store

Create a new file [agent-backend/src/utils/mongoStore.js](file:///D:/projects/agent-marketplace/agent-backend/src/utils/mongoStore.js) to store agent-level long-term state:

```javascript
import { BaseStore } from '@langchain/langgraph';

export class MongoDBStore extends BaseStore {
  constructor({ client, dbName, collectionName = 'agent_memories' }) {
    super();
    this.client = client;
    this.dbName = dbName;
    this.collectionName = collectionName;
  }

  getCollection() {
    const db = this.dbName ? this.client.db(this.dbName) : this.client.db();
    return db.collection(this.collectionName);
  }

  // Retrieve a namespace-key pair
  async get(namespace, key) {
    const coll = this.getCollection();
    const doc = await coll.findOne({ namespace, key });
    return doc ? doc.value : null;
  }

  // Store a namespace-key value
  async put(namespace, key, value) {
    const coll = this.getCollection();
    await coll.updateOne(
      { namespace, key },
      { $set: { value, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  // List all keys/values under a namespace
  async list(namespace) {
    const coll = this.getCollection();
    const cursor = coll.find({ namespace });
    const docs = await cursor.toArray();
    return docs.map((d) => ({ key: d.key, value: d.value }));
  }

  // Search namespaces with metadata / queries if needed
  async search(query, limit = 10) {
    // Basic text search or regex lookup
    const coll = this.getCollection();
    const cursor = coll.find({ $text: { $search: query } }).limit(limit);
    const docs = await cursor.toArray();
    return docs.map((d) => ({ namespace: d.namespace, key: d.key, value: d.value }));
  }
}
```

### Step 1.2: Initialize and Inject in `agentFactory.js`

Modify [src/factories/agentFactory.js](file:///D:/projects/agent-marketplace/agent-backend/src/factories/agentFactory.js):

1. Import the newly created `MongoDBStore` and `checkpointService` (to access the shared `mongoClient`).
2. Replace `globalStore` with the persistent instance.

```diff
-import { InMemoryStore } from '@langchain/langgraph';
+import { MongoDBStore } from '../utils/mongoStore.js';
+import checkpointService from '../services/checkpoint.service.js';

-// Shared long-term memory store for all agents. Singleton ensures cross-thread
-// memories persist for the lifetime of the process.
-const globalStore = new InMemoryStore();
+let globalStore = null;
+function getGlobalStore() {
+  if (!globalStore && checkpointService.mongoClient) {
+    globalStore = new MongoDBStore({ client: checkpointService.mongoClient });
+  }
+  return globalStore;
+}
```

And inside `buildAgent`:

```diff
     const agentInstance = await createDeepAgent({
       model: llm,
       systemPrompt: agent.systemPrompt,
       checkpointer: safeCheckpointer,
-      store: globalStore,
+      store: getGlobalStore(),
       tools: dynamicTools,
```

---

## Phase 2: User-Level Global Memory (Personalization)

To remember user details (name, job, tech stack, tone preferences) across all agents, we will extend the User document model and create an automated compilation step.

### Step 2.1: Update the User Model Schema

Modify [src/models/User.js](file:///D:/projects/agent-marketplace/agent-backend/src/models/User.js) to support structured profile metadata:

```javascript
// Add to UserSchema definition
profile: {
  preferences: {
    type: Map,
    of: String,
    default: {}
  },
  summary: {
    type: String,
    default: ""
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}
```

### Step 2.2: Add Dynamic Profile Injection in Agent Setup

When compiling an agent, we will read the user's saved preferences and append them to the agent's prompt, customizing its behavior.

Modify `buildAgent` in [src/factories/agentFactory.js](file:///D:/projects/agent-marketplace/agent-backend/src/factories/agentFactory.js):

```javascript
    // Fetch User Profile context
    const user = await userRepository.findById(userId);
    let personalizedPrompt = agent.systemPrompt;

    if (user && user.profile && (user.profile.summary || user.profile.preferences.size > 0)) {
      let profileContext = "\n\n### USER PROFILE & PREFERENCES (Apply this context to the user):\n";
      if (user.profile.summary) {
        profileContext += `- Summary: ${user.profile.summary}\n`;
      }
      for (const [key, val] of user.profile.preferences.entries()) {
        profileContext += `- ${key}: ${val}\n`;
      }

      personalizedPrompt = `${agent.systemPrompt}${profileContext}`;
    }

    const agentInstance = await createDeepAgent({
      model: llm,
      systemPrompt: personalizedPrompt,
      // ...
```

---

## Phase 3: Automatic Memory Acquisition Node

To keep the User Profile updated without forcing the user to edit settings, a background task will periodically evaluate conversations to extract new facts.

### Step 3.1: Create Profile Summarization Service

Create a new file `agent-backend/src/services/memoryCollector.service.js`:

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import userRepository from '../repositories/userRepository.js';

export async function extractAndSaveMemory(userId, chatHistory, llmConfig) {
  const llm = new ChatOpenAI({
    openAIApiKey: llmConfig.apiKey,
    model: 'gpt-4o-mini',
    temperature: 0,
  });

  const prompt = [
    new SystemMessage(
      `You are a profile memory extractor. Analyze the recent conversation history and output key facts about the User. 
      Focus on preferences, coding languages, project goals, workflow setups, or specific requests.
      Output ONLY a JSON block containing "summary" (a 2-3 sentence overview of who they are) and "preferences" (key-value updates of specific settings).
      Example:
      {
        "summary": "Full stack engineer specializing in React and Node.js. Prefers clean, modular functions.",
        "preferences": {
          "preferred_backend": "Node.js (Express)",
          "style_preference": "Functional components, hooks"
        }
      }`
    ),
    new HumanMessage(JSON.stringify(chatHistory.slice(-10))),
  ];

  try {
    const response = await llm.invoke(prompt);
    const result = JSON.parse(response.content.trim());

    // Update user profile in database
    await userRepository.updateUserProfile(userId, result);
  } catch (err) {
    console.error('[MemoryCollector] Failed to extract user memory:', err.message);
  }
}
```

### Step 3.2: Hook Collector into Message Stream

Add a trigger inside [src/routes/agui.routes.js](file:///D:/projects/agent-marketplace/agent-backend/src/routes/agui.routes.js) that runs asynchronously after a message finishes:

```javascript
// Run after sending output back to client (do not block user response)
setImmediate(async () => {
  try {
    const chatHistory = await checkpointService.getMessages(threadId, userId);
    // Only run memory extraction occasionally (e.g. every 10 messages)
    if (chatHistory.messages.length % 10 === 0) {
      await extractAndSaveMemory(userId, chatHistory.messages, { apiKey: userProviderKey });
    }
  } catch (e) {
    console.error('Background memory collector failed:', e.message);
  }
});
```
