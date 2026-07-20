import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import crypto from 'crypto';
import config from '../config/index.js';
import knowledgeRepository from '../repositories/knowledgeRepository.js';
import providerRepository from '../repositories/providerRepository.js';
import encryption from '../utils/encryption.js';
import { loggerService } from '../utils/index.js';

const logger = loggerService.getLogger();

class KnowledgeService {
  constructor() {
    this._embeddingsMap = {};
    this._qdrantClientPromise = null;
  }

  /**
   * Lazy-initializes the OpenAI embedding instance using the platform's
   * global OPENAI_API_KEY (not the user's personal provider key).
   */
  _getEmbeddings(modelName = 'text-embedding-3-small', provider = null) {
    const providerIdStr = provider?._id?.toString() || 'default';
    const cacheKey = `${providerIdStr}:${modelName}`;

    if (!this._embeddingsMap[cacheKey]) {
      let apiKey = null;
      let baseURL = null;

      if (provider) {
        try {
          apiKey = encryption.decrypt(provider.apiKeyEncrypted);
          baseURL = provider.baseURL;
        } catch (err) {
          logger.warn('[KnowledgeService] Failed to decrypt provider API key:', err.message);
        }
      }

      // If no provider or decryption failed, fallback to global config env keys for compatibility
      if (!apiKey) {
        apiKey = config.ai.openAiApiKey;
      }

      if (!apiKey) {
        throw new Error(
          'API key is not configured. It is required for generating knowledge base embeddings.'
        );
      }

      const options = {
        openAIApiKey: apiKey,
        model: modelName,
      };

      if (baseURL) {
        options.configuration = {
          baseURL,
        };
      }

      this._embeddingsMap[cacheKey] = new OpenAIEmbeddings(options);
    }
    return this._embeddingsMap[cacheKey];
  }

  /**
   * Lazy-initializes the Qdrant REST client (singleton promise).
   */
  async _getQdrantClient() {
    if (!this._qdrantClientPromise) {
      this._qdrantClientPromise = (async () => {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const apiKey = config.knowledge.qdrantApiKey;
        if (!apiKey) {
          throw new Error(
            'QDRANT_API_KEY is not configured. Set it in your environment variables.'
          );
        }
        return new QdrantClient({
          url: config.knowledge.qdrantUrl,
          apiKey,
        });
      })();
    }
    return this._qdrantClientPromise;
  }

  /**
   * Generates a unique, URL-safe collection name for a Qdrant collection.
   */
  _generateCollectionName(kbId) {
    const safeId = kbId.toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const random = crypto.randomBytes(4).toString('hex');
    return `kb_${safeId}_${random}`;
  }

