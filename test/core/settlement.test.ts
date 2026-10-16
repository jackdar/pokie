import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import {
  EXTERNAL_ESCROW_ID,
  assertConsistentGame,
  escrowTransfers,
  minimalTransfers,
  netResults,
  reconcile,
  settle,
  type PlayerResult,
} from "../../src/core/settlement.ts";

// £10 buys 1000 chips, so one chip unit is worth one penny.
const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [
    { id: "white", colour: "White", chipValue: 25 },
    { id: "red", colour: "Red", chipValue: 100 },
    { id: "black", colour: "Black", chipValue: 500 },
  ],
  status: "counting",
  seatCount: 8,
  tableColour: "green",
  players: [
    { id: "ann", name: "Ann", seat: 0 },
    { id: "bob", name: "Bob", seat: 1 },
    { id: "cat", name: "Cat", seat: 2 },
  ],
  buyIns: [
    { id: "b1", playerId: "ann", amountMinor: 1000, createdAt: "2026-10-16T19:00:00Z" },
    { id: "b2", playerId: "bob", amountMinor: 1000, createdAt: "2026-10-16T19:00:00Z" },
    { id: "b3", playerId: "cat", amountMinor: 1000, createdAt: "2026-10-16T19:00:00Z" },
  ],
  withdrawals: [],
  finalCounts: [
    {
      playerId: "ann",
      count: { kind: "byDenomination", counts: { black: 3, red: 2 } },
      submittedBy: "player",
    },
    { playerId: "bob", count: { kind: "total", chipUnits: 800 }, submittedBy: "host" },
    {
      playerId: "cat",
      count: { kind: "byDenomination", counts: { white: 4, red: 4 } },
      submittedBy: "player",
    },
  ],
  settlement: { mode: "direct" },
};

describe("reconcile", () => {
  it("balances when counted chips equal issued chips", () => {
    expect(reconcile(baseGame)).toEqual({
      issuedChipUnits: 3000,
      withdrawnChipUnits: 0,
      countedChipUnits: 3000,
      differenceChipUnits: 0,
      playersMissingCount: [],
      isBalanced: true,
    });
  });

  it("reports extra chips on the table as a positive difference", () => {
    const game: Game = {
      ...baseGame,
      finalCounts: [
        ...baseGame.finalCounts.filter((c) => c.playerId !== "bob"),
        { playerId: "bob", count: { kind: "total", chipUnits: 850 }, submittedBy: "host" },
      ],
    };
    expect(reconcile(game)).toMatchObject({ differenceChipUnits: 50, isBalanced: false });
  });

  it("lists players who bought in but have no final count", () => {
    const game: Game = {
      ...baseGame,
      finalCounts: baseGame.finalCounts.filter((c) => c.playerId !== "cat"),
    };
    expect(reconcile(game)).toMatchObject({ playersMissingCount: ["cat"], isBalanced: false });
  });

  it("does not need a count from a player who never bought in", () => {
    const game: Game = {
      ...baseGame,
      players: [...baseGame.players, { id: "dan", name: "Dan", seat: 3 }],
    };
    expect(reconcile(game).isBalanced).toBe(true);
  });

  it("counts rebuys as issued chips", () => {
    const game: Game = {
      ...baseGame,
      buyIns: [
        ...baseGame.buyIns,
        { id: "b4", playerId: "cat", amountMinor: 500, createdAt: "2026-10-16T21:00:00Z" },
      ],
    };
    expect(reconcile(game)).toMatchObject({ issuedChipUnits: 3500, differenceChipUnits: -500 });
  });

  it("rejects a buy-in for an unknown player", () => {
    const game: Game = {
      ...baseGame,
      buyIns: [{ id: "b9", playerId: "zed", amountMinor: 1000, createdAt: "2026-10-16T19:00:00Z" }],
    };
    expect(() => reconcile(game)).toThrow('A buy-in refers to unknown player "zed"');
  });

  it("rejects two final counts for one player", () => {
    const game: Game = {
      ...baseGame,
      finalCounts: [...baseGame.finalCounts, baseGame.finalCounts[0]!],
    };
    expect(() => reconcile(game)).toThrow('"ann" has more than one final count');
  });
});

