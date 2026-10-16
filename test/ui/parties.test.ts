import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { EXTERNAL_HOLDER_ID } from "../../src/core/settlement.ts";
import { moneyHolderName, partyName } from "../../src/ui/parties.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "settled",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
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
    expect(partyName(baseGame, EXTERNAL_HOLDER_ID)).toBe("Dealer");
  });

  it("says when the player is unknown", () => {
    expect(partyName(baseGame, "zed")).toBe("Unknown player");
  });
});

describe("moneyHolderName", () => {
  it("names the holder of a cash box", () => {
    const game: Game = {
      ...baseGame,
      settlement: { mode: "cashBox", holder: { kind: "external", name: "Host" } },
    };
    expect(moneyHolderName(game)).toBe("Host");
    expect(partyName(game, EXTERNAL_HOLDER_ID)).toBe("Host");
  });

  it("names an outside holder", () => {
    expect(moneyHolderName(baseGame)).toBe("Dealer");
  });

  it("names a player who holds the money", () => {
    const game: Game = {
      ...baseGame,
      settlement: { mode: "escrow", holder: { kind: "player", playerId: "ann" } },
    };
    expect(moneyHolderName(game)).toBe("Ann");
  });

  it("is undefined when players pay each other", () => {
    expect(moneyHolderName({ ...baseGame, settlement: { mode: "direct" } })).toBeUndefined();
  });
});
