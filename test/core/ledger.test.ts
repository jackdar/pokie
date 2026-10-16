import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import {
  ledgerEntries,
  playerTotals,
  poolSummary,
  suggestedBuyInMinor,
} from "../../src/core/ledger.ts";

// £10 buys 500 chips.
const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 500 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
  players: [
    { id: "ann", name: "Ann", seat: 0 },
    { id: "bob", name: "Bob", seat: 1 },
  ],
  buyIns: [
    { id: "b1", playerId: "ann", amountMinor: 1000, createdAt: "2026-10-16T19:00:00Z" },
    { id: "b2", playerId: "bob", amountMinor: 2000, createdAt: "2026-10-16T19:05:00Z" },
    { id: "b3", playerId: "ann", amountMinor: 1000, createdAt: "2026-10-16T20:00:00Z" },
  ],
  withdrawals: [
    {
      id: "w1",
      playerId: "bob",
      chipUnits: 300,
      leavesTable: true,
      createdAt: "2026-10-16T19:30:00Z",
    },
  ],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("ledgerEntries", () => {
  it("lists buy-ins and withdrawals newest first", () => {
    expect(ledgerEntries(baseGame).map((entry) => entry.id)).toEqual(["b3", "w1", "b2", "b1"]);
  });

  it("shows the chips that each buy-in bought", () => {
    expect(ledgerEntries(baseGame)[0]).toEqual({
      kind: "buyIn",
      id: "b3",
      playerId: "ann",
      createdAt: "2026-10-16T20:00:00Z",
      amountMinor: 1000,
      chipUnits: 500,
    });
  });

  it("returns an empty list for a new game", () => {
    expect(ledgerEntries({ ...baseGame, buyIns: [], withdrawals: [] })).toEqual([]);
  });
});

describe("playerTotals", () => {
  it("adds up one player's buy-ins and withdrawals", () => {
    expect(playerTotals(baseGame, "ann")).toEqual({
      paidInMinor: 2000,
      boughtChipUnits: 1000,
      withdrawnChipUnits: 0,
      countedChipUnits: undefined,
    });
    expect(playerTotals(baseGame, "bob")).toEqual({
      paidInMinor: 2000,
      boughtChipUnits: 1000,
      withdrawnChipUnits: 300,
      countedChipUnits: undefined,
    });
  });

  it("includes the final count once it is saved", () => {
    const game: Game = {
      ...baseGame,
      denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
      finalCounts: [
        {
          playerId: "ann",
          count: { kind: "byDenomination", counts: { red: 7 } },
          submittedBy: "host",
        },
      ],
    };
    expect(playerTotals(game, "ann").countedChipUnits).toBe(700);
  });
});

describe("poolSummary", () => {
  it("gives the money bought in and the chips still in play", () => {
    expect(poolSummary(baseGame)).toEqual({
      paidInMinor: 4000,
      withdrawnChipUnits: 300,
      chipUnitsInPlay: 1700,
    });
  });
});

describe("suggestedBuyInMinor", () => {
  it("suggests the latest buy-in amount", () => {
    expect(suggestedBuyInMinor(baseGame)).toBe(1000);
  });

  it("suggests nothing before anyone buys in", () => {
    expect(suggestedBuyInMinor({ ...baseGame, buyIns: [] })).toBeUndefined();
  });
});