describe("netResults", () => {
  it("converts chips to money and nets them against buy-ins", () => {
    expect(netResults(baseGame)).toEqual([
      { playerId: "ann", paidInMinor: 1000, cashOutMinor: 1700, netMinor: 700 },
      { playerId: "bob", paidInMinor: 1000, cashOutMinor: 800, netMinor: -200 },
      { playerId: "cat", paidInMinor: 1000, cashOutMinor: 500, netMinor: -500 },
    ]);
  });

  it("refuses to calculate when chips do not reconcile", () => {
    const game: Game = { ...baseGame, finalCounts: baseGame.finalCounts.slice(0, 2) };
    expect(() => netResults(game)).toThrow("chip counts do not match");
  });

  it("gives leftover pennies to the largest remainders so totals still balance", () => {
    // £1 buys 3 chips. Each player ends with 1 chip, worth 33.33p each.
    const game: Game = {
      ...baseGame,
      rate: { minorUnits: 100, chipUnits: 3 },
      buyIns: [{ id: "b1", playerId: "ann", amountMinor: 100, createdAt: "2026-10-16T19:00:00Z" }],
      finalCounts: baseGame.players.map((player) => ({
        playerId: player.id,
        count: { kind: "total", chipUnits: 1 },
        submittedBy: "host",
      })),
    };
    const results = netResults(game);
    expect(results.map((r) => r.cashOutMinor)).toEqual([34, 33, 33]);
    expect(results.reduce((sum, r) => sum + r.netMinor, 0)).toBe(0);
  });

  it("gives leftover pennies to the player with the bigger remainder before seat order", () => {
    // £1 buys 3 chips. Ann's 1 chip leaves remainder 100, Bob's 2 chips leave remainder 200.
    const game: Game = {
      ...baseGame,
      rate: { minorUnits: 100, chipUnits: 3 },
      buyIns: [{ id: "b1", playerId: "ann", amountMinor: 100, createdAt: "2026-10-16T19:00:00Z" }],
      finalCounts: [
        { playerId: "ann", count: { kind: "total", chipUnits: 1 }, submittedBy: "host" },
        { playerId: "bob", count: { kind: "total", chipUnits: 2 }, submittedBy: "host" },
      ],
    };
    expect(netResults(game).map((r) => r.cashOutMinor)).toEqual([33, 67, 0]);
  });

  it("returns zero for everyone when all players break even", () => {
    const game: Game = {
      ...baseGame,
      finalCounts: baseGame.players.map((player) => ({
        playerId: player.id,
        count: { kind: "total", chipUnits: 1000 },
        submittedBy: "host",
      })),
    };
    expect(netResults(game).every((r) => r.netMinor === 0)).toBe(true);
  });
});

