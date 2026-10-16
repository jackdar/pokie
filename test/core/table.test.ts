import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import {
  assertSeated,
  assertValidTable,
  hasLeftTable,
  playerAtSeat,
  seatedPlayers,
} from "../../src/core/table.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [],
  status: "open",
  seatCount: 6,
  tableColour: "green",
  joinCode: "K7QM4P",
  players: [
    { id: "ann", name: "Ann", seat: 0 },
    { id: "bob", name: "Bob", seat: 3 },
  ],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

const annLeft: Game = {
  ...baseGame,
  withdrawals: [
    {
      id: "w1",
      playerId: "ann",
      chipUnits: 500,
      leavesTable: true,
      createdAt: "2026-10-16T21:00:00Z",
    },
  ],
};

describe("hasLeftTable", () => {
  it("is false for a player with only partial withdrawals", () => {
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "ann",
          chipUnits: 500,
          leavesTable: false,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
    };
    expect(hasLeftTable(game, "ann")).toBe(false);
  });

  it("is true after a withdrawal that leaves the table", () => {
    expect(hasLeftTable(annLeft, "ann")).toBe(true);
  });
});

describe("seatedPlayers and playerAtSeat", () => {
  it("leave out players who have left", () => {
    expect(seatedPlayers(annLeft).map((p) => p.id)).toEqual(["bob"]);
    expect(playerAtSeat(annLeft, 0)).toBeUndefined();
    expect(playerAtSeat(annLeft, 3)?.name).toBe("Bob");
  });
});

describe("assertSeated", () => {
  it("rejects an unknown player", () => {
    expect(() => assertSeated(baseGame, "zed")).toThrow('Player "zed" is not in this game.');
  });

  it("rejects a player who has left", () => {
    expect(() => assertSeated(annLeft, "ann")).toThrow("Ann has left the table.");
  });
});

describe("assertValidTable", () => {
  it("accepts players in different seats", () => {
    expect(() => assertValidTable(baseGame)).not.toThrow();
  });

  it("rejects fewer than 2 seats", () => {
    expect(() => assertValidTable({ ...baseGame, players: [], seatCount: 1 })).toThrow(
      "The table must have 2 to 10 seats. Got 1.",
    );
  });

  it("rejects two seated players in one seat", () => {
    const game: Game = {
      ...baseGame,
      players: [...baseGame.players, { id: "cat", name: "Cat", seat: 3 }],
    };
    expect(() => assertValidTable(game)).toThrow("Seat 4 is already taken by Bob.");
  });

  it("lets a new player sit where a player left", () => {
    const game: Game = {
      ...annLeft,
      players: [...annLeft.players, { id: "cat", name: "Cat", seat: 0 }],
    };
    expect(() => assertValidTable(game)).not.toThrow();
  });

  it("rejects a seat beyond the table size", () => {
    expect(() => assertValidTable({ ...baseGame, seatCount: 3 })).toThrow(
      "Bob is in seat 4, but the table has 3 seats.",
    );
  });
});
