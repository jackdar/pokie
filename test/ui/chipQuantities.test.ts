import { describe, expect, it } from "vitest";
import type { ChipDenomination } from "../../src/core/chips.ts";
import { changeQuantity, parseQuantity, stackFromInputs } from "../../src/ui/chipQuantities.ts";

const denominations: ChipDenomination[] = [
  { id: "white", colour: "White", chipValue: 25 },
  { id: "red", colour: "Red", chipValue: 100 },
];

describe("parseQuantity", () => {
  it("reads an empty field as zero", () => {
    expect(parseQuantity("  ")).toBe(0);
  });

  it("rejects text that is not a whole number", () => {
    expect(parseQuantity("2.5")).toBeUndefined();
    expect(parseQuantity("-1")).toBeUndefined();
  });
});

describe("stackFromInputs", () => {
  it("keeps only the colours with chips", () => {
    expect(stackFromInputs({ white: "12", red: "" }, denominations)).toEqual({ white: 12 });
  });

  it("names the colour with a bad number", () => {
    expect(stackFromInputs({ white: "x", red: "1" }, denominations)).toBe(
      "Enter the number of White chips as a whole number.",
    );
  });
});

describe("changeQuantity", () => {
  it("adds and takes away one, but never goes below zero", () => {
    expect(changeQuantity({ red: "2" }, "red", 1)).toEqual({ red: "3" });
    expect(changeQuantity({ red: "" }, "red", -1)).toEqual({ red: "0" });
  });
});
