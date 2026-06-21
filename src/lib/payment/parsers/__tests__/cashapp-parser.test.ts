// ============================================================================
// Cash App Parser — Fixture-Based Tests
// Run with: npx vitest run  (after npm install --save-dev vitest)
// Or verify logic with: node scripts/run-parser-tests.mjs
// ============================================================================

import { describe, it, expect } from "vitest";
import { parseCashAppNotification } from "../cashapp-parser";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function ca(subject: string, body: string, receivedAt = "2025-06-15T14:30:00.000Z") {
  return parseCashAppNotification({ subject, textBody: body, receivedAt });
}

// ---------------------------------------------------------------------------
// Incoming
// ---------------------------------------------------------------------------

describe("Cash App — incoming (received)", () => {
  it("parses 'X sent you $Y' format", () => {
    const r = ca(
      "Cash App — John Doe sent you $50.00",
      'John Doe ($johndoe) sent you $50.00\nfor "game credits"\nTransaction ID: TXNABC123'
    );
    expect(r.activity_type).toBe("incoming");
    expect(r.status).toBe("confirmed");
    expect(r.amount).toBe(50);
    expect(r.provider).toBe("CashApp");
    expect(r.parse_confidence).toBe("high");
  });

  it("parses 'You received $Y from X' format", () => {
    const r = ca(
      "You received $25.00",
      "You received $25.00 from Jane Smith ($janesmith)"
    );
    expect(r.activity_type).toBe("incoming");
    expect(r.amount).toBe(25);
    expect(r.counterparty_tag).toBe("$janesmith");
  });

  it("parses amount with comma formatting", () => {
    const r = ca(
      "Bob ($bigbob) sent you $1,200.00",
      "Bob ($bigbob) sent you $1,200.00"
    );
    expect(r.activity_type).toBe("incoming");
    expect(r.amount).toBe(1200);
  });

  it("captures payment note when present", () => {
    const r = ca(
      "You received $10.00",
      'You received $10.00 from Mike ($mike123)\nfor "slot tokens"'
    );
    expect(r.payment_note).toBe("slot tokens");
  });

  it("stores null for absent note", () => {
    const r = ca("Cash App", "Alice ($alice) sent you $5.00");
    expect(r.payment_note).toBeNull();
  });

  it("stores null for absent counterparty tag", () => {
    const r = ca("Cash App", "You received $30.00 from Someone");
    expect(r.counterparty_tag).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Outgoing
// ---------------------------------------------------------------------------

describe("Cash App — outgoing (sent)", () => {
  it("parses 'You sent $Y to X' format", () => {
    const r = ca(
      "Cash App — you sent $20.00",
      "You sent $20.00 to Player One ($playerone)"
    );
    expect(r.activity_type).toBe("outgoing");
    expect(r.status).toBe("confirmed");
    expect(r.amount).toBe(20);
    expect(r.counterparty_name).toContain("Player One");
  });

  it("parses sent without tag", () => {
    const r = ca("Cash App", "You sent $15.00 to Some Person");
    expect(r.activity_type).toBe("outgoing");
    expect(r.amount).toBe(15);
    expect(r.counterparty_tag).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Request sent
// ---------------------------------------------------------------------------

describe("Cash App — request sent", () => {
  it("parses request sent format", () => {
    const r = ca(
      "Cash App — payment request sent",
      "You requested $40.00 from John Doe ($johndoe)"
    );
    expect(r.activity_type).toBe("request_sent");
    expect(r.amount).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// Request received
// ---------------------------------------------------------------------------

describe("Cash App — request received", () => {
  it("parses request received format", () => {
    const r = ca(
      "Cash App — payment request",
      "John Doe ($johndoe) requested $30.00 from you"
    );
    expect(r.activity_type).toBe("request_received");
    expect(r.amount).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Refunded / reversed
// ---------------------------------------------------------------------------

describe("Cash App — refunded/reversed", () => {
  it("parses refund format", () => {
    const r = ca(
      "Cash App — refund",
      "$25.00 has been refunded to your account."
    );
    expect(r.activity_type).toBe("refunded");
    expect(r.status).toBe("refunded");
    expect(r.amount).toBe(25);
  });

  it("parses reversed format", () => {
    const r = ca(
      "Cash App — payment reversed",
      "Your payment of $50.00 has been reversed."
    );
    expect(r.activity_type).toBe("refunded");
    expect(r.status).toBe("refunded");
  });
});

// ---------------------------------------------------------------------------
// Failed / declined
// ---------------------------------------------------------------------------

describe("Cash App — failed/declined", () => {
  it("parses payment failed format", () => {
    const r = ca(
      "Cash App — payment failed",
      "Your $35.00 payment failed. Please try again."
    );
    expect(r.activity_type).toBe("failed");
    expect(r.status).toBe("failed");
  });

  it("parses payment declined format", () => {
    const r = ca(
      "Cash App",
      "Payment declined. Your transfer could not be completed."
    );
    expect(r.activity_type).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Unknown format → needs_review
// ---------------------------------------------------------------------------

describe("Cash App — unknown format", () => {
  it("routes unrecognized email to needs_review", () => {
    const r = ca(
      "Cash App notification",
      "This is a promotional message about Cash App features."
    );
    expect(r.status).toBe("needs_review");
    expect(r.parse_confidence).toBe("low");
    expect(r.amount).toBeNull();
  });

  it("routes empty body to needs_review", () => {
    const r = ca("Cash App", "");
    expect(r.status).toBe("needs_review");
  });
});

// ---------------------------------------------------------------------------
// Currency / amount formatting variations
// ---------------------------------------------------------------------------

describe("Cash App — amount formatting", () => {
  it("handles amount without cents", () => {
    const r = ca("Cash App", "Alice ($alice) sent you $100");
    expect(r.amount).toBe(100);
  });

  it("handles large comma-separated amount", () => {
    const r = ca("Cash App", "You sent $2,500.00 to Bob ($bob)");
    expect(r.amount).toBe(2500);
  });
});

// ---------------------------------------------------------------------------
// Provider and currency defaults
// ---------------------------------------------------------------------------

describe("Cash App — provider defaults", () => {
  it("always returns CashApp provider", () => {
    const r = ca("Any subject", "Any body");
    expect(r.provider).toBe("CashApp");
  });

  it("always returns USD currency", () => {
    const r = ca("Any subject", "Alice ($alice) sent you $10.00");
    expect(r.currency).toBe("USD");
  });
});
