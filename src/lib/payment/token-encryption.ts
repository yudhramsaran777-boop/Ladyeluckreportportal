/**
 * AES-256-GCM token encryption for Gmail OAuth tokens.
 * SERVER-ONLY — never import from client components or browser-bundled code.
 *
 * Key: PAYMENT_TOKEN_ENCRYPTION_KEY environment variable (64 hex chars = 32 bytes)
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Storage format in the database:
 *   token_iv column       : hex(IV)  — 24 hex chars (12 bytes)
 *   encrypted_*_token col : hex(authTag) + ":" + hex(ciphertext)
 *                           authTag = 32 hex chars (16 bytes)
 *
 * Use storeEncryptedToken / loadEncryptedToken for DB read/write.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // bytes — 96-bit IV for GCM
const TAG_LENGTH = 16;  // bytes — 128-bit authentication tag

function getKey(): Buffer {
  const hex = process.env.PAYMENT_TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("PAYMENT_TOKEN_ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "PAYMENT_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
    );
  }
  return key;
}

/** Low-level encrypt. Returns iv/tag/data all as hex strings. */
export interface EncryptedParts {
  iv: string;   // hex, 24 chars
  tag: string;  // hex, 32 chars
  data: string; // hex, variable length
}

export function encryptRaw(plaintext: string): EncryptedParts {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("hex"),
  };
}

export function decryptRaw(parts: EncryptedParts): string {
  const key = getKey();
  const iv = Buffer.from(parts.iv, "hex");
  const tag = Buffer.from(parts.tag, "hex");
  const data = Buffer.from(parts.data, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/**
 * Encrypt a token for DB storage.
 * Returns { iv, tagAndData } matching the DB column layout.
 *
 *   iv         → store in token_iv or refresh_iv column
 *   tagAndData → store in encrypted_access_token or encrypted_refresh_token column
 */
export function storeEncryptedToken(plaintext: string): {
  iv: string;
  tagAndData: string;
} {
  const parts = encryptRaw(plaintext);
  return {
    iv: parts.iv,
    tagAndData: `${parts.tag}:${parts.data}`,
  };
}

/**
 * Decrypt a token read from DB storage.
 *
 * @param iv         — value from token_iv or refresh_iv column
 * @param tagAndData — value from encrypted_access_token or encrypted_refresh_token column
 */
export function loadEncryptedToken(iv: string, tagAndData: string): string {
  const colonIdx = tagAndData.indexOf(":");
  if (colonIdx === -1) {
    throw new Error("Stored token has invalid format (expected tag:data)");
  }
  return decryptRaw({
    iv,
    tag: tagAndData.slice(0, colonIdx),
    data: tagAndData.slice(colonIdx + 1),
  });
}