describe("withdrawals", () => {
  it("balances when withdrawn and counted chips equal issued chips", () => {
    // Cat hands in 300 chips mid-game, so 200 stay in front of Cat at the end.
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "cat",
          chipUnits: 300,
          leavesTable: false,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
      finalCounts: [
        ...baseGame.finalCounts.filter((c) => c.playerId !== "cat"),
        { playerId: "cat", count: { kind: "total", chipUnits: 200 }, submittedBy: "host" },
      ],
    };
    expect(reconcile(game)).toMatchObject({
      issuedChipUnits: 3000,
      withdrawnChipUnits: 300,
      countedChipUnits: 2700,
      isBalanced: true,
    });
    expect(netResults(game)[2]).toEqual({
      playerId: "cat",
      paidInMinor: 1000,
      cashOutMinor: 500,
      netMinor: -500,
    });
  });

  it("needs no final count from a player who left the table", () => {
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "cat",
          chipUnits: 500,
          leavesTable: true,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
      finalCounts: baseGame.finalCounts.filter((c) => c.playerId !== "cat"),
    };
    expect(reconcile(game)).toMatchObject({ playersMissingCount: [], isBalanced: true });
    expect(settle(game)).toMatchObject({
      ok: true,
      transfers: [
        { from: "cat", to: "ann", amountMinor: 500 },
        { from: "bob", to: "ann", amountMinor: 200 },
      ],
    });
  });

  it("rejects a zero withdrawal from a player who stays", () => {
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "cat",
          chipUnits: 0,
          leavesTable: false,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
    };
    expect(() => reconcile(game)).toThrow("must hand in some chips unless the player leaves");
  });

  it("rejects a player leaving twice", () => {
    const leave = {
      playerId: "cat",
      chipUnits: 0,
      leavesTable: true,
      createdAt: "2026-10-16T21:00:00Z",
    };
    const game: Game = {
      ...baseGame,
      withdrawals: [
        { ...leave, id: "w1" },
        { ...leave, id: "w2" },
      ],
    };
    expect(() => reconcile(game)).toThrow('"cat" cannot leave the table twice');
  });

  it("rejects a withdrawal for an unknown player", () => {
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "zed",
          chipUnits: 100,
          leavesTable: false,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
    };
    expect(() => reconcile(game)).toThrow('A withdrawal refers to unknown player "zed"');
  });
});

describe("minimalTransfers", () => {
  it("has each loser pay the single winner", () => {
    const results: PlayerResult[] = [
      { playerId: "ann", paidInMinor: 1000, cashOutMinor: 1700, netMinor: 700 },
      { playerId: "bob", paidInMinor: 1000, cashOutMinor: 800, netMinor: -200 },
      { playerId: "cat", paidInMinor: 1000, cashOutMinor: 500, netMinor: -500 },
    ];
    expect(minimalTransfers(results)).toEqual([
      { from: "cat", to: "ann", amountMinor: 500 },
      { from: "bob", to: "ann", amountMinor: 200 },
    ]);
  });

  it("splits one loser's debt across several winners", () => {
    const results: PlayerResult[] = [
      { playerId: "ann", paidInMinor: 1000, cashOutMinor: 1300, netMinor: 300 },
      { playerId: "bob", paidInMinor: 1000, cashOutMinor: 1400, netMinor: 400 },
      { playerId: "cat", paidInMinor: 1000, cashOutMinor: 300, netMinor: -700 },
    ];
    expect(minimalTransfers(results)).toEqual([
      { from: "cat", to: "bob", amountMinor: 400 },
      { from: "cat", to: "ann", amountMinor: 300 },
    ]);
  });

  it("uses no more than one payment fewer than the players with a result", () => {
    const results: PlayerResult[] = [
      { playerId: "a", paidInMinor: 0, cashOutMinor: 0, netMinor: 450 },
      { playerId: "b", paidInMinor: 0, cashOutMinor: 0, netMinor: 120 },
      { playerId: "c", paidInMinor: 0, cashOutMinor: 0, netMinor: -300 },
      { playerId: "d", paidInMinor: 0, cashOutMinor: 0, netMinor: -170 },
      { playerId: "e", paidInMinor: 0, cashOutMinor: 0, netMinor: -100 },
    ];
    const transfers = minimalTransfers(results);
    expect(transfers.length).toBeLessThanOrEqual(4);
    expect(transfers.reduce((sum, t) => sum + t.amountMinor, 0)).toBe(570);
  });

  it("returns no payments when everyone breaks even", () => {
    const results: PlayerResult[] = [
      { playerId: "ann", paidInMinor: 1000, cashOutMinor: 1000, netMinor: 0 },
      { playerId: "bob", paidInMinor: 1000, cashOutMinor: 1000, netMinor: 0 },
    ];
    expect(minimalTransfers(results)).toEqual([]);
  });
});

