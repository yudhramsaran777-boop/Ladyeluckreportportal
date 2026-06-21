// ============================================================================
// Lady E Luck Portal — Gmail Token Encryption Utilities (SERVER ONLY)
//
// Uses AES-256-GCM (Node.js built-in crypto). The encryption key is derived
// from GMAIL_TOKEN_ENCRYPTION_KEY (must be 32 bytes / 64 hex chars).
//
// Never import this file from client components or client-side modules.
// ============================================================================

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "Missing GMAIL_TOKEN_ENCRYPTION_KEY environment variable. " +
        "Set a 64-character hex string (32 bytes)."
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "GMAIL_TOKEN_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes)."
    );
  }
  return buf;
}

/**
 * Encrypt plaintext (e.g. a refresh token) and return base64-encoded ciphertext
 * plus a base64-encoded IV string for storage.
 */
export function encryptToken(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Concatenate ciphertext + auth tag, then base64-encode
  const combined = Buffer.concat([encrypted, tag]);
  return {
    ciphertext: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt a base64-encoded ciphertext (with embedded GCM auth tag) using
 * the stored IV. Throws on invalid key or tampered ciphertext.
 */
export function decryptToken(ciphertext: string, iv: string): string {
  const key = getEncryptionKey();
  const ivBuf = Buffer.from(iv, "base64");
  const combined = Buffer.from(ciphertext, "base64");

  // Last TAG_LENGTH bytes are the GCM auth tag
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(0, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
