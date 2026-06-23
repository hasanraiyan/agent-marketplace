# Implementation Plan: Agent Knowledge Base Connectors

This plan outlines the database models, backend services, API endpoints, and frontend components required to implement the **Knowledge Base Connector** feature in Persona.ai.

---

## 1. Database Schemas (`agent-backend`)

We will introduce two new schemas in MongoDB:

### A. `KnowledgeBase` Schema (`src/models/KnowledgeBase.js`)
Stores the metadata of the user's knowledge collection:
```javascript
const knowledgeBaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  isPublic: { type: Boolean, default: false },
  documentCount: { type: Number, default: 0 },
}, { timestamps: true });
```

### B. `KnowledgeChunk` Schema (`src/models/KnowledgeChunk.js`)
Stores individual text segments with their vector embeddings:
```javascript
const knowledgeChunkSchema = new mongoose.Schema({
  kbId: { type: mongoose.Schema.Types.ObjectId, ref: "KnowledgeBase", required: true, index: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true }, // 1536-dimensional vector for OpenAI
  metadata: {
    sourceName: { type: String, required: true },
    chunkIndex: { type: Number },
  }
}, { timestamps: true });

// Vector index definition for MongoDB Atlas Search (Cosine Similarity)
```

---

## 2. Ingestion & File Processing Service (`src/services/knowledge.service.js`)

The ingestion service is designed to handle **multiple files of different formats** simultaneously in a single upload session, keeping their source names separated for model citations:

1.  **File Router (MIME/Extension Detection)**:
    Iterate over each uploaded file and extract text based on format:
    *   **PDF (`.pdf`)**: Parsed using `pdf-parse` to extract clean page text.
    *   **Plain Text (`.txt`, `.md`, `.json`, `.csv`)**: Read directly from the file buffer as UTF-8.
    *   **Pasted Raw Text**: Handled as a virtual file with the title `"Pasted Text - [Date]"`.
2.  **Chunking & Meta Tagging**:
    *   Split the text of *each document separately* using `RecursiveCharacterTextSplitter`.
    *   For each chunk, tag `metadata.sourceName` with the actual file name (e.g. `sales_report.pdf`, `api_doc.md`). This ensures the vector search can isolate or attribute the source of the information.
3.  **Embedding Generation**:
    *   Batch request embeddings for the chunks using OpenAI (`text-embedding-3-small` or the configured provider).
4.  **Batch Storage**:
    *   Bulk-insert the chunks into `KnowledgeChunk` collection.

---

## 3. Backend Endpoints & File Uploads (`src/routes/knowledge.routes.js`)

Expose these endpoints under `/api/v1/knowledge`:
*   `POST /` (Create KB metadata)
*   `GET /` (List user's KBs)
*   `GET /:id` (Get details & associated documents list)
*   `DELETE /:id` (Delete KB & all its associated chunks)
*   `POST /:id/upload` (Supports **multiple file uploads** in a single request using `multer.array("files", 10)` up to 10 files)


---

## 4. Agent Configuration & Runtime Integration (`agent.service.js`)

An agent can be assigned **multiple knowledge bases** simultaneously (e.g., one for "Next.js API Docs" and another for "Company Handbook").

### A. Agent Schema Update
We will update the `Agent` Mongoose schema (`agent-backend/src/models/Agent.js`) to store an array of associated Knowledge Base ObjectIds:
```javascript
// Add to src/models/Agent.js:
knowledgeBases: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: "KnowledgeBase"
}]
```

### B. Dynamic Toolbelt Assembly
When compiling the agent runtime in the backend service, we check for linked KBs. For *each* assigned knowledge base, we instantiate and inject **two distinct tools**:
1.  **Semantic Search Tool**: Queries vector chunks based on cosine similarity.
2.  **Metadata Listing Tool**: Lists the names of files uploaded to the knowledge base so the agent can see its contents on-demand.

```javascript
import { DynamicTool } from "@langchain/core/tools";

// Tool 1: Semantic Search
function createKbSearchTool(kb) {
  return new DynamicTool({
    name: `search_${kb.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    description: `Search the knowledge base: "${kb.name}". Description: ${kb.description}. Use this tool to retrieve relevant text chunks for queries related to this topic.`,
    func: async (query) => {
      const queryVector = await generateQueryEmbedding(query);
      const chunks = await vectorSearchChunks(kb._id, queryVector);
      return chunks.map(c => `[Source: ${c.metadata.sourceName}]: ${c.text}`).join("\n\n");
    }
  });
}

// Tool 2: List Ingested Documents
function createKbListSourcesTool(kb) {
  return new DynamicTool({
    name: `list_sources_${kb.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    description: `List all the source documents/files uploaded to the knowledge base: "${kb.name}". Use this tool to see what specific documents you have access to.`,
    func: async () => {
      const documents = await getKbDocumentList(kb._id); // Query distinct sourceNames
      return JSON.stringify(documents);
    }
  });
}
```

If an agent has 2 knowledge bases assigned (e.g. "Next.js Docs" and "Company Handbook"), it will get 4 tools:
*   `search_nextjs_docs`
*   `list_sources_nextjs_docs`
*   `search_company_handbook`
*   `list_sources_company_handbook`

This allows the model's router to query the correct source and inspect available documents dynamically.

---

## 5. Frontend Integration (`frontend`)

### A. Context & API Client
*   Add API wrapper functions in `frontend/src/lib/api/knowledge.js`.
*   Extend `connectors-context.jsx` to load and cache the user's Knowledge Bases.

### B. Multi-Select in Agent Form (`agent-form.jsx`)
*   Add a "Knowledge Bases" section in the capabilities configuration step of `agent-form.jsx`.
*   Implement a **multi-select checklist** (matching the UI patterns used for Skills and MCPs) to allow assigning multiple Knowledge Bases to the agent.

### C. Connectors Tab (`ConnectorsNav`)
*   Create a "Knowledge Base" settings panel under `/dashboard/connectors/knowledge` to let users create KBs, upload documents, and view files.
