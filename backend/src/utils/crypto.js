import crypto from 'crypto';
import config from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive consistent 32-byte key
function getDerivedKey(secret = config.credentialEncryptionKey) {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string or object to an encrypted string representation
 * Format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptCredential(data) {
  if (data === null || data === undefined) return null;
  const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string created by encryptCredential
 */
export function decryptCredential(encryptedString) {
  if (!encryptedString) return null;
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      // In case plaintext or legacy
      return encryptedString;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Calculate SHA-256 hash of a buffer or string
 */
export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export default {
  encryptCredential,
  decryptCredential,
  sha256
};
