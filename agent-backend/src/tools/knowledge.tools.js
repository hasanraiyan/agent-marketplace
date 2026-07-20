import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import knowledgeRepository from '../repositories/knowledgeRepository.js';
import knowledgeService from '../services/knowledge.service.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

/**
 * Resolves knowledge bases linked to an agent into two generic LangChain structured tools.
 *
 * Rather than creating a separate tool for each knowledge base (which bloats context),
 * we generate two unified tools:
 *   1. `search_knowledge_base` — Searches a chosen KB
 *   2. `list_knowledge_base_sources` — Lists documents in a chosen KB
 *
 * @param {Array} knowledgeBaseIds - Array of KnowledgeBase ObjectIds
 * @param {string} userId - The user ID for ownership verification
 * @returns {Promise<Array<DynamicStructuredTool>>}
 */
export async function resolveKnowledgeBaseTools(knowledgeBaseIds, userId) {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) return [];

  const kbs = await knowledgeRepository.findKbsByIds(knowledgeBaseIds);
  const allowedKbs = kbs.filter(
    (kb) => kb.ownerId.toString() === userId?.toString() || kb.isPublic
  );

  if (allowedKbs.length === 0) return [];

  const kbNamesList = allowedKbs.map((kb) => `"${kb.name}"`).join(', ');

  // Tool 1: Generic Semantic Search
  const searchTool = new DynamicStructuredTool({
    name: 'search_knowledge_base',
    description: `Search one of the attached knowledge bases for relevant information. Available options: ${kbNamesList}.`,
    schema: z.object({
      knowledgeBaseName: z
        .string()
        .describe(
          `The name of the knowledge base to search. Must be exactly one of: ${kbNamesList}`
        ),
      query: z.string().describe('The search query or keywords to look up.'),
    }),
    func: async ({ knowledgeBaseName, query }) => {
      try {
        const kb = allowedKbs.find((k) => k.name.toLowerCase() === knowledgeBaseName.toLowerCase());
        if (!kb) {
          return `Knowledge base "${knowledgeBaseName}" not found. Attached knowledge bases are: ${kbNamesList}`;
        }
        logger.info(
          `[KnowledgeTools] Tool "search_knowledge_base" called for KB "${kb.name}" with query: "${query}"`
        );
        const results = await knowledgeService.searchKnowledgeBase(kb._id.toString(), query);
        if (results.length === 0) {
          return `No relevant information found in "${kb.name}" for the query.`;
        }
        return results.map((r) => `[Source: ${r.source}]: ${r.text}`).join('\n\n');
      } catch (err) {
        logger.error('[KnowledgeTools] Search error:', err.message);
        return `Error searching knowledge base "${knowledgeBaseName}": ${err.message}`;
      }
    },
  });

  // Tool 2: Generic List Source Documents
  const listTool = new DynamicStructuredTool({
    name: 'list_knowledge_base_sources',
    description: `List all source documents/files uploaded to a specific knowledge base. Available options: ${kbNamesList}.`,
    schema: z.object({
      knowledgeBaseName: z
        .string()
        .describe(`The name of the knowledge base. Must be exactly one of: ${kbNamesList}`),
    }),
    func: async ({ knowledgeBaseName }) => {
      try {
        const kb = allowedKbs.find((k) => k.name.toLowerCase() === knowledgeBaseName.toLowerCase());
        if (!kb) {
          return `Knowledge base "${knowledgeBaseName}" not found. Attached knowledge bases are: ${kbNamesList}`;
        }
        logger.info(
          `[KnowledgeTools] Tool "list_knowledge_base_sources" called for KB "${kb.name}"`
        );
        const docs = await knowledgeService.listDocumentSources(kb._id.toString(), userId);
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
        return `Error listing sources for "${knowledgeBaseName}": ${err.message}`;
      }
    },
  });

  return [searchTool, listTool];
}
