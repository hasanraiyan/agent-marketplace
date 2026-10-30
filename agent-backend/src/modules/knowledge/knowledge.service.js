import { OpenAIEmbeddings } from '@langchain/openai';
import { QdrantVectorStore } from '@langchain/qdrant';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import crypto from 'crypto';
import config from '../../config/index.js';
import knowledgeRepository from './knowledge.repository.js';
import providerRepository from '../providers/provider.repository.js';
import agentRepository from '../agents/agent.repository.js';
import encryption from '../../utils/encryption.js';
import BaseError from '../../utils/errors/BaseError.js';
import { loggerService } from '../../utils/index.js';
import { PERSONA_DOMAIN } from '../auth/personaPrincipalContext.js';
import { isResourceOwner, ownerFieldsForContext } from '../../utils/resourceOwnership.js';
import { scopedFilter } from '../../utils/domainQuery.js';
import {
  OPENAI_COMPATIBLE_EMBEDDING_PROVIDER_TYPES,
  DEFAULT_EMBEDDING_DIMENSIONS,
  knownEmbeddingDimensions,
  normalizeEmbeddingModelName,
  supportsTruncatedDimensions,
} from './knowledge.constants.js';

/**
 * Deliberately NOT imported from `agent.service.js` — that module's
 * `personaExecutionContext` is otherwise identical, but importing it here
 * would transitively pull in `agent.repository.js` -> `tools/index.js` ->
 * the full agent/tool runtime stack (including `agent.factory.js`'s
 * `ChatOpenAI` dependency) just for one trivial object literal. Knowledge
 * has no reason to depend on Agent's service module.
 */
function personaExecutionContext(userId) {
  return { domain: PERSONA_DOMAIN, principalType: 'PersonaUser', personaUserId: userId };
}

const logger = loggerService.getLogger();

class KnowledgeService {
  constructor() {
    this._embeddingsMap = {};
    this._qdrantClientPromise = null;
  }

  /**
   * Lazy-initializes the embedding client for a provider.
   *
   * Every supported provider speaks the OpenAI `/v1/embeddings` shape, so
   * one client covers OpenAI, DeepSeek, Ollama and any custom
   * OpenAI-compatible host (LM Studio, vLLM, LocalAI, …). Only the base URL
   * and the (possibly placeholder) key change. Anthropic/Gemini have no
   * drop-in embeddings endpoint and are rejected earlier with an actionable
   * message instead of a confusing 404 mid-ingestion.
   *
   * `dimensions` is the MRL truncation target; it MUST be identical for
   * ingestion and query-time embedding, so it is part of the cache key.
   */
  _getEmbeddings(modelName = config.knowledge.embeddingModel, provider = null, dimensions = null) {
    const providerIdStr = provider?._id?.toString() || 'default';
    const effectiveDimensions = Number.isInteger(dimensions) ? dimensions : null;
    const cacheKey = `${providerIdStr}:${modelName}:${effectiveDimensions ?? 'native'}`;

    if (!this._embeddingsMap[cacheKey]) {
      let apiKey = null;
      let baseURL = null;

      if (provider) {
        // Synthetic providers (auto-resolved local Ollama) have no encrypted key
        if (provider.apiKeyEncrypted) {
          try {
            apiKey = encryption.decrypt(provider.apiKeyEncrypted);
            baseURL = provider.baseURL;
          } catch (err) {
            logger.warn('[KnowledgeService] Failed to decrypt provider API key:', err.message);
          }
        } else if (provider.baseURL) {
          // Synthetic / key-less Ollama — baseURL is set directly, key is a placeholder
          baseURL = provider.baseURL;
          apiKey = 'ollama'; // Ollama ignores the key; any non-empty string satisfies the SDK
        }
      }

      // If no provider or decryption failed, fallback to global config env keys for compatibility.
      // For Ollama providers the key was already set to a placeholder above.
      if (!apiKey) {
        apiKey = config.ai.openAiApiKey;
      }

      if (!apiKey) {
        // Last resort: if the provider is Ollama (no real key needed), use a placeholder
        const providerTypeForKey = provider ? provider.type || 'custom' : null;
        if (providerTypeForKey === 'ollama') {
          apiKey = 'ollama';
        } else {
          throw new Error(
            'API key is not configured. It is required for generating knowledge base embeddings.'
          );
        }
      }

      const providerType = provider ? provider.type || 'custom' : null;

      if (provider && !OPENAI_COMPATIBLE_EMBEDDING_PROVIDER_TYPES.includes(providerType)) {
        throw new Error(
          `Provider "${provider.label}" (type "${providerType}") does not expose an embeddings endpoint. ` +
            'Knowledge bases require an OpenAI-compatible provider — OpenAI, DeepSeek, Ollama, or a custom ' +
            'OpenAI-compatible Base URL.'
        );
      }

      const options = {
        openAIApiKey: apiKey,
        model: modelName,
      };

      if (effectiveDimensions) {
        options.dimensions = effectiveDimensions;
      }

      if (baseURL) {
        options.configuration = {
          baseURL,
        };

        // OpenAI's SDK defaults to base64-encoded floats, which third-party
        // OpenAI-compatible servers (Ollama in particular) do not reliably
        // implement. Requesting floats costs nothing against OpenAI itself
        // and removes a whole class of "invalid embedding response" errors.
        if (provider && providerType !== 'openai') {
          options.encodingFormat = 'float';
        }
      }

      this._embeddingsMap[cacheKey] = new OpenAIEmbeddings(options);
    }
    return this._embeddingsMap[cacheKey];
  }

