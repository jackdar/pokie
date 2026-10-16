import { describe, expect, it } from "vitest";
import {
  assertValidBuyInLimits,
  buyInLimitError,
  buyInRange,
  hasBuyInLimits,
} from "../../src/core/buyInLimits.ts";
import type { Game } from "../../src/core/game.ts";

// A $20 minimum and a $50 maximum.
const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
  minBuyInMinor: 2000,
  maxBuyInMinor: 5000,
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("buyInRange", () => {
  it("lets a first buy-in be anything from the minimum to the maximum", () => {
    expect(buyInRange(baseGame, 0)).toEqual({ smallest: 2000, largest: 5000 });
  });

  it("lets a player top up only to the maximum", () => {
    expect(buyInRange(baseGame, 1200)).toEqual({ smallest: 800, largest: 3800 });
  });

  it("asks for at least one cent when the player is above the minimum", () => {
    expect(buyInRange(baseGame, 3000)).toEqual({ smallest: 1, largest: 2000 });
  });

  it("has no largest amount when the table has no maximum", () => {
    expect(buyInRange({ ...baseGame, maxBuyInMinor: undefined }, 0).largest).toBeUndefined();
  });
});

describe("buyInLimitError", () => {
  it("allows a buy-in inside the limits", () => {
    expect(buyInLimitError(baseGame, 3800, 1200)).toBeUndefined();
  });

  it("explains a top-up past the maximum", () => {
    expect(buyInLimitError(baseGame, 4000, 1200)).toBe(
      "With $12.00 in front of them, a player can buy in for up to $38.00. The table maximum is $50.00.",
    );
  });

  it("explains a first buy-in under the minimum", () => {
    expect(buyInLimitError(baseGame, 1000, 0)).toBe("The table minimum is $20.00.");
  });

  it("explains a first buy-in over the maximum", () => {
    expect(buyInLimitError(baseGame, 6000, 0)).toBe("The table maximum is $50.00.");
  });

  it("says when a stack is already at the maximum", () => {
    expect(buyInLimitError(baseGame, 100, 5000)).toBe(
      "A stack of $50.00 is already at the table maximum of $50.00.",
    );
  });

  it("allows anything on a table without limits", () => {
    const game: Game = { ...baseGame, minBuyInMinor: undefined, maxBuyInMinor: undefined };
    expect(hasBuyInLimits(game)).toBe(false);
    expect(buyInLimitError(game, 999999, 0)).toBeUndefined();
  });
});

describe("assertValidBuyInLimits", () => {
  it("rejects a minimum above the maximum", () => {
    expect(() => assertValidBuyInLimits({ ...baseGame, minBuyInMinor: 6000 })).toThrow(
      "The table minimum cannot be more than the table maximum.",
    );
  });

  it("rejects a maximum of zero", () => {
    expect(() =>
      assertValidBuyInLimits({ ...baseGame, minBuyInMinor: undefined, maxBuyInMinor: 0 }),
    ).toThrow("The table maximum must be a whole number of cents more than zero.");
  });
});
