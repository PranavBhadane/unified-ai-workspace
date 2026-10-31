import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'unified_ai_workspace_secret_jwt_key_2026_super_secure!',
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY || 'unified_ai_workspace_32byte_enc_key_secure_2026!',
  
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'unified_ai_workspace',
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  },
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
  },
  
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/connections/google/callback'
  },
  
  storage: {
    rootPath: path.resolve(__dirname, process.env.STORAGE_PATH || '../../../storage')
  },

  whatsappApi: {
    baseUrl: process.env.WHATSAPP_API_BASE_URL || 'http://localhost:3001',
    apiKey: process.env.WHATSAPP_API_KEY || '',
    timeoutMs: parseInt(process.env.WHATSAPP_API_TIMEOUT_MS || '8000', 10),
    pollIntervalMs: parseInt(process.env.WHATSAPP_POLL_INTERVAL_MS || '5000', 10)
  }
};

export default config;
