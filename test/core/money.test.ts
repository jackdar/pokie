import { describe, expect, it } from "vitest";
import {
  assertMinorUnits,
  assertPositiveMinorUnits,
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
} from "../../src/core/money.ts";

describe("assertMinorUnits", () => {
  it("accepts whole numbers including zero and negatives", () => {
    expect(() => assertMinorUnits(0, "Amount")).not.toThrow();
    expect(() => assertMinorUnits(-250, "Amount")).not.toThrow();
  });

  it("rejects fractional amounts", () => {
    expect(() => assertMinorUnits(10.5, "Amount")).toThrow(
      "Amount must be a whole number of cents",
    );
  });
});

describe("assertPositiveMinorUnits", () => {
  it("rejects zero", () => {
    expect(() => assertPositiveMinorUnits(0, "Buy-in")).toThrow("Buy-in must be more than zero");
  });
});

describe("formatMoney", () => {
  it("formats cents as dollars", () => {
    expect(formatMoney(1050, "en-US")).toBe("$10.50");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatMoney(-275, "en-US")).toBe("-$2.75");
  });

  it("groups thousands", () => {
    expect(formatMoney(123456, "en-US")).toBe("$1,234.56");
  });

  it("shows a plain dollar sign in any locale", () => {
    expect(formatMoney(1050, "en-GB")).toBe("$10.50");
  });
});

describe("parseMoneyInput", () => {
  it("reads whole and decimal amounts as cents", () => {
    expect(parseMoneyInput("20")).toBe(2000);
    expect(parseMoneyInput("12.5")).toBe(1250);
    expect(parseMoneyInput(" 1,000.05 ")).toBe(100005);
  });

  it("accepts a leading dollar sign", () => {
    expect(parseMoneyInput("$15")).toBe(1500);
  });

  it("rejects text that is not an amount", () => {
    expect(parseMoneyInput("")).toBeUndefined();
    expect(parseMoneyInput("ten")).toBeUndefined();
    expect(parseMoneyInput("-5")).toBeUndefined();
  });

  it("rejects more than two decimal places", () => {
    expect(parseMoneyInput("1.005")).toBeUndefined();
  });
});

describe("formatMoneyInput", () => {
  it("writes cents back in a form that parseMoneyInput reads", () => {
    expect(formatMoneyInput(1050)).toBe("10.50");
    expect(parseMoneyInput(formatMoneyInput(1050))).toBe(1050);
  });
});
