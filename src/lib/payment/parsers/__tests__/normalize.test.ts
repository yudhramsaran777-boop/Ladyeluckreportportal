// ============================================================================
// Normalize utilities — Fixture-Based Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  parseDollarAmount,
  normalizeCashTag,
  normalizePaymentTag,
  sanitizeText,
  normalizeSenderEmail,
  ALLOWED_SENDERS,
} from "../normalize";

describe("parseDollarAmount", () => {
  it("parses simple amount", () => expect(parseDollarAmount("25.00")).toBe(25));
  it("parses amount with dollar sign", () => expect(parseDollarAmount("$50.00")).toBe(50));
  it("parses comma-formatted amount", () => expect(parseDollarAmount("$1,200.50")).toBe(1200.5));
  it("parses integer amount", () => expect(parseDollarAmount("100")).toBe(100));
  it("returns null for null input", () => expect(parseDollarAmount(null)).toBeNull());
  it("returns null for empty string", () => expect(parseDollarAmount("")).toBeNull());
  it("returns null for negative", () => expect(parseDollarAmount("-10")).toBeNull());
  it("returns null for non-numeric", () => expect(parseDollarAmount("abc")).toBeNull());
});

describe("normalizeCashTag", () => {
  it("adds $ prefix if missing", () => expect(normalizeCashTag("johndoe")).toBe("$johndoe"));
  it("preserves $ prefix", () => expect(normalizeCashTag("$johndoe")).toBe("$johndoe"));
  it("lowercases tag", () => expect(normalizeCashTag("$JohnDoe")).toBe("$johndoe"));
  it("returns null for null", () => expect(normalizeCashTag(null)).toBeNull());
  it("returns null for empty", () => expect(normalizeCashTag("")).toBeNull());
  it("returns null for invalid chars", () => expect(normalizeCashTag("$!!bad")).toBeNull());
});

describe("normalizePaymentTag", () => {
  it("strips $ and lowercases", () => expect(normalizePaymentTag("$JohnDoe")).toBe("johndoe"));
  it("strips spaces", () => expect(normalizePaymentTag("$ john doe")).toBe("johndoe"));
  it("returns null for null", () => expect(normalizePaymentTag(null)).toBeNull());
});

describe("sanitizeText", () => {
  it("trims whitespace", () => expect(sanitizeText("  hello  ")).toBe("hello"));
  it("collapses internal spaces", () => expect(sanitizeText("hello   world")).toBe("hello world"));
  it("returns null for null", () => expect(sanitizeText(null)).toBeNull());
  it("truncates at maxLen", () => expect(sanitizeText("a".repeat(200), 10)).toBe("a".repeat(10)));
});

describe("normalizeSenderEmail", () => {
  it("lowercases email", () =>
    expect(normalizeSenderEmail("Cash@Square.COM")).toBe("cash@square.com"));
  it("trims whitespace", () =>
    expect(normalizeSenderEmail("  alerts@account.chime.com  ")).toBe("alerts@account.chime.com"));
});

describe("ALLOWED_SENDERS", () => {
  it("has correct Cash App sender", () =>
    expect(ALLOWED_SENDERS.CASHAPP).toBe("cash@square.com"));
  it("has correct Chime sender", () =>
    expect(ALLOWED_SENDERS.CHIME).toBe("alerts@account.chime.com"));
});