  /**
   * Returns a QdrantVectorStore referencing an existing collection.
   */
  async _getVectorStore(collectionName, embeddingModel, providerId) {
    const apiKey = config.knowledge.qdrantApiKey;
    if (!apiKey) {
      throw new Error('QDRANT_API_KEY is not configured. Set it in your environment variables.');
    }
    let provider = null;
    if (providerId) {
      if (typeof providerId === 'object' && providerId.apiKeyEncrypted) {
        provider = providerId;
      } else {
        provider = await providerRepository.findById(providerId?._id || providerId);
      }
    }
    const embeddings = this._getEmbeddings(embeddingModel, provider);
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: config.knowledge.qdrantUrl,
      apiKey,
      collectionName,
    });
  }

  /**
   * Creates a new Qdrant collection via the REST API with the proper
   * vector configuration for the chosen embedding model.
   */
  async _createQdrantCollection(collectionName, embeddingModel = 'text-embedding-3-small') {
    const client = await this._getQdrantClient();

    const collections = await client.getCollections();
    const exists = collections.collections?.some((c) => c.name === collectionName);
    if (exists) return; // Already exists — safe to reuse

    let size = 1536; // OpenAI text-embedding-3-small dimension
    if (embeddingModel && embeddingModel.includes('3-large')) {
      size = 3072;
    }

    await client.createCollection(collectionName, {
      vectors: {
        size,
        distance: 'Cosine',
      },
    });

    logger.info(
      `[KnowledgeService] Created Qdrant collection: ${collectionName} with size ${size}`
    );
  }

  /**
   * Deletes a Qdrant collection via REST API.
   */
  async _deleteQdrantCollection(collectionName) {
    try {
      const client = await this._getQdrantClient();
      await client.deleteCollection(collectionName);
      logger.info('[KnowledgeService] Deleted Qdrant collection:', collectionName);
    } catch (err) {
      logger.warn('[KnowledgeService] Failed to delete Qdrant collection:', err.message);
    }
  }

  /**
   * Extracts text from an uploaded file buffer based on MIME type.
   */
  async _extractText(fileBuffer, mimeType, fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Plain text formats
    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      mimeType === 'text/csv' ||
      ext === 'txt' ||
      ext === 'md' ||
      ext === 'json' ||
      ext === 'csv'
    ) {
      return fileBuffer.toString('utf-8');
    }

    // PDF
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: fileBuffer });
        const data = await parser.getText();
        return data.text || '';
      } catch (err) {
        logger.error('[KnowledgeService] PDF parse error:', err);
        throw new Error(`Failed to parse PDF "${fileName}": ${err.message}`);
      }
    }

    throw new Error(
      `Unsupported file type "${mimeType || ext}" for file "${fileName}". Supported: PDF, TXT, MD, JSON, CSV.`
    );
  }

  /**
   * Splits text into overlapping chunks using LangChain's recursive splitter.
   */
  async _chunkText(text, chunkSize, chunkOverlap) {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize || config.knowledge.chunkSize,
      chunkOverlap: typeof chunkOverlap === 'number' ? chunkOverlap : config.knowledge.chunkOverlap,
      separators: ['\n\n', '\n', '.', ' ', ''],
    });

    return await splitter.splitText(text);
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Creates a new Knowledge Base with a Qdrant collection.
   *
   * Flow: save MongoDB record first → build collection name from its _id →
   * create Qdrant collection via REST API → update record with collection name.
   */
  async createKnowledgeBase(
    userId,
    { name, description, isPublic, embeddingModel, providerId, chunkSize, chunkOverlap, topK }
  ) {
    let resolvedProviderId = providerId;
    if (!resolvedProviderId) {
      const userProviders = await providerRepository.findByUser(userId);
      const defaultProvider = userProviders.find((p) => p.isDefault) || userProviders[0];
      if (defaultProvider) {
        resolvedProviderId = defaultProvider._id;
      }
    }

    if (!resolvedProviderId) {
      throw new Error(
        'No AI provider found. Please configure a provider in settings before creating a knowledge base.'
      );
    }

    // 1. Create a placeholder KB record in Mongo to get the _id
    const tempCollectionName = `kb_temp_${crypto.randomBytes(8).toString('hex')}`;
    const kb = await knowledgeRepository.createKb({
      name,
      description,
      isPublic,
      ownerId: userId,
      qdrantCollectionName: tempCollectionName,
      embeddingModel,
      providerId: resolvedProviderId,
      chunkSize,
      chunkOverlap,
      topK,
    });

    // 2. Generate a deterministic collection name from the real _id
    const collectionName = this._generateCollectionName(kb._id);

    // 3. Create the Qdrant collection
    await this._createQdrantCollection(collectionName, kb.embeddingModel);

    // 4. Update the KB record with the real collection name
    const updatedKb = await knowledgeRepository.updateKb(kb._id, {
      qdrantCollectionName: collectionName,
    });

    // 5. Clean up the temp collection if Qdrant auto-created it
    await this._deleteQdrantCollection(tempCollectionName);

    return updatedKb;
  }

  /**
   * Lists all knowledge bases owned by the user.
   */
  async listKnowledgeBases(userId) {
    return await knowledgeRepository.findKbsByUser(userId);
  }

  /**
   * Gets a single knowledge base by ID (with ownership check).
   */
  async getKnowledgeBase(kbId, userId) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString() && !kb.isPublic) {
      throw new Error('Not authorized to access this knowledge base');
    }
    return kb;
  }

  /**
   * Updates a knowledge base's metadata (name, description, isPublic).
   */
  async updateKnowledgeBase(kbId, userId, updateData) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString()) {
      throw new Error('Not authorized to update this knowledge base');
    }

    const sanitized = {};
    if (updateData.name !== undefined) sanitized.name = updateData.name;
    if (updateData.description !== undefined) sanitized.description = updateData.description;
    if (updateData.isPublic !== undefined) sanitized.isPublic = updateData.isPublic;
    if (updateData.embeddingModel !== undefined)
      sanitized.embeddingModel = updateData.embeddingModel;
    if (updateData.providerId !== undefined) sanitized.providerId = updateData.providerId;
    if (updateData.chunkSize !== undefined) sanitized.chunkSize = updateData.chunkSize;
    if (updateData.chunkOverlap !== undefined) sanitized.chunkOverlap = updateData.chunkOverlap;
    if (updateData.topK !== undefined) sanitized.topK = updateData.topK;

    if (Object.keys(sanitized).length === 0) {
      throw new Error('No valid fields to update');
    }

    const updated = await knowledgeRepository.updateKb(kbId, sanitized);
    return updated;
  }

  /**
   * Deletes a knowledge base, its chunks, and the Qdrant collection.
   */
  async deleteKnowledgeBase(kbId, userId) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString()) {
      throw new Error('Not authorized to delete this knowledge base');
    }

    // Delete from MongoDB
    await knowledgeRepository.deleteChunksByKbId(kbId);
    await knowledgeRepository.deleteKb(kbId);

    // Delete the Qdrant collection
    await this._deleteQdrantCollection(kb.qdrantCollectionName);

    return true;
  }

  /**
   * Uploads files to a knowledge base — extracts text, chunks, embeds, indexes.
   * Supports multiple files in a single call.
   */
  async uploadFiles(kbId, userId, files) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString()) {
      throw new Error('Not authorized to upload to this knowledge base');
    }

    // Ensure the Qdrant collection exists
    await this._createQdrantCollection(kb.qdrantCollectionName, kb.embeddingModel);

    const vectorStore = await this._getVectorStore(
      kb.qdrantCollectionName,
      kb.embeddingModel,
      kb.providerId
    );
    const allDocs = [];
    const processedFiles = [];

    for (const file of files) {
      const { buffer, originalname, mimetype, size } = file;
      const fileName = originalname || 'untitled';

      try {
        // 1. Extract text
        const text = await this._extractText(buffer, mimetype, fileName);
        if (!text || text.trim().length === 0) {
          logger.warn('[KnowledgeService] Empty text extracted from:', fileName);
          continue;
        }

        // 2. Chunk
        const chunks = await this._chunkText(text, kb.chunkSize, kb.chunkOverlap);

        // 3. Prepare documents for LangChain
        const docs = chunks.map((chunkText, i) => ({
          id: crypto.randomUUID(),
          pageContent: chunkText,
          metadata: {
            kbId: kb._id.toString(),
            sourceName: fileName,
            chunkIndex: i,
          },
        }));

        allDocs.push(...docs);
        processedFiles.push({
          fileName,
          fileSize: size,
          mimeType: mimetype,
          chunkCount: chunks.length,
        });

        logger.info(`[KnowledgeService] Processed "${fileName}": ${chunks.length} chunks`);
      } catch (err) {
        logger.error(`[KnowledgeService] Failed to process "${fileName}":`, err.message);
        throw new Error(`Failed to process "${fileName}": ${err.message}`);
      }
    }

    if (allDocs.length === 0) {
      throw new Error('No extractable content found in the uploaded files');
    }

    // 4. Add documents to Qdrant in batches to avoid payload size limits
    const BATCH_SIZE = 100;
    const uploadPromises = [];
    const totalBatches = Math.ceil(allDocs.length / BATCH_SIZE);

    logger.info(
      `[KnowledgeService] Starting parallel vector upload to Qdrant: ${totalBatches} batches (${allDocs.length} chunks)...`
    );

    for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
      const batchDocs = allDocs.slice(i, i + BATCH_SIZE);
      const promise = vectorStore.addDocuments(
        batchDocs.map((d) => ({
          id: d.id,
          pageContent: d.pageContent,
          metadata: d.metadata,
        }))
      );
      uploadPromises.push(promise);
    }

    await Promise.all(uploadPromises);
    logger.info(`[KnowledgeService] Successfully uploaded all ${totalBatches} batches to Qdrant.`);

    const pointIds = allDocs.map((d) => d.id);

    // 5. Persist chunk metadata in MongoDB with Qdrant point IDs
    const mongoChunks = allDocs.map((doc, i) => ({
      kbId: kb._id,
      text: doc.pageContent,
      qdrantPointId: pointIds[i] ? String(pointIds[i]) : null,
      metadata: {
        sourceName: doc.metadata.sourceName,
        chunkIndex: doc.metadata.chunkIndex,
      },
    }));

    // Insert in batches of 100
    for (let i = 0; i < mongoChunks.length; i += BATCH_SIZE) {
      const batch = mongoChunks.slice(i, i + BATCH_SIZE);
      await knowledgeRepository.insertChunks(batch);
    }

    // 6. Update KB document list and counts
    const allFileNames = [...new Set([...allDocs.map((d) => d.metadata.sourceName)])];
    const totalChunks = await knowledgeRepository.countChunksByKbId(kb._id);

    await knowledgeRepository.updateKb(kb._id, {
      documentCount: allFileNames.length,
      chunkCount: totalChunks,
      $push: { documents: { $each: processedFiles } },
    });

    return {
      documentCount: allFileNames.length,
      chunkCount: totalChunks,
      files: processedFiles,
    };
  }

  async searchKnowledgeBase(kbId, rawQuery, { topK } = {}) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');

    // Extract search query if passed as an object or JSON string from LangChain tools
    let query = rawQuery;
    if (rawQuery && typeof rawQuery === 'object') {
      query = rawQuery.query || rawQuery.input || rawQuery.question || JSON.stringify(rawQuery);
    } else if (rawQuery && typeof rawQuery === 'string') {
      const trimmed = rawQuery.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          query = parsed.query || parsed.input || parsed.question || rawQuery;
        } catch (e) {
          // not JSON, keep original
        }
      }
    }

    // Fallback if query is somehow empty or still not a string
    if (typeof query !== 'string') {
      query = String(query || '');
    }

    logger.info(
      `[KnowledgeService] Searching KB "${kb.name}" (${kbId}) for query: "${query}" (raw: ${
        typeof rawQuery === 'object' ? JSON.stringify(rawQuery) : rawQuery
      })`
    );

    const k = topK || kb.topK || config.knowledge.topK;
    const vectorStore = await this._getVectorStore(
      kb.qdrantCollectionName,
      kb.embeddingModel,
      kb.providerId
    );

    // Perform similarity search
    const results = await vectorStore.similaritySearch(query, k);

    logger.info(
      `[KnowledgeService] Found ${results ? results.length : 0} results for query "${query}"`
    );

    // Enrich results with chunk metadata from MongoDB
    return results.map((result) => ({
      text: result.pageContent,
      source: result.metadata?.sourceName || 'unknown',
      score: result.metadata?.score || null,
    }));
  }

  /**
   * Deletes a single document (source file) and its chunks from a KB.
   * Removes corresponding points from the Qdrant collection.
   */
  async deleteDocumentFromKb(kbId, userId, sourceName) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString()) {
      throw new Error('Not authorized to modify this knowledge base');
    }

    // 1. Find all chunks for this source so we can get the Qdrant point IDs
    const allChunks = await knowledgeRepository.findChunksBySource(kbId, sourceName);
    if (allChunks.length === 0) {
      throw new Error(`Document "${sourceName}" not found in this knowledge base`);
    }

    // 2. Delete points from Qdrant
    const pointIds = allChunks.map((c) => c.qdrantPointId).filter(Boolean);

    if (pointIds.length > 0) {
      try {
        const client = await this._getQdrantClient();
        await client.delete(kb.qdrantCollectionName, {
          points: pointIds,
          wait: true,
        });
      } catch (err) {
        logger.warn('[KnowledgeService] Failed to delete Qdrant points:', err.message);
      }
    }

    // 3. Delete chunks from MongoDB
    await knowledgeRepository.deleteChunksBySource(kbId, sourceName);

    // 4. Remove the document from the KB's embedded documents array
    const remainingDocs = (kb.documents || []).filter((d) => d.fileName !== sourceName);
    const totalChunks = await knowledgeRepository.countChunksByKbId(kbId);

    const updatedKb = await knowledgeRepository.updateKb(kbId, {
      documents: remainingDocs,
      documentCount: remainingDocs.length,
      chunkCount: totalChunks,
    });

    logger.info(
      `[KnowledgeService] Deleted document "${sourceName}" from KB "${kb.name}": ${allChunks.length} chunks removed`
    );

    return {
      removedChunks: allChunks.length,
      remainingDocuments: remainingDocs.length,
      remainingChunks: totalChunks,
    };
  }

  /**
   * Lists the source documents in a knowledge base.
   */
  async listDocumentSources(kbId, userId) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (kb.ownerId.toString() !== userId.toString() && !kb.isPublic) {
      throw new Error('Not authorized');
    }
    return kb.documents || [];
  }
}

export default new KnowledgeService();
