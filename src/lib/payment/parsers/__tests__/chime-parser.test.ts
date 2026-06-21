// ============================================================================
// Chime Parser — Fixture-Based Tests
// Run with: npx vitest run  (after npm install --save-dev vitest)
// ============================================================================

import { describe, it, expect } from "vitest";
import { parseChimeNotification } from "../chime-parser";

function ch(subject: string, body: string, receivedAt = "2025-06-15T14:30:00.000Z") {
  return parseChimeNotification({ subject, textBody: body, receivedAt });
}

// ---------------------------------------------------------------------------
// Incoming
// ---------------------------------------------------------------------------

describe("Chime — incoming", () => {
  it("parses 'you received $Y from X' format", () => {
    const r = ch(
      "Chime — you received money",
      "You received $75.00 from Jane Smith"
    );
    expect(r.activity_type).toBe("incoming");
    expect(r.status).toBe("confirmed");
    expect(r.amount).toBe(75);
    expect(r.provider).toBe("Chime");
    expect(r.parse_confidence).toBe("high");
  });

  it("parses 'X paid you $Y' format", () => {
    const r = ch("Chime — payment received", "Bob Johnson paid you $120.00");
    expect(r.activity_type).toBe("incoming");
    expect(r.amount).toBe(120);
    expect(r.counterparty_name).toContain("Bob Johnson");
  });

  it("parses deposit format", () => {
    const r = ch(
      "Chime deposit",
      "Deposit of $200.00 from Direct Deposit"
    );
    expect(r.activity_type).toBe("incoming");
    expect(r.amount).toBe(200);
  });

  it("captures absent note as null", () => {
    const r = ch("Chime", "You received $50.00 from Alice");
    expect(r.payment_note).toBeNull();
  });

  it("parses comma-formatted amount", () => {
    const r = ch("Chime", "You received $1,500.00 from Company");
    expect(r.amount).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// Outgoing
// ---------------------------------------------------------------------------

describe("Chime — outgoing", () => {
  it("parses 'you sent $Y to X' format", () => {
    const r = ch("Chime — you sent money", "You sent $45.00 to Mike Davis");
    expect(r.activity_type).toBe("outgoing");
    expect(r.status).toBe("confirmed");
    expect(r.amount).toBe(45);
  });

  it("parses transferred format", () => {
    const r = ch("Chime transfer", "You transferred $300.00 to External Bank");
    expect(r.activity_type).toBe("outgoing");
    expect(r.amount).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Request sent (if Chime supports it)
// ---------------------------------------------------------------------------

describe("Chime — request sent", () => {
  it("parses request sent if format is recognized", () => {
    const r = ch(
      "Chime — payment request",
      "You requested $60.00 from John Doe"
    );
    expect(r.activity_type).toBe("request_sent");
    expect(r.amount).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Request received (if Chime supports it)
// ---------------------------------------------------------------------------

describe("Chime — request received", () => {
  it("parses request received format", () => {
    const r = ch(
      "Chime — payment request",
      "Jane Smith requested $90.00 from you"
    );
    expect(r.activity_type).toBe("request_received");
    expect(r.amount).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Refund / reversal
// ---------------------------------------------------------------------------

describe("Chime — refund/reversal", () => {
  it("parses refund format", () => {
    const r = ch("Chime refund", "$50.00 has been refunded to your account.");
    expect(r.activity_type).toBe("refunded");
    expect(r.status).toBe("refunded");
    expect(r.amount).toBe(50);
  });

  it("parses reversal format", () => {
    const r = ch("Chime", "Your transfer has been reversed.");
    expect(r.activity_type).toBe("refunded");
    expect(r.status).toBe("refunded");
  });
});

// ---------------------------------------------------------------------------
// Failed / pending
// ---------------------------------------------------------------------------

describe("Chime — failed/pending", () => {
  it("parses payment failed format", () => {
    const r = ch("Chime — payment failed", "Payment failed. Please check your account.");
    expect(r.activity_type).toBe("failed");
    expect(r.status).toBe("failed");
  });

  it("parses unable to process format", () => {
    const r = ch(
      "Chime notification",
      "We were unable to process your payment of $25.00."
    );
    expect(r.activity_type).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Unknown format → needs_review
// ---------------------------------------------------------------------------

describe("Chime — unknown format", () => {
  it("routes unrecognized email to needs_review", () => {
    const r = ch("Chime newsletter", "Check out our latest features and offers!");
    expect(r.status).toBe("needs_review");
    expect(r.parse_confidence).toBe("low");
    expect(r.amount).toBeNull();
  });

  it("does not silently guess for empty body", () => {
    const r = ch("Chime", "");
    expect(r.status).toBe("needs_review");
  });
});

// ---------------------------------------------------------------------------
// Provider and currency defaults
// ---------------------------------------------------------------------------

describe("Chime — provider defaults", () => {
  it("always returns Chime provider", () => {
    const r = ch("Any", "Any body");
    expect(r.provider).toBe("Chime");
  });

  it("always returns USD currency", () => {
    const r = ch("Chime", "You received $10.00 from Someone");
    expect(r.currency).toBe("USD");
  });
});