  /**
   * Loads the full provider document for an embedding call.
   *
   * `knowledgeRepository.findKbById` populates `providerId` with only
   * `label`/`defaultModel` for display, which is not enough to build a
   * client — the encrypted key and base URL live on the full row.
   */
  async _resolveProvider(providerRef) {
    if (!providerRef) {
      // No provider stored (KB was created via the auto-Ollama path). Synthesize
      // a key-less local Ollama provider so uploads use the same baseURL as creation.
      if (config.knowledge.ollamaBaseUrl) {
        return {
          _id: null,
          label: 'Local Ollama (auto)',
          type: 'ollama',
          baseURL: config.knowledge.ollamaBaseUrl,
          apiKeyEncrypted: null,
          defaultModel: config.knowledge.embeddingModel || 'nomic-embed-text',
        };
      }
      return null;
    }
    if (typeof providerRef === 'object' && providerRef.apiKeyEncrypted) {
      return providerRef;
    }
    const providerId = typeof providerRef === 'object' ? providerRef._id : providerRef;
    if (!providerId) return null;
    return await providerRepository.findById(providerId);
  }

  /**
   * Probes the provider for the actual vector length of `modelName`.
   *
   * This is the single source of truth for a collection's vector size: it
   * catches model/provider mismatches (a `text-embedding-3-small` name sent
   * to an Ollama host), unsupported `dimensions` values, and unreachable
   * providers *before* a Qdrant collection is created.
   */
  async _probeEmbeddingDimensions(embeddingModel, provider, dimensions = null) {
    const embeddings = this._getEmbeddings(embeddingModel, provider, dimensions);

    if (typeof embeddings.embedQuery !== 'function') {
      throw new Error(
        `Embedding model "${embeddingModel}" cannot be probed — the client does not support embedQuery().`
      );
    }

    let vector;
    try {
      vector = await embeddings.embedQuery('dimension probe');
    } catch (err) {
      throw new Error(
        `Failed to generate a test embedding with model "${embeddingModel}": ${err.message}`
      );
    }

    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(
        `Embedding model "${embeddingModel}" returned an invalid vector. Check the provider configuration.`
      );
    }

