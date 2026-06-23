import { DynamicTool } from '@langchain/core/tools';
import knowledgeRepository from '../repositories/knowledgeRepository.js';
import knowledgeService from '../services/knowledge.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Resolves knowledge bases linked to an agent into LangChain DynamicTool instances.
 *
 * Each knowledge base generates two tools:
 *   1. `search_<kb_name>` — Performs semantic search on the KB
 *   2. `list_sources_<kb_name>` — Lists documents in the KB
 *
 * @param {Array} knowledgeBaseIds - Array of KnowledgeBase ObjectIds
 * @param {string} userId - The user ID for ownership verification
 * @returns {Promise<Array<DynamicTool>>}
 */
export async function resolveKnowledgeBaseTools(knowledgeBaseIds, userId) {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return [];

  const kbs = await knowledgeRepository.findKbsByIds(knowledgeBaseIds);
  const tools = [];

  for (const kb of kbs) {
    // Only attach tools for KBs the user owns or are public
    const isOwner = kb.ownerId.toString() === userId?.toString();
    if (!isOwner && !kb.isPublic) continue;

    const safeName = kb.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'knowledge_base';

    const kbId = kb._id.toString();

    // Tool 1: Semantic Search
    const searchTool = new DynamicTool({
      name: `search_${safeName}`,
      description: [
        `Search the knowledge base "${kb.name}".`,
        kb.description ? `Description: ${kb.description}.` : '',
        'Use this tool to retrieve relevant text chunks for queries related to this topic.',
        'Input should be a natural language search query.',
      ]
        .filter(Boolean)
        .join(' '),
      func: async (query) => {
        try {
          const results = await knowledgeService.searchKnowledgeBase(kbId, query);
          if (results.length === 0) {
            return `No relevant information found in "${kb.name}" for the query.`;
          }
          return results
            .map((r) => `[Source: ${r.source}]: ${r.text}`)
            .join('\n\n');
        } catch (err) {
          logger.error('[KnowledgeTools] Search error:', err.message);
          return `Error searching knowledge base "${kb.name}": ${err.message}`;
        }
      },
    });

    // Tool 2: List Source Documents
    const listTool = new DynamicTool({
      name: `list_sources_${safeName}`,
      description: [
        `List all the source documents/files uploaded to the knowledge base "${kb.name}".`,
        kb.description ? `Description: ${kb.description}.` : '',
        'Use this tool to see what specific documents you have access to in this knowledge base.',
      ]
        .filter(Boolean)
        .join(' '),
      func: async () => {
        try {
          const docs = await knowledgeService.listDocumentSources(kbId, userId);
          const formatted = docs.map((d) => ({
            fileName: d.fileName,
            fileSize: d.fileSize,
            mimeType: d.mimeType || 'unknown',
            chunkCount: d.chunkCount || 0,
            uploadedAt: d.uploadedAt,
          }));
          return JSON.stringify(formatted, null, 2);
        } catch (err) {
          logger.error('[KnowledgeTools] List sources error:', err.message);
          return `Error listing sources for "${kb.name}": ${err.message}`;
        }
      },
    });

    tools.push(searchTool, listTool);
    logger.info(
      `[KnowledgeTools] Injected tools for KB "${kb.name}": search_${safeName}, list_sources_${safeName}`
    );
  }

  return tools;
}
