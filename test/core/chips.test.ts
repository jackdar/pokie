import { describe, expect, it } from "vitest";
import {
  approximateMinorUnits,
  assertValidRate,
  chipValueOfCount,
  minorUnitsToChipUnits,
  type ChipDenomination,
} from "../../src/core/chips.ts";

const denominations: ChipDenomination[] = [
  { id: "white", colour: "White", chipValue: 25 },
  { id: "red", colour: "Red", chipValue: 100 },
  { id: "black", colour: "Black", chipValue: 500 },
];

describe("chipValueOfCount", () => {
  it("adds up chips by denomination", () => {
    const count = { kind: "byDenomination" as const, counts: { white: 4, red: 3, black: 1 } };
    expect(chipValueOfCount(count, denominations)).toBe(900);
  });

  it("returns a total count unchanged", () => {
    expect(chipValueOfCount({ kind: "total", chipUnits: 1234 }, denominations)).toBe(1234);
  });

  it("treats an empty count as zero", () => {
    expect(chipValueOfCount({ kind: "byDenomination", counts: {} }, denominations)).toBe(0);
  });

  it("rejects an unknown denomination", () => {
    const count = { kind: "byDenomination" as const, counts: { blue: 1 } };
    expect(() => chipValueOfCount(count, denominations)).toThrow('unknown denomination "blue"');
  });

  it("rejects a negative chip quantity", () => {
    const count = { kind: "byDenomination" as const, counts: { red: -1 } };
    expect(() => chipValueOfCount(count, denominations)).toThrow("Count of Red chips");
  });

  it("rejects a fractional total", () => {
    expect(() => chipValueOfCount({ kind: "total", chipUnits: 1.5 }, denominations)).toThrow(
      "Total chip value",
    );
  });
});

describe("minorUnitsToChipUnits", () => {
  it("converts a buy-in at the game rate", () => {
    expect(minorUnitsToChipUnits(2000, { minorUnits: 1000, chipUnits: 500 })).toBe(1000);
  });

  it("rejects a buy-in that does not convert to whole chips", () => {
    expect(() => minorUnitsToChipUnits(1, { minorUnits: 3, chipUnits: 1 })).toThrow(
      "does not convert to whole chips",
    );
  });
});

describe("assertValidRate", () => {
  it("rejects a zero chip amount", () => {
    expect(() => assertValidRate({ minorUnits: 1000, chipUnits: 0 })).toThrow("Rate chip amount");
  });

  it("rejects a zero money amount", () => {
    expect(() => assertValidRate({ minorUnits: 0, chipUnits: 1000 })).toThrow("Rate money amount");
  });
});

describe("approximateMinorUnits", () => {
  it("rounds a chip value to the nearest minor unit for display", () => {
    expect(approximateMinorUnits(300, { minorUnits: 1000, chipUnits: 1000 })).toBe(300);
    expect(approximateMinorUnits(2, { minorUnits: 100, chipUnits: 3 })).toBe(67);
  });
});
