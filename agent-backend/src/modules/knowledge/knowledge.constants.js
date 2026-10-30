/**
 * Embedding-model metadata used by the knowledge pipeline.
 *
 * Why this exists: a Qdrant collection's vector size has to match the
 * embedding model that fills it, and a mismatch is only discovered at
 * upsert time as an opaque Qdrant error ("expected dim: 1536, got 768").
 * Historically `knowledge.service.js` hardcoded 1536/3072 from the model
 * name, which silently restricted the whole module to OpenAI embeddings.
 *
 * Resolution order at Knowledge Base creation (see
 * `knowledge.service.js#_resolveEmbeddingDimensions`):
 *   1. The provider is probed with a one-token embedding call — always
 *      authoritative, and it fails fast when the provider is misconfigured.
 *   2. This table is the fallback/expected value used to validate an
 *      explicitly requested `embeddingDimensions` without a second probe.
 *
 * Model names are normalised (lowercased, Ollama-style `:tag` stripped)
 * before lookup, so `embeddinggemma-2:740m` resolves like `embeddinggemma-2`.
 */

/** Native (untruncated) output dimensions per embedding model. */
export const EMBEDDING_MODEL_DIMENSIONS = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  'text-embedding-ada-002-v2': 1536,

  // Google EmbeddingGemma (via Ollama or any OpenAI-compatible host)
  'embeddinggemma-2': 768,
  embeddinggemma: 768,

  // Popular local / OpenAI-compatible embedding models
  'nomic-embed-text': 768,
  'nomic-embed-text-v1.5': 768,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
  'bge-m3': 1024,
  'snowflake-arctic-embed': 1024,
  'snowflake-arctic-embed2': 1024,
};

/**
 * Models supporting Matryoshka Representation Learning (MRL) — the output
 * can be truncated to a shorter vector without re-training. The listed
 * values are the conventional checkpoints; an explicit `embeddingDimensions`
 * outside this list is still allowed as long as it is <= the native size
 * (providers are free to accept arbitrary integers).
 */
export const MRL_DIMENSIONS = {
  'text-embedding-3-small': [256, 512, 1024, 1536],
  'text-embedding-3-large': [256, 512, 1024, 3072],
  'embeddinggemma-2': [128, 256, 512, 768],
  embeddinggemma: [128, 256, 512, 768],
};

/** Strips an Ollama-style tag and lowercases, e.g. `EmbeddingGemma-2:740m`. */
export function normalizeEmbeddingModelName(modelName) {
  const raw = typeof modelName === 'string' ? modelName.trim() : '';
  if (!raw) return '';
  const withoutProviderPrefix = raw.includes(':') ? raw.split(':')[0] : raw;
  return withoutProviderPrefix.toLowerCase();
}

/** Native dimension for a known model, or `null` when unknown. */
export function knownEmbeddingDimensions(modelName) {
  const key = normalizeEmbeddingModelName(modelName);
  if (!key) return null;
  return EMBEDDING_MODEL_DIMENSIONS[key] ?? null;
}

/** Whether MRL truncation is supported for this model. */
export function supportsTruncatedDimensions(modelName) {
  const key = normalizeEmbeddingModelName(modelName);
  return Boolean(key && MRL_DIMENSIONS[key]);
}

/**
 * Provider types that speak the OpenAI `/v1/embeddings` shape. Anything
 * else (anthropic, gemini) has no drop-in embedding endpoint, so a
 * Knowledge Base pointing at one can never be indexed.
 */
export const OPENAI_COMPATIBLE_EMBEDDING_PROVIDER_TYPES = [
  'openai',
  'deepseek',
  'ollama',
  'custom',
];

/**
 * Deliberately conservative fallback used only when both the provider probe
 * and the static table fail (e.g. a brand-new model not in the table, with
 * the provider temporarily unreachable during an update). Matches the
 * historical hardcoded value so legacy Knowledge Bases keep working.
 */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
