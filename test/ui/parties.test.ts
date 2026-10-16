import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { EXTERNAL_ESCROW_ID } from "../../src/core/settlement.ts";
import { escrowHolderName, partyName } from "../../src/ui/parties.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "settled",
  seatCount: 8,
  tableColour: "green",
  players: [{ id: "ann", name: "Ann", seat: 0 }],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "escrow", holder: { kind: "external", name: "Dealer" } },
};

describe("partyName", () => {
  it("names a player", () => {
    expect(partyName(baseGame, "ann")).toBe("Ann");
  });

  it("names an escrow holder who does not play", () => {
    expect(partyName(baseGame, EXTERNAL_ESCROW_ID)).toBe("Dealer");
  });

  it("says when the player is unknown", () => {
    expect(partyName(baseGame, "zed")).toBe("Unknown player");
  });
});

describe("escrowHolderName", () => {
  it("names an outside holder", () => {
    expect(escrowHolderName(baseGame)).toBe("Dealer");
  });

  it("names a player who holds the money", () => {
    const game: Game = {
      ...baseGame,
      settlement: { mode: "escrow", holder: { kind: "player", playerId: "ann" } },
    };
    expect(escrowHolderName(game)).toBe("Ann");
  });

  it("is undefined when players pay each other", () => {
    expect(escrowHolderName({ ...baseGame, settlement: { mode: "direct" } })).toBeUndefined();
  });
});
