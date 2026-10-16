import { describe, expect, it } from "vitest";
import type { Game } from "../../../src/core/game.ts";
import { openDatabase } from "../../../server/db/database.ts";
import {
  deleteGamesUpdatedBefore,
  findGame,
  insertBuyIn,
  insertGame,
  insertPlayer,
  saveFinalCount,
} from "../../../server/db/gameRepo.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "escrow", holder: { kind: "external", name: "Dealer" } },
};

describe("findGame", () => {
  it("returns undefined for an unknown game", () => {
    const db = openDatabase(":memory:");
    expect(findGame(db, "missing")).toBeUndefined();
  });

  it("reads back a game with players in seat order, buy-ins, and counts", () => {
    const db = openDatabase(":memory:");
    insertGame(db, baseGame, "hash", "2026-10-16T19:00:00.000Z");
    insertPlayer(db, baseGame.id, { id: "bob", name: "Bob", seat: 5 });
    insertPlayer(db, baseGame.id, { id: "ann", name: "Ann", seat: 2 });
    const buyIn = {
      id: "b1",
      playerId: "ann",
      amountMinor: 1000,
      createdAt: "2026-10-16T19:01:00.000Z",
    };
    insertBuyIn(db, baseGame.id, buyIn);
    const finalCount = {
      playerId: "ann",
      count: { kind: "byDenomination" as const, counts: { red: 10 } },
      submittedBy: "host" as const,
    };
    saveFinalCount(db, baseGame.id, finalCount);

    expect(findGame(db, baseGame.id)).toEqual({
      hostTokenHash: "hash",
      playerTokenHashes: new Map(),
      game: {
        ...baseGame,
        players: [
          { id: "ann", name: "Ann", seat: 2 },
          { id: "bob", name: "Bob", seat: 5 },
        ],
        buyIns: [buyIn],
        finalCounts: [finalCount],
      },
    });
  });

  it("keeps one final count per player when a count is saved twice", () => {
    const db = openDatabase(":memory:");
    insertGame(db, baseGame, "hash", "2026-10-16T19:00:00.000Z");
    insertPlayer(db, baseGame.id, { id: "ann", name: "Ann", seat: 2 });
    saveFinalCount(db, baseGame.id, {
      playerId: "ann",
      count: { kind: "total", chipUnits: 100 },
      submittedBy: "host",
    });
    saveFinalCount(db, baseGame.id, {
      playerId: "ann",
      count: { kind: "total", chipUnits: 250 },
      submittedBy: "player",
    });

    expect(findGame(db, baseGame.id)?.game.finalCounts).toEqual([
      { playerId: "ann", count: { kind: "total", chipUnits: 250 }, submittedBy: "player" },
    ]);
  });
});

describe("insertPlayer", () => {
  it("keeps the token hash of a player who joined on their own", () => {
    const db = openDatabase(":memory:");
    insertGame(db, baseGame, "hash", "2026-10-16T19:00:00.000Z");
    insertPlayer(db, baseGame.id, { id: "ann", name: "Ann", seat: 0 }, "ann-hash");
    insertPlayer(db, baseGame.id, { id: "bob", name: "Bob", seat: 1 });

    expect(findGame(db, baseGame.id)?.playerTokenHashes).toEqual(new Map([["ann", "ann-hash"]]));
  });
});

describe("deleteGamesUpdatedBefore", () => {
  it("deletes old games with their rows and keeps recent games", () => {
    const db = openDatabase(":memory:");
    insertGame(db, { ...baseGame, id: "old" }, "hash", "2026-09-01T00:00:00.000Z");
    insertPlayer(db, "old", { id: "ann", name: "Ann", seat: 0 });
    insertGame(db, { ...baseGame, id: "recent" }, "hash", "2026-10-15T00:00:00.000Z");

    expect(deleteGamesUpdatedBefore(db, "2026-10-01T00:00:00.000Z")).toBe(1);
    expect(findGame(db, "old")).toBeUndefined();
    expect(findGame(db, "recent")).toBeDefined();
    expect(db.prepare("SELECT COUNT(*) AS n FROM players").get()).toEqual({ n: 0 });
  });
});
