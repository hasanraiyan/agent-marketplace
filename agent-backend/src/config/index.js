import dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
});

function parseJsonEnv(value, name) {
  if (!value || value.trim() === '') return null;

  try {
    const parsed = JSON.parse(value);

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${name} must be a JSON object`);
    }

    return parsed;
  } catch (err) {
    throw new Error(
      err.message === `${name} must be a JSON object` ? err.message : `${name} must be valid JSON`
    );
  }
}

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agent-marketplace',
  dbEncryptionKeys: parseJsonEnv(process.env.DB_ENCRYPTION_KEYS, 'DB_ENCRYPTION_KEYS'),
  dbEncryptionActiveKeyId: process.env.DB_ENCRYPTION_ACTIVE_KEY_ID || null,
  // Pepper for one-way hashing of Developer Platform Project credential secrets
  // (AD-01 §9.3) — deliberately separate from JWT_SECRET and DB_ENCRYPTION_KEYS,
  // since it protects a different secret class with a different (one-way,
  // never-reversible) storage model. See utils/credentialSecret.js.
  projectCredentialHashSecret: process.env.PROJECT_CREDENTIAL_HASH_SECRET || null,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    mailFrom: process.env.MAIL_FROM || 'Persona.ai <noreply@persona.ai>',
  },
  websiteUrl: process.env.WEBSITE_URL || 'https://persona.ai/',
  backendUrl:
    process.env.BACKEND_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 3000}`,
  cron: {
    deleteInactiveUsers: process.env.CRON_DELETE_INACTIVE_USERS || '0 3 * * *',
    cleanExpiredOTPs: process.env.CRON_CLEAN_EXPIRED_OTPS || '0 */6 * * *',
    retentionDays: parseInt(process.env.ACCOUNT_RETENTION_DAYS, 10) || 30,
  },
  ai: {
    openAiApiKey: process.env.OPENAI_API_KEY || null,
    openAiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    langsmithApiKey: process.env.LANGSMITH_API_KEY || null,
    langsmithProject: process.env.LANGSMITH_PROJECT || 'persona-ai-backend',
  },
  knowledge: {
    qdrantUrl: process.env.QDRANT_URL || 'https://your-cluster.cloud.qdrant.io',
    qdrantApiKey: process.env.QDRANT_API_KEY || null,
    embeddingModel: process.env.KNOWLEDGE_EMBEDDING_MODEL || 'text-embedding-3-small',
    chunkSize: parseInt(process.env.KNOWLEDGE_CHUNK_SIZE, 10) || 800,
    chunkOverlap: parseInt(process.env.KNOWLEDGE_CHUNK_OVERLAP, 10) || 100,
    topK: parseInt(process.env.KNOWLEDGE_TOP_K, 10) || 5,
  },
};

export default config;
