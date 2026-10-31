import { describe, expect, it } from "vitest";
import { applyBps } from "../src/lib/money";
import { allocateDiscount, calculateLineTotals, calculateTotals } from "../src/domain/pricing";
import { canTransition, QUOTE_TRANSITIONS } from "../src/domain/state-machine";
import { QuoteStatus } from "@prisma/client";

describe("money", () => {
  it("applies basis points without float money math", () => {
    expect(applyBps(10000, 1000)).toBe(1000);
    expect(applyBps(1999, 1000)).toBe(200);
  });
});

describe("pricing", () => {
  it("calculates line totals with discount and tax", () => {
    const line = calculateLineTotals({
      unitPrice: 1000,
      quantity: 2,
      taxBps: 1000,
      discountAmount: 500
    });

    expect(line.subtotal).toBe(2000);
    expect(line.discountAmount).toBe(500);
    expect(line.taxAmount).toBe(150);
    expect(line.total).toBe(1650);
  });

  it("allocates discount across lines", () => {
    const allocations = allocateDiscount([1000, 2000], 300);
    expect(allocations[0] + allocations[1]).toBe(300);
  });

  it("sums totals", () => {
    const line = calculateLineTotals({
      unitPrice: 1000,
      quantity: 1,
      taxBps: 0,
      discountAmount: 0
    });

    const totals = calculateTotals([line]);

    expect(totals.total).toBe(1000);
  });
});

describe("state machines", () => {
  it("allows valid quote transition", () => {
    expect(canTransition(QUOTE_TRANSITIONS, QuoteStatus.DRAFT, QuoteStatus.QUOTATION)).toBe(true);
  });

  it("blocks invalid quote transition", () => {
    expect(canTransition(QUOTE_TRANSITIONS, QuoteStatus.CLOSED, QuoteStatus.DRAFT)).toBe(false);
  });
});