    return vector.length;
  }

  /**
   * Resolves the effective dimensionality for a Knowledge Base and rejects
   * requests that the model/provider cannot honour.
   *
   * @param {string} embeddingModel
   * @param {object} provider full provider document
   * @param {number|null} requestedDimensions optional MRL truncation target
   * @returns {Promise<number>}
   */
  async _resolveEmbeddingDimensions(embeddingModel, provider, requestedDimensions = null) {
    const nativeDimensions = knownEmbeddingDimensions(embeddingModel);

    if (requestedDimensions !== null && requestedDimensions !== undefined) {
      if (!Number.isInteger(requestedDimensions) || requestedDimensions < 1) {
        throw new BaseError(
          'embeddingDimensions must be a positive integer.',
          400,
          'INVALID_EMBEDDING_DIMENSIONS'
        );
      }

      if (
        nativeDimensions &&
        requestedDimensions > nativeDimensions &&
        !supportsTruncatedDimensions(embeddingModel)
      ) {
        throw new BaseError(
          `Model "${embeddingModel}" outputs ${nativeDimensions} dimensions; ${requestedDimensions} is too large.`,
          400,
          'INVALID_EMBEDDING_DIMENSIONS'
        );
      }

      // Probe with the requested value — this is what actually proves the
      // provider honours MRL truncation (OpenAI does, Ollama only for
      // models that support it).
      const probed = await this._probeEmbeddingDimensions(
        embeddingModel,
        provider,
        requestedDimensions
      );

      if (probed !== requestedDimensions) {
        throw new BaseError(
          `Model "${embeddingModel}" ignored the requested ${requestedDimensions} dimensions and returned ${probed}. ` +
            'Use the model\'s native dimensionality or a supported MRL value.',
          400,
          'INVALID_EMBEDDING_DIMENSIONS'
        );
      }

      return probed;
    }

    // Native dimensionality: probe is authoritative, the static table is
    // only a fallback for hosts that are unreachable at creation time.
    try {
      return await this._probeEmbeddingDimensions(embeddingModel, provider, null);
    } catch (err) {
      if (nativeDimensions) {
        logger.warn(
          `[KnowledgeService] Could not probe "${embeddingModel}" (${err.message}); ` +
            `falling back to the known dimensionality (${nativeDimensions}).`
        );
        return nativeDimensions;
      }
      throw err;
    }
  }

  /**
   * Effective dimensionality of an existing Knowledge Base.
   *
   * Legacy rows predate `embeddingDimensions`. They are backfilled lazily
   * from the static table (never by probing, so an unrelated search keeps
   * working even while the provider is down), and persisted so every later
   * call agrees.
   */
  async _ensureKbDimensions(kb) {
    if (Number.isInteger(kb.embeddingDimensions) && kb.embeddingDimensions > 0) {
      return kb.embeddingDimensions;
    }

    const known = knownEmbeddingDimensions(kb.embeddingModel) || DEFAULT_EMBEDDING_DIMENSIONS;
    logger.warn(
      `[KnowledgeService] Knowledge base ${kb._id} has no stored embeddingDimensions; ` +
        `backfilling ${known} for model "${kb.embeddingModel}".`
    );

    await knowledgeRepository
      .updateKb(kb._id, { embeddingDimensions: known })
      .catch((err) =>
        logger.warn('[KnowledgeService] Failed to backfill embeddingDimensions:', err.message)
      );

    return known;
  }

  /**
   * Lazy-initializes the Qdrant REST client (singleton promise).
   *
   * `QDRANT_API_KEY` is optional: self-hosted Qdrant (the documented
   * `docker run -p 6333:6333 qdrant/qdrant` setup) has no auth by default.
   * Qdrant Cloud and any secured deployment still pass the key.
   */
  async _getQdrantClient() {
    if (!this._qdrantClientPromise) {
      this._qdrantClientPromise = (async () => {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const clientOptions = { url: config.knowledge.qdrantUrl };
        if (config.knowledge.qdrantApiKey) {
          clientOptions.apiKey = config.knowledge.qdrantApiKey;
        }
        return new QdrantClient(clientOptions);
      })();
      // Constructing the client above never actually connects (it's just
      // config), so this only rejects on a config error. Still: don't leave
      // a permanently-rejected promise cached — every later call would
      // replay the same failure forever, requiring a process restart to
      // recover even after the config/env is fixed.
      this._qdrantClientPromise.catch(() => {
        this._qdrantClientPromise = null;
      });
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
   *
   * `dimensions` must match the value used at ingestion time — for MRL
   * models that is the truncated size, not the native one.
   */
  async _getVectorStore(collectionName, embeddingModel, providerRef, dimensions = null) {
    const provider = await this._resolveProvider(providerRef);
    const embeddings = this._getEmbeddings(embeddingModel, provider, dimensions);
    const vectorStoreOptions = {
      url: config.knowledge.qdrantUrl,
      collectionName,
    };
    if (config.knowledge.qdrantApiKey) {
      vectorStoreOptions.apiKey = config.knowledge.qdrantApiKey;
    }
    return await QdrantVectorStore.fromExistingCollection(embeddings, vectorStoreOptions);
  }

  /**
   * Creates a new Qdrant collection via the REST API with the exact vector
   * size of the embedding model that will fill it.
   */
  async _createQdrantCollection(collectionName, vectorSize) {
    const client = await this._getQdrantClient();
    const size = Number.isInteger(vectorSize) && vectorSize > 0 ? vectorSize : null;

    if (!size) {
      throw new Error(
        'Cannot create a Qdrant collection without an embedding dimensionality. ' +
          'Knowledge bases must store the resolved embedding size.'
      );
    }

    let collections;
    try {
      collections = await client.getCollections();
    } catch (err) {
      // The qdrant-js client wraps a raw connection failure (wrong host,
      // server down, network/firewall block) as a bare "fetch failed" with
      // no further detail — which is what actually reaches the API
      // response and the logs, and is nearly undiagnosable on its own.
      // Name the configured target explicitly so this is actionable.
      throw new Error(
        `Cannot reach the vector database (Qdrant) at ${config.knowledge.qdrantUrl}. ` +
          `Check QDRANT_URL (and QDRANT_API_KEY for secured clusters) and that the server is reachable. ` +
          `Original error: ${err.message}`
      );
    }
    const exists = collections.collections?.some((c) => c.name === collectionName);
    if (exists) return; // Already exists — safe to reuse

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
  /**
   * `context` defaults to `personaExecutionContext(userId)` — zero
   * behavior change for the existing Persona caller. For a Developer/Project
   * context, `providerId` is now **optional**: the service auto-resolves the
   * project's Ollama provider (preferring the one marked default, then any
   * Ollama provider, then the project default). If no provider record exists,
   * it synthesizes a key-less local Ollama provider from `OLLAMA_BASE_URL`
   * (default: `http://localhost:11434/v1`). The embedding model defaults to
   * `embeddinggemma-2` in all cases where none is explicitly provided.
   */
  async createKnowledgeBase(
    userId,
    {
      name,
      description,
      isPublic,
      embeddingModel,
      embeddingDimensions,
      providerId,
      chunkSize,
      chunkOverlap,
      topK,
    },
    context = personaExecutionContext(userId)
  ) {
    let resolvedProviderId = providerId;
    if (!resolvedProviderId) {
      if (context.principalType === 'PersonaUser') {
        // Persona: find the user's default provider
        const userProviders = await providerRepository.findByUser(userId);
        const defaultProvider = userProviders.find((p) => p.isDefault) || userProviders[0];
        if (defaultProvider) {
          resolvedProviderId = defaultProvider._id;
        }
      } else {
        // Developer / Project context: auto-resolve the project's Ollama provider
        // (prefer default, then any Ollama, then any provider) so the form
        // doesn't need to ask for one — the platform always defaults to Ollama
        // + embeddinggemma-2 for local debugging.
        const domain = context.domain;
        const projectProviders = domain
          ? await providerRepository.findByDomain(domain)
          : [];
        const ollamaDefault = projectProviders.find((p) => p.type === 'ollama' && p.isDefault);
        const anyOllama = projectProviders.find((p) => p.type === 'ollama');
        const anyDefault = projectProviders.find((p) => p.isDefault);
        const fallback = ollamaDefault || anyOllama || anyDefault || projectProviders[0] || null;
        if (fallback) {
          resolvedProviderId = fallback._id;
        }
      }
    }

    // If still no provider, synthesize a virtual Ollama provider using the
    // configured base URL — this covers the local-dev case where no provider
    // record has been created yet.
    let syntheticOllamaProvider = null;
    if (!resolvedProviderId) {
      if (config.knowledge.ollamaBaseUrl) {
        syntheticOllamaProvider = {
          _id: null,
          label: 'Local Ollama (auto)',
          type: 'ollama',
          baseURL: config.knowledge.ollamaBaseUrl,
          apiKeyEncrypted: null,
          defaultModel: config.knowledge.embeddingModel || 'embeddinggemma-2',
        };
      } else {
        throw new Error(
          'No AI provider found. Add an Ollama provider to this project or set OLLAMA_BASE_URL.'
        );
      }
    }

    // 0. Resolve the embedding provider BEFORE touching Mongo/Qdrant, so a
    //    misconfigured provider fails without leaving an orphaned record.
    const provider = syntheticOllamaProvider
      ? syntheticOllamaProvider
      : await providerRepository.findById(resolvedProviderId);
    if (!provider) {
      throw new Error('Provider not found. Please configure an AI provider first.');
    }

    const providerType = provider.type || 'custom';
    if (!OPENAI_COMPATIBLE_EMBEDDING_PROVIDER_TYPES.includes(providerType)) {
      throw new BaseError(
        `Provider "${provider.label}" (type "${providerType}") does not expose an embeddings endpoint. ` +
          'Knowledge bases require an OpenAI-compatible provider — OpenAI, DeepSeek, Ollama, or a custom ' +
          'OpenAI-compatible Base URL.',
        400,
        'UNSUPPORTED_EMBEDDING_PROVIDER'
      );
    }

    // Local Ollama users configure the embedding model on the provider
    // itself, so use that when the request omits an explicit model. For the
    // Developer context we always default to embeddinggemma-2 (local Ollama).
    const resolvedModel =
      embeddingModel ||
      (providerType === 'ollama' ? provider.defaultModel : null) ||
      config.knowledge.embeddingModel ||
      'embeddinggemma-2';

    const resolvedDimensions = await this._resolveEmbeddingDimensions(
      resolvedModel,
      provider,
      embeddingDimensions ?? null
    );

    // 1. Create a placeholder KB record in Mongo to get the _id
    const tempCollectionName = `kb_temp_${crypto.randomBytes(8).toString('hex')}`;
    const kb = await knowledgeRepository.createKb({
      name,
      description,
      isPublic,
      ...ownerFieldsForContext(context),
      qdrantCollectionName: tempCollectionName,
      embeddingModel: resolvedModel,
      embeddingDimensions: resolvedDimensions,
      // Only store providerId when it's a real DB record (not the synthetic local Ollama)
      providerId: resolvedProviderId || undefined,
      chunkSize,
      chunkOverlap,
      topK,
    });

    // 2. Generate a deterministic collection name from the real _id
    const collectionName = this._generateCollectionName(kb._id);

    // 3. Create the Qdrant collection. On failure, remove the placeholder
    // record instead of leaving an orphaned kb_temp_* row behind — it was
    // never a real, usable Knowledge Base and would otherwise show up in
    // list/count queries forever.
    try {
      await this._createQdrantCollection(collectionName, resolvedDimensions);
    } catch (err) {
      await knowledgeRepository.deleteKb(kb._id).catch(() => {});
      throw err;
    }

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
   * Gets a single knowledge base by ID (with ownership check). `context`
   * defaults to `personaExecutionContext(userId)` — zero behavior change
   * for every existing caller.
   */
  async getKnowledgeBase(kbId, userId, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context) && !kb.isPublic) {
      throw new Error('Not authorized to access this knowledge base');
    }
    return kb;
  }

  /**
   * Feature 2 (dependency/usage lookup, gap-fill audit): "what's using
   * this Knowledge base" — answerable before attempting delete. Existence/
   * ownership check reuses getKnowledgeBase so this 404s identically to
   * every other single-resource read. Unlike Provider/Skill/MCP,
   * deleteKnowledgeBase doesn't currently block on in-use Agents either —
   * this is read-only usage visibility, not a new delete-time restriction.
   */
  async getKnowledgeBaseUsage(kbId, userId, context = personaExecutionContext(userId)) {
    await this.getKnowledgeBase(kbId, userId, context);
    const [agentCount, agents] = await Promise.all([
      agentRepository.count({ knowledgeBases: kbId }),
      agentRepository.findAgentsUsingKnowledgeBase(kbId, '_id name', 20),
    ]);
    return { agentCount, agents };
  }

  /**
   * Updates a knowledge base's metadata (name, description, isPublic) and
   * non-destructive tuning (chunk settings, topK).
   *
   * The embedding configuration (model / provider / dimensions) is NOT
   * freely mutable: it defines the Qdrant collection's vector size and the
   * vector space of every already-indexed chunk. Changing it after
   * documents exist would silently produce meaningless similarity scores
   * (or a hard dimension mismatch), so it is rejected with a 409. On an
   * EMPTY knowledge base the change is safe, and the (empty) collection is
   * recreated with the new vector size.
   *
   * `context` defaults to `personaExecutionContext(userId)`.
   */
  async updateKnowledgeBase(kbId, userId, updateData, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context)) {
      throw new Error('Not authorized to update this knowledge base');
    }

    const currentProviderId = String(kb.providerId?._id || kb.providerId || '');
    const nextProviderId =
      updateData.providerId !== undefined ? String(updateData.providerId) : currentProviderId;

    const embeddingConfigChanged =
      (updateData.embeddingModel !== undefined && updateData.embeddingModel !== kb.embeddingModel) ||
      nextProviderId !== currentProviderId ||
      (updateData.embeddingDimensions !== undefined &&
        updateData.embeddingDimensions !== kb.embeddingDimensions);

    const sanitized = {};
    if (updateData.name !== undefined) sanitized.name = updateData.name;
    if (updateData.description !== undefined) sanitized.description = updateData.description;
    if (updateData.isPublic !== undefined) sanitized.isPublic = updateData.isPublic;
    if (updateData.chunkSize !== undefined) sanitized.chunkSize = updateData.chunkSize;
    if (updateData.chunkOverlap !== undefined) sanitized.chunkOverlap = updateData.chunkOverlap;
    if (updateData.topK !== undefined) sanitized.topK = updateData.topK;

    if (embeddingConfigChanged) {
      const hasIndexedContent = (kb.documentCount || 0) > 0 || (kb.chunkCount || 0) > 0;

      if (hasIndexedContent) {
        throw new BaseError(
          'Embedding model, provider, and dimensions are fixed once documents are indexed. ' +
            'Delete the indexed documents or create a new knowledge base to change them.',
          409,
          'KB_EMBEDDING_CONFIG_IMMUTABLE'
        );
      }

      const provider = await this._resolveProvider(updateData.providerId ?? kb.providerId);
      if (!provider) {
        throw new Error('Provider not found. Please configure an AI provider first.');
      }

      const providerType = provider.type || 'custom';
      if (!OPENAI_COMPATIBLE_EMBEDDING_PROVIDER_TYPES.includes(providerType)) {
        throw new BaseError(
          `Provider "${provider.label}" (type "${providerType}") does not expose an embeddings endpoint. ` +
            'Knowledge bases require an OpenAI-compatible provider.',
          400,
          'UNSUPPORTED_EMBEDDING_PROVIDER'
        );
      }

      const resolvedModel = updateData.embeddingModel ?? kb.embeddingModel;
      const resolvedDimensions = await this._resolveEmbeddingDimensions(
        resolvedModel,
        provider,
        updateData.embeddingDimensions ?? null
      );

      // The collection exists but holds no points — recreate it so its
      // vector size matches the new model instead of failing on first upload.
      await this._deleteQdrantCollection(kb.qdrantCollectionName);
      await this._createQdrantCollection(kb.qdrantCollectionName, resolvedDimensions);

      sanitized.embeddingModel = resolvedModel;
      sanitized.providerId = provider._id;
      sanitized.embeddingDimensions = resolvedDimensions;
    }

    if (Object.keys(sanitized).length === 0) {
      throw new Error('No valid fields to update');
    }

    const updated = await knowledgeRepository.updateKb(kbId, sanitized);
    return updated;
  }

  /**
   * Deletes a knowledge base, its chunks, and the Qdrant collection.
   * `context` defaults to `personaExecutionContext(userId)`.
   */
  async deleteKnowledgeBase(kbId, userId, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context)) {
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
   * Developer Platform (blueprint Phase 10, PR-53, AD-08 §29): the Project
   * deletion cascade's Knowledge step — every KnowledgeBase in a Domain,
   * regardless of owner, unlike `deleteKnowledgeBase` above (which is
   * Subject/owner-scoped and not appropriate for a full Domain purge).
   * Reuses the same per-KB chunk + Qdrant-collection deletion logic that
   * method already has, just without the ownership check and looped across
   * every KB in the Domain instead of a single one.
   */
  async deleteAllByDomain(domain) {
    const kbs = await knowledgeRepository.findKbsByDomain(domain);
    for (const kb of kbs) {
      await knowledgeRepository.deleteChunksByKbId(kb._id);
      await this._deleteQdrantCollection(kb.qdrantCollectionName);
    }
    await knowledgeRepository.deleteMany({ domain });
    return kbs.length;
  }

  /**
   * Uploads files to a knowledge base — extracts text, chunks, embeds, indexes.
   * Supports multiple files in a single call.
   */
  /**
   * Developer Platform (blueprint Phase 9, PR-47b): `context` defaults to
   * `personaExecutionContext(userId)` — zero behavior change for the
   * existing Persona upload route.
   */
  async uploadFiles(kbId, userId, files, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context)) {
      throw new Error('Not authorized to upload to this knowledge base');
    }

    // Ensure the Qdrant collection exists with the KB's stored vector size
    const dimensions = await this._ensureKbDimensions(kb);
    await this._createQdrantCollection(kb.qdrantCollectionName, dimensions);

    const vectorStore = await this._getVectorStore(
      kb.qdrantCollectionName,
      kb.embeddingModel,
      kb.providerId,
      dimensions
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

  /**
   * Developer Platform (blueprint Phase 9, PR-47b): `context` is OPTIONAL
   * and OMITTED by default — unlike every other generalized method in this
   * codebase, the existing Persona `search` route (`knowledge.controller.js`)
   * calls this with no ownership check at all today (a pre-existing gap,
   * not introduced or widened here — preserved exactly as-is so this
   * change stays zero-behavior-change for that route). When the Developer
   * search route passes a `context` explicitly, this enforces the same
   * owner-or-public rule `getKnowledgeBase` already uses — the new
   * Developer code path is therefore MORE strictly checked than the
   * pre-existing Persona one, never less.
   */
  async searchKnowledgeBase(kbId, rawQuery, { topK } = {}, context) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (context && !isResourceOwner(kb, context) && !kb.isPublic) {
      throw new Error('Not authorized to access this knowledge base');
    }

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
    const dimensions = await this._ensureKbDimensions(kb);
    const vectorStore = await this._getVectorStore(
      kb.qdrantCollectionName,
      kb.embeddingModel,
      kb.providerId,
      dimensions
    );

    // Perform similarity search — scores included so callers can threshold.
    const results = await vectorStore.similaritySearchWithScore(query, k);

    logger.info(
      `[KnowledgeService] Found ${results ? results.length : 0} results for query "${query}"`
    );

    // Enrich results with chunk metadata from MongoDB
    return results.map(([result, score]) => ({
      text: result.pageContent,
      source: result.metadata?.sourceName || 'unknown',
      score: typeof score === 'number' ? score : null,
    }));
  }

  /**
   * Deletes a single document (source file) and its chunks from a KB.
   * Removes corresponding points from the Qdrant collection.
   */
  /** See `uploadFiles`'s doc comment — identical `context` generalization. */
  async deleteDocumentFromKb(kbId, userId, sourceName, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context)) {
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
   * Lists the source documents in a knowledge base. See `uploadFiles`'s doc
   * comment — identical `context` generalization (owner-or-public rule).
   */
  async listDocumentSources(kbId, userId, context = personaExecutionContext(userId)) {
    const kb = await knowledgeRepository.findKbById(kbId);
    if (!kb) throw new Error('Knowledge base not found');
    if (!isResourceOwner(kb, context) && !kb.isPublic) {
      throw new Error('Not authorized');
    }
    return kb.documents || [];
  }

  /**
   * Developer Platform (AD-07 §19, blueprint Phase 9, PR-45): the Discovery
   * Contract — a GENUINELY SEPARATE code path from any Persona listing
   * (Knowledge has no marketplace-browse function today at all, unlike
   * Agent/Skill — `getUserKnowledgeBases` below only ever lists "my own",
   * so there's nothing existing to accidentally reuse), mirroring Agent's
   * PR-43 / Skill's PR-44 treatment exactly for consistency and to keep
   * this genuinely independent should Persona ever grow its own browse
   * feature later. Three modes, matching AD-07 §15's capability matrix:
   *   - `ProjectMachineContext`/`ProjectAdminContext` ("Project
   *     discovery"): every Knowledge Base in this Project's own Domain,
   *     any owner type.
   *   - `ProjectRuntimeContext` with `filters.scope === 'mine'`
   *     ("my Knowledge Bases"): Domain- and Subject-scoped to just that
   *     external user's own Knowledge Bases.
   *   - `ProjectRuntimeContext` otherwise ("Project-public browse"):
   *     Domain-scoped, public (`isPublic: true`) Knowledge Bases only.
   *
   * No secret-stripping formatter is needed — a KnowledgeBase's fields
   * (name, description, embeddingModel, chunkSize, etc.) are all metadata,
   * nothing as sensitive as an Agent's `systemPrompt`; the filter itself
   * already guarantees every result is one the requester may see.
   */
  _buildDeveloperDiscoveryFilter(context, filters = {}) {
    const extra = {};
    if (filters.search) {
      extra.name = { $regex: filters.search, $options: 'i' };
    }

    if (context?.principalType === 'ProjectMachine' || context?.principalType === 'ProjectAdmin') {
      return scopedFilter(context.domain, extra);
    }

    if (filters.scope === 'mine') {
      return scopedFilter(context?.domain, {
        ...extra,
        ownerType: 'ExternalUser',
        externalOwnerId: context?.externalUserId,
      });
    }

    return scopedFilter(context?.domain, { ...extra, isPublic: true });
  }

  async discoverKnowledgeBases(context, filters, pagination) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await knowledgeRepository.searchKbs(match, pagination);
  }

  async countDiscoverKnowledgeBases(context, filters) {
    const match = this._buildDeveloperDiscoveryFilter(context, filters);
    return await knowledgeRepository.countKbs(match);
  }
}

export default new KnowledgeService();
