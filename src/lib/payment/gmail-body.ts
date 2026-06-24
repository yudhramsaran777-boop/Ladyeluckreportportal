/**
 * Gmail MIME body decoding utilities.
 * SERVER-ONLY.
 *
 * Handles base64url decoding of Gmail message parts and extraction of
 * plain-text content from multipart MIME trees.
 */

import { createHash } from "crypto";
import type { GmailMessagePart } from "./gmail-client";

/**
 * Decode a base64url-encoded string to UTF-8 text.
 * Gmail uses base64url (RFC 4648 §5) for message body parts.
 */
export function decodeBase64Url(encoded: string): string {
  // Convert base64url → standard base64
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  // Pad if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

/**
 * Recursively collect all text/plain parts from a MIME message tree.
 */
function collectTextParts(part: GmailMessagePart, acc: string[]): void {
  if (part.mimeType === "text/plain" && part.body?.data) {
    acc.push(decodeBase64Url(part.body.data));
  }
  if (part.parts) {
    for (const child of part.parts) {
      collectTextParts(child, acc);
    }
  }
}

/**
 * Extract the combined plain-text body from a Gmail message payload.
 * Returns an empty string if no text/plain parts are found.
 */
export function extractPlainText(payload: GmailMessagePart): string {
  const parts: string[] = [];
  collectTextParts(payload, parts);
  return parts.join("\n");
}

/**
 * Get the value of a named MIME header (case-insensitive).
 * Looks only at the top-level payload headers.
 */
export function getHeader(
  payload: GmailMessagePart,
  name: string
): string | undefined {
  const lower = name.toLowerCase();
  return payload.headers?.find((h) => h.name.toLowerCase() === lower)?.value;
}

/**
 * Parse the raw email address from a "From" header value.
 * Handles both "Display Name <addr@host>" and bare "addr@host" forms.
 * Returns the address in lowercase.
 *
 * SECURITY: Only the address extracted here is compared against the sender
 * allowlist — the display name is discarded.
 */
export function parseFromAddress(fromHeader: string): string {
  const angleMatch = fromHeader.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  return fromHeader.trim().toLowerCase();
}

/**
 * Compute a SHA-256 hash of the sanitized plain-text body.
 * Used for body-level duplicate detection.
 *
 * Normalization: collapse whitespace before hashing so minor formatting
 * differences in the same email don't create different hashes.
 */
export function hashEmailBody(plainText: string): string {
  const normalized = plainText.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
