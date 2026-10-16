import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { describeBuyInLimits, describeTopUp } from "../../src/ui/buyInLimits.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  minBuyInMinor: 2000,
  maxBuyInMinor: 5000,
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("describeBuyInLimits", () => {
  it("describes a minimum and a maximum", () => {
    expect(describeBuyInLimits(baseGame)).toBe("Buy-ins from $20.00 to $50.00");
  });

  it("describes a maximum only", () => {
    expect(describeBuyInLimits({ ...baseGame, minBuyInMinor: undefined })).toBe(
      "Buy-ins up to $50.00",
    );
  });

  it("says nothing for a table without limits", () => {
    const game: Game = { ...baseGame, minBuyInMinor: undefined, maxBuyInMinor: undefined };
    expect(describeBuyInLimits(game)).toBeUndefined();
  });
});

describe("describeTopUp", () => {
  it("gives the range for a short stack", () => {
    expect(describeTopUp(baseGame, 1200)).toBe("You can buy in for $8.00 to $38.00.");
  });

  it("says when the stack is already at the maximum", () => {
    expect(describeTopUp(baseGame, 5000)).toBe("This stack is already at the table maximum.");
  });
});
