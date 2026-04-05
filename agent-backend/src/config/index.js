import dotenv from 'dotenv';

dotenv.config();

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
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/agent-marketplace',
  dbEncryptionKeys: parseJsonEnv(process.env.DB_ENCRYPTION_KEYS, 'DB_ENCRYPTION_KEYS'),
  dbEncryptionActiveKeyId: process.env.DB_ENCRYPTION_ACTIVE_KEY_ID || null,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    mailFrom: process.env.MAIL_FROM || 'Agent Marketplace <noreply@agentmarketplace.com>',
  },
  websiteUrl: process.env.WEBSITE_URL || 'https://agentmarketplace.vercel.app/',
  cron: {
    deleteInactiveUsers: process.env.CRON_DELETE_INACTIVE_USERS || '0 3 * * *',
    cleanExpiredOTPs: process.env.CRON_CLEAN_EXPIRED_OTPS || '0 */6 * * *',
    retentionDays: parseInt(process.env.ACCOUNT_RETENTION_DAYS, 10) || 30,
  },
};

export default config;
