import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { buyInMoneyNote, withdrawalMoneyNote } from "../../src/ui/settleModes.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
  players: [{ id: "ann", name: "Ann", seat: 0 }],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "cashBox", holder: { kind: "external", name: "Host" } },
};

describe("buyInMoneyNote", () => {
  it("tells the host to collect the buy-in", () => {
    expect(buyInMoneyNote(baseGame, 2000, { name: "Ann" })).toBe(
      "Collect $20.00 from Ann for Host.",
    );
  });

  it("tells a player who buys in on their own phone to pay", () => {
    expect(buyInMoneyNote(baseGame, 2000, "you")).toBe("Pay $20.00 to Host when you buy in.");
  });

  it("says nothing when buy-ins are paid at the end", () => {
    expect(
      buyInMoneyNote({ ...baseGame, settlement: { mode: "direct" } }, 2000, "you"),
    ).toBeUndefined();
  });
});

describe("withdrawalMoneyNote", () => {
  it("tells the holder to pay the withdrawal now", () => {
    expect(withdrawalMoneyNote(baseGame, 1500, "Ann")).toBe(
      "Host pays Ann $15.00 from the money now.",
    );
  });

  it("says nothing for a player who leaves with no chips", () => {
    expect(withdrawalMoneyNote(baseGame, 0, "Ann")).toBeUndefined();
  });
});
