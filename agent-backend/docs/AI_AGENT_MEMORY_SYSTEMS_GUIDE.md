# Architectural Guide: AI Agent Memory Systems

Memory is the foundational capability that enables an AI agent to transition from a stateless, single-turn transaction engine into a stateful, learning entity. By storing, updating, retrieving, and forgetting context, facts, and past events, agents can maintain coherent workflows across long time horizons and customize their behaviors to individual user profiles.

This guide provides a comprehensive breakdown of memory types, levels of memory, industry framework examples, and concrete code implementations.

---

## 1. Cognitive Science Foundation: The Memory Taxonomy

In cognitive science and agent architecture frameworks (such as the Cognitive Architectures for Language Agents - CoALA), AI memory is modeled similarly to human memory:

```
                      ┌─────────────────────────────────┐
                      │    AI Agent Memory Taxonomy     │
                      └────────────────┬────────────────┘
                                       │
         ┌─────────────────────────────┼──────────────────────────────┐
         ▼                             ▼                              ▼
┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│  Sensory Memory  │          │    Short-Term    │          │    Long-Term     │
│  (In-Context/RAM)│          │  (Conversational)│          │    (Database)    │
└────────┬─────────┘          └────────┬─────────┘          └────────┬─────────┘
         │                             │                             │
         ▼                             ▼             ┌───────────────┼───────────────┐
  Prompt context,              Message history,      ▼               ▼               ▼
  scratchpad details           graph checkpoints  Episodic        Semantic       Procedural
                                                  (Experiences)   (Facts/Pref)   (Skills/Rules)
```

### A. Sensory / Working Memory (In-Context Window)
*   **Definition:** The immediate, high-fidelity, but highly limited buffer that holds the current prompt, active variables, and temporary outputs of the model's intermediate reasoning steps (often called the *scratchpad*).
*   **Lifespan:** Active only during a single model invocation (single execution run).
*   **Implementation:** The LLM context window (tokens passed in the API payload).
*   **Example:** When an agent uses a chain-of-thought prompt (e.g. React agent):
    ```
    Thought: I need to check the company's server CPU usage before restarting it.
    Action: run_terminal_command("wmic cpu get loadpercentage")
    Observation: LoadPercentage = 84%
    Thought: The CPU is highly loaded. I should wait 10 seconds before attempting a restart.
    ```

### B. Short-Term Memory (Conversational History & State Checkpointing)
*   **Definition:** The sequence of interactions (dialogue turns) and system execution states within a specific task or conversation session.
*   **Lifespan:** Session-based. Active during the lifecycle of a specific thread (e.g., `thread_id`).
*   **Implementation:** Serialized dialogue lists and graph checkpoints stored in transient or persistent caches (e.g., Redis, MongoDB).
*   **Example:** A support agent remembering that the user said *"My credit card was declined"* 5 messages ago within the same chat session.

### C. Long-Term Memory (LTM)
Long-term memory persists indefinitely across multiple conversations, servers, and users. It is divided into three distinct sub-types:

#### I. Episodic Memory (Experiences & Outcomes)
*   **Definition:** The storage of chronological, context-rich logs of past agent activities, trials, errors, and outcomes. It answers the question: *"What did I do in a similar situation before, and did it succeed or fail?"*
*   **Implementation:** Chronological execution traces, summarized sessions, and tool logs indexed in a Vector Database for similarity search.
*   **Example:** A software engineering agent remembers:
    *   *Episode:* On Monday, I attempted to compile the Rust project using `cargo build --release` but it failed due to a missing OpenSSL dependency.
    *   *Resolution:* I resolved it by installing `libssl-dev` using `apt-get install`.