describe("escrowTransfers", () => {
  const results: PlayerResult[] = [
    { playerId: "ann", paidInMinor: 1000, cashOutMinor: 1700, netMinor: 700 },
    { playerId: "bob", paidInMinor: 1000, cashOutMinor: 800, netMinor: -200 },
    { playerId: "cat", paidInMinor: 1000, cashOutMinor: 500, netMinor: -500 },
  ];

  it("routes every payment through an external holder", () => {
    expect(escrowTransfers(results, { kind: "external", name: "Dealer" })).toEqual([
      { from: EXTERNAL_ESCROW_ID, to: "ann", amountMinor: 700 },
      { from: "bob", to: EXTERNAL_ESCROW_ID, amountMinor: 200 },
      { from: "cat", to: EXTERNAL_ESCROW_ID, amountMinor: 500 },
    ]);
  });

  it("leaves out the holder's own result when the holder is a winner", () => {
    expect(escrowTransfers(results, { kind: "player", playerId: "ann" })).toEqual([
      { from: "bob", to: "ann", amountMinor: 200 },
      { from: "cat", to: "ann", amountMinor: 500 },
    ]);
  });

  it("leaves out the holder's own result when the holder is a loser", () => {
    expect(escrowTransfers(results, { kind: "player", playerId: "bob" })).toEqual([
      { from: "bob", to: "ann", amountMinor: 700 },
      { from: "cat", to: "bob", amountMinor: 500 },
    ]);
  });

  it("rejects a holder who is not in the game", () => {
    expect(() => escrowTransfers(results, { kind: "player", playerId: "zed" })).toThrow(
      'Escrow holder "zed" is not a player',
    );
  });
});

describe("settle", () => {
  it("returns the reconciliation instead of payments when chips do not match", () => {
    const game: Game = { ...baseGame, finalCounts: baseGame.finalCounts.slice(0, 2) };
    const settlement = settle(game);
    expect(settlement.ok).toBe(false);
    expect(settlement.reconciliation.playersMissingCount).toEqual(["cat"]);
  });

  it("settles directly between players in direct mode", () => {
    const settlement = settle(baseGame);
    expect(settlement).toMatchObject({
      ok: true,
      transfers: [
        { from: "cat", to: "ann", amountMinor: 500 },
        { from: "bob", to: "ann", amountMinor: 200 },
      ],
    });
    expect(settlement).not.toHaveProperty("escrow");
  });

  it("gives the escrow holder a list of who to collect from and who to pay", () => {
    const game: Game = {
      ...baseGame,
      settlement: { mode: "escrow", holder: { kind: "external", name: "Dealer" } },
    };
    expect(settle(game)).toMatchObject({
      ok: true,
      escrow: {
        holderId: EXTERNAL_ESCROW_ID,
        collect: [
          { from: "bob", to: EXTERNAL_ESCROW_ID, amountMinor: 200 },
          { from: "cat", to: EXTERNAL_ESCROW_ID, amountMinor: 500 },
        ],
        payOut: [{ from: EXTERNAL_ESCROW_ID, to: "ann", amountMinor: 700 }],
      },
    });
  });
});

describe("assertConsistentGame", () => {
  it("accepts a consistent game", () => {
    expect(() => assertConsistentGame(baseGame)).not.toThrow();
  });

  it("rejects two denominations with the same id", () => {
    const game: Game = {
      ...baseGame,
      denominations: [...baseGame.denominations, { id: "red", colour: "Pink", chipValue: 50 }],
    };
    expect(() => assertConsistentGame(game)).toThrow('Two chip denominations use the id "red"');
  });

  it("rejects an escrow holder who is not a player", () => {
    const game: Game = {
      ...baseGame,
      settlement: { mode: "escrow", holder: { kind: "player", playerId: "zed" } },
    };
    expect(() => assertConsistentGame(game)).toThrow(
      'The escrow holder refers to unknown player "zed"',
    );
  });

  it("rejects a final count that uses a removed denomination", () => {
    const game: Game = { ...baseGame, denominations: baseGame.denominations.slice(1) };
    expect(() => assertConsistentGame(game)).toThrow('unknown denomination "white"');
  });

  it("accepts a game whose chips do not balance yet", () => {
    const game: Game = { ...baseGame, finalCounts: [] };
    expect(() => assertConsistentGame(game)).not.toThrow();
  });
});
