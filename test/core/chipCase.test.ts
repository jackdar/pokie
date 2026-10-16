import { describe, expect, it } from "vitest";
import type { ChipDenomination } from "../../src/core/chips.ts";
import {
  assertValidChipCase,
  caseContents,
  hasChipCase,
  planBuyIn,
  planStack,
  seatShare,
  stackChipCount,
  stackValue,
  stacksStillNeeded,
} from "../../src/core/chipCase.ts";
import type { Game } from "../../src/core/game.ts";

// One chip unit is one cent. The case holds $500 of white, $1,000 of red and so on.
const caseDenominations: ChipDenomination[] = [
  { id: "white", colour: "White", chipValue: 25, quantity: 100 },
  { id: "red", colour: "Red", chipValue: 100, quantity: 100 },
  { id: "green", colour: "Green", chipValue: 500, quantity: 50 },
  { id: "black", colour: "Black", chipValue: 2500, quantity: 20 },
];

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: caseDenominations,
  status: "open",
  seatCount: 8,
  tableColour: "green",
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("planStack", () => {
  it("fills small chips first while leaving a fair share for every seat", () => {
    const available = { white: 100, red: 100, green: 50, black: 20 };

    const plan = planStack(2000, caseDenominations, available, 8);

    // Each seat may take 12 white, 12 red, 6 green, and 2 black.
    expect(plan).toEqual({ chips: { white: 12, red: 12, green: 1 }, stacks: 8 });
    expect(stackValue(plan!.chips, caseDenominations)).toBe(2000);
  });

  it("uses the most chips that add up to the amount exactly", () => {
    const plan = planStack(
      2000,
      caseDenominations,
      { white: 100, red: 100, green: 50, black: 20 },
      8,
    );

    expect(stackChipCount(plan!.chips)).toBe(25);
  });

  it("plans for fewer stacks when the chips cannot cover them all", () => {
    const whiteOnly: ChipDenomination[] = [{ id: "white", colour: "White", chipValue: 25 }];

    // A $2 stack needs 8 white chips. 40 white chips cover 5 stacks, not 8.
    expect(planStack(200, whiteOnly, { white: 40 }, 8)).toEqual({
      chips: { white: 8 },
      stacks: 5,
    });
  });

  it("returns undefined when the chip values cannot make the amount", () => {
    const redOnly: ChipDenomination[] = [{ id: "red", colour: "Red", chipValue: 100 }];

    expect(planStack(150, redOnly, { red: 100 }, 1)).toBeUndefined();
  });

  it("returns undefined when there are not enough chips for even one stack", () => {
    expect(planStack(2000, caseDenominations, { white: 4 }, 1)).toBeUndefined();
  });
});

describe("caseContents", () => {
  it("takes out buy-in chips and puts back withdrawal chips", () => {
    const game: Game = {
      ...baseGame,
      players: [{ id: "ann", name: "Ann", seat: 0 }],
      buyIns: [
        {
          id: "b1",
          playerId: "ann",
          amountMinor: 2000,
          createdAt: "2026-10-16T19:00:00Z",
          chips: { white: 12, red: 12, green: 1 },
        },
      ],
      withdrawals: [
        {
          id: "w1",
          playerId: "ann",
          chipUnits: 500,
          leavesTable: false,
          createdAt: "2026-10-16T20:00:00Z",
          chips: { green: 1 },
        },
      ],
    };

    expect(caseContents(game)).toEqual({ white: 88, red: 88, green: 50, black: 20 });
  });
});

describe("seatShare", () => {
  it("divides the whole case between the seats", () => {
    expect(seatShare(baseGame)).toEqual({ white: 12, red: 12, green: 6, black: 2 });
  });
});

describe("planBuyIn", () => {
  it("gives the first player a full seat share on an empty table", () => {
    // Eight empty seats, so the new player's stack is one of eight.
    expect(planBuyIn(baseGame, 2000, "newPlayer")).toEqual({
      chips: { white: 12, red: 12, green: 1 },
      stacks: 8,
    });
  });

  it("keeps chips for the empty seats when a seated player buys in again", () => {
    const game: Game = {
      ...baseGame,
      seatCount: 2,
      players: [{ id: "ann", name: "Ann", seat: 0 }],
    };

    // One seat is empty, so a rebuy plans for two stacks: this one and one more.
    // Each stack may take 50 white and 50 red. 48 white ($12) and 8 red ($8) is the most chips for $20.
    expect(planBuyIn(game, 2000, "rebuy")).toEqual({
      chips: { white: 48, red: 8 },
      stacks: 2,
    });
  });

  it("plans nothing for a game without a chip case", () => {
    const game: Game = {
      ...baseGame,
      denominations: caseDenominations.map((d) => ({
        id: d.id,
        colour: d.colour,
        chipValue: d.chipValue,
      })),
    };

    expect(hasChipCase(game)).toBe(false);
    expect(planBuyIn(game, 2000, "newPlayer")).toBeUndefined();
  });
});

describe("stacksStillNeeded", () => {
  it("counts a new player's own seat among the empty seats", () => {
    expect(stacksStillNeeded(baseGame, "newPlayer")).toBe(8);
  });

  it("adds a rebuy on top of the empty seats", () => {
    const game: Game = { ...baseGame, players: [{ id: "ann", name: "Ann", seat: 0 }] };
    expect(stacksStillNeeded(game, "rebuy")).toBe(8);
    expect(stacksStillNeeded({ ...game, seatCount: 1 }, "rebuy")).toBe(1);
  });
});

describe("assertValidChipCase", () => {
  it("accepts a game with a chip case", () => {
    expect(() => assertValidChipCase(baseGame)).not.toThrow();
  });

  it("rejects a case with quantities for only some chips", () => {
    const game: Game = {
      ...baseGame,
      denominations: [...caseDenominations.slice(1), { id: "blue", colour: "Blue", chipValue: 50 }],
    };

    expect(() => assertValidChipCase(game)).toThrow("Enter how many you have of every chip");
  });

  it("rejects buy-in chips that do not add up to the buy-in", () => {
    const game: Game = {
      ...baseGame,
      players: [{ id: "ann", name: "Ann", seat: 0 }],
      buyIns: [
        {
          id: "b1",
          playerId: "ann",
          amountMinor: 2000,
          createdAt: "2026-10-16T19:00:00Z",
          chips: { red: 10 },
        },
      ],
    };

    expect(() => assertValidChipCase(game)).toThrow("must add up to the buy-in amount");
  });

  it("rejects taking more chips than the case holds", () => {
    const game: Game = {
      ...baseGame,
      players: [{ id: "ann", name: "Ann", seat: 0 }],
      buyIns: [
        {
          id: "b1",
          playerId: "ann",
          amountMinor: 75000,
          createdAt: "2026-10-16T19:00:00Z",
          chips: { black: 30 },
        },
      ],
    };

    expect(() => assertValidChipCase(game)).toThrow(
      "The chip case does not have enough Black chips. It is 10 short.",
    );
  });
});