#### II. Semantic Memory (Facts, Entities & Preferences)
*   **Definition:** Structured knowledge about the world, the application domain, the user, or system configuration. It answers: *"What are the constant rules, details, or preferences I need to know?"*
*   **Implementation:** Vector databases, Knowledge Bases, User Profile databases, or Knowledge Graphs.
*   **Example:** 
    *   *User preference:* "Raiyan prefers Python code formatted using `black`."
    *   *World fact:* "Model Context Protocol (MCP) servers run over JSON-RPC 2.0."

#### III. Procedural Memory (Skills & Rules)
*   **Definition:** The "how-to" knowledge. The set of actions, tools, conditional routing paths, and system prompts that define *how* the agent carries out tasks.
*   **Implementation:** Hardcoded system prompts, library of executable code tools, or dynamically loaded execution workflows.
*   **Example:** The agent knowing the exact series of Git commands to run to rebase a branch and resolve conflicts safely.

---

## 2. Memory Levels in Modern Architectures

A production-grade AI platform organizes memory by different permission scopes and lifecycles:

| Memory Level | Scope | Lifecycle | Typical Backend Technology |
| :--- | :--- | :--- | :--- |
| **1. Thread Level** | Single conversation | Session (scoped to `thread_id`) | Redis, Mongo Checkpointers, Postgres |
| **2. User Level** | One user, all agents | Permanent (scoped to `user_id`) | User profiles in MongoDB, Vector DBs |
| **3. Agent Level** | One agent, all users | Permanent (scoped to `agent_id`) | LangGraph Store, relational DB tables |
| **4. Shared/Workspace** | All users, all agents | Permanent (scoped to `project_id`) | Vector DBs (Qdrant, Pinecone), file shares |

---

## 3. Real-World Framework Architectures

### A. MemGPT: Tiered Memory Model (OS Style)
MemGPT approaches LLM memory similarly to how a computer operating system manages memory using a tiered architecture (Virtual Context Management):

1.  **Core Memory (RAM):** The part of the context window that is always visible to the LLM. It contains `user_context` (facts about the user) and `persona` (the agent's description). MemGPT allows the LLM to write to Core Memory dynamically using function calls (e.g., `update_user_context`).
2.  **Recall Memory (L1/L2 Cache):** Event logs of all past messages and transactions. The LLM can query this history using search parameters.
3.  **Archival Memory (Disk/Vector DB):** Large-scale storage for text files, logs, and knowledge. The LLM can add to it using `archival_memory_insert` and search it using `archival_memory_search`.

### B. LangGraph: States, Checkpointers, and Stores
LangGraph handles stateful agents using two core classes:

1.  **Checkpointers (Short-Term Thread Memory):** Class implementations (e.g., `MemorySaver`, `PostgresSaver`, `MongoDBSaver`) that save a snapshot of the graph state after each execution step. This handles multi-turn loops and human-in-the-loop interventions.
2.  **Stores (Long-Term Cross-Thread Memory):** Class implementations (e.g., `InMemoryStore`, or custom DB stores) that allow agents to load, write, and index information across different conversations. This is typically used to save user preferences, memories, and custom configurations.

---

## 4. Concrete Code Implementations & Examples

### Example 1: Self-Updating Semantic Memory (The "Memory Collector")
In this paradigm, a background summarizer parses conversation logs, extracts user preferences, and updates the user's permanent profile.

```javascript
// src/services/memoryCollector.service.js
import { OpenAI } from "openai";
import { User } from "../models/User.js";

const openai = new OpenAI();

export async function extractAndSaveUserMemories(userId, messages) {
  // 1. Format conversation segment
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  // 2. Query LLM to extract key semantic facts and preferences about the user
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a background Memory Collector agent. Analyze the conversation history and extract personal facts, preferences, or technical details about the USER.
Exclude temporary statements. Focus on long-term value (e.g. coding styles, name, tech stack, workspace tools).
Return your findings as a flat JSON array of strings. If nothing new is learned, return an empty array [].
Example output: ["User works in React/Node.js stack", "User prefers functional programming", "User is located in EST timezone"]`
      },
      {
        role: "user",
        content: conversationText
      }
    ],
    response_format: { type: "json_object" }
  });

  const { memories } = JSON.parse(response.choices[0].message.content);

  if (memories && memories.length > 0) {
    // 3. Update the user profile in MongoDB
    await User.findByIdAndUpdate(userId, {
      $addToSet: { learnedMemories: { $each: memories } }
    });
    return memories;
  }

  return [];
}
```

### Example 2: Episodic Memory Retrieval (Past Conversation Search via Vector DB)
This implementation embeds past threads, saving them to a vector database. When a user asks a question, the top matching historic conversations are injected into the context window.

```javascript
// src/services/episodicMemory.service.js
import { QdrantClient } from "@qdrant/js-client-rest";
import { OpenAI } from "openai";

const qdrant = new QdrantClient({ url: process.env.QDRANT_URL });
const openai = new OpenAI();

// Vectorizes and archives a finished conversation thread
export async function archiveThreadAsEpisode(userId, threadId, conversationSummary) {
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: conversationSummary,
  });
  const vector = embeddingRes.data[0].embedding;

  await qdrant.upsert("episodic_memories", {
    wait: true,
    points: [
      {
        id: threadId,
        vector: vector,
        payload: {
          userId,
          summary: conversationSummary,
          timestamp: new Date().toISOString(),
        },
      },
    ],
  });
}

// Queries historical episodes matching current user query
export async function retrieveRelevantEpisodes(userId, queryText, limit = 2) {
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
  });
  const vector = embeddingRes.data[0].embedding;

  const searchResults = await qdrant.search("episodic_memories", {
    vector: vector,
    filter: {
      must: [{ key: "userId", match: { value: userId } }],
    },
    limit: limit,
  });

  return searchResults.map((result) => result.payload.summary);
}
```

### Example 3: LangGraph Cross-Thread Memory Store (Long-Term Learnings)
This node implementation uses LangGraph's persistent Store to get and update memories about the user across multiple distinct conversations (`thread_id` values).

```javascript
// src/services/langGraphStore.service.js
import { InMemoryStore } from "@langchain/langgraph"; // Or MongoDBStore in production

const store = new InMemoryStore(); // Shared store instance

export async function executeAgentWithStore(threadId, userId, messageInput) {
  const namespace = ["memories", userId];
  
  // 1. Retrieve user long-term facts stored previously
  const userMemories = await store.search(namespace);
  const contextPrompt = userMemories.map(m => `- ${m.value.fact}`).join("\n");

  // 2. Build model prompt with historical memories
  const systemPrompt = `You are a helpful coding assistant. 
Here are facts you learned about this user in previous sessions:
${contextPrompt || "None"}

Write clean code according to these preferences.`;

  // 3. Process chat turn (Simulated)
  console.log("System context initialized with:\n", systemPrompt);
  
  // 4. Update memory if user shares new preference
  if (messageInput.includes("I prefer")) {
    const extractedPreference = messageInput.split("I prefer")[1].trim();
    
    // Save to the long-term store
    const key = `pref_${Date.now()}`;
    await store.put(namespace, key, { fact: `User prefers ${extractedPreference}` });
    console.log(`Saved preference to long-term memory: "User prefers ${extractedPreference}"`);
  }
}
```

---

## 5. Summary Recommendation for `agent-marketplace`

To improve the memory layers currently implemented in this workspace:
1.  **Replace ephemeral RAM store:** Convert the `InMemoryStore` inside [agentFactory.js](file:///D:/projects/agent-marketplace/agent-backend/src/factories/agentFactory.js) to a custom, Mongo-backed `MongoDBStore` class. This prevents nodemon restarts or server deployments from wiping long-term agent state and learnings.
2.  **Add Memory extraction node:** Create a post-execution background job that calls the `extractAndSaveUserMemories` function described in Section 4 to automatically capture user specifics without requiring manual input.
