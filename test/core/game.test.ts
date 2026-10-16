import { describe, expect, it } from "vitest";
import { assertEditable, changeStatus, type Game } from "../../src/core/game.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("changeStatus", () => {
  it("moves an open game to counting", () => {
    expect(changeStatus(baseGame, "counting").status).toBe("counting");
  });

  it("lets the host reopen a game during counting", () => {
    expect(changeStatus({ ...baseGame, status: "counting" }, "open").status).toBe("open");
  });

  it("lets the host reopen counting after settling", () => {
    expect(changeStatus({ ...baseGame, status: "settled" }, "counting").status).toBe("counting");
  });

  it("does not let an open game skip counting", () => {
    expect(() => changeStatus(baseGame, "settled")).toThrow('cannot move from "open" to "settled"');
  });

  it("closes a settled game", () => {
    expect(changeStatus({ ...baseGame, status: "settled" }, "closed").status).toBe("closed");
  });

  it("does not close a game that is not settled", () => {
    expect(() => changeStatus({ ...baseGame, status: "counting" }, "closed")).toThrow(
      'cannot move from "counting" to "closed"',
    );
  });

  it("never moves a closed game again", () => {
    for (const status of ["open", "counting", "settled"] as const) {
      expect(() => changeStatus({ ...baseGame, status: "closed" }, status)).toThrow(
        "This game is closed. It cannot change again.",
      );
    }
  });

  it("does not change the original game", () => {
    changeStatus(baseGame, "counting");
    expect(baseGame.status).toBe("open");
  });
});

describe("assertEditable", () => {
  it("blocks every edit in a closed game", () => {
    const closedGame: Game = { ...baseGame, status: "closed" };
    for (const edit of [
      "name",
      "tableColour",
      "players",
      "seatCount",
      "buyIns",
      "withdrawals",
      "finalCounts",
      "chipSetup",
      "settlement",
    ] as const) {
      expect(() => assertEditable(closedGame, edit)).toThrow('while the game is "closed"');
    }
  });

  it("lets the host rename a settled game", () => {
    expect(() => assertEditable({ ...baseGame, status: "settled" }, "name")).not.toThrow();
  });

  it("allows buy-ins while the game is open", () => {
    expect(() => assertEditable(baseGame, "buyIns")).not.toThrow();
  });

  it("blocks buy-ins once counting starts", () => {
    expect(() => assertEditable({ ...baseGame, status: "counting" }, "buyIns")).toThrow(
      'You cannot change buy-ins while the game is "counting".',
    );
  });

  it("allows final counts only during counting", () => {
    expect(() => assertEditable(baseGame, "finalCounts")).toThrow("final counts");
    expect(() => assertEditable({ ...baseGame, status: "counting" }, "finalCounts")).not.toThrow();
  });

  it("allows a settlement mode change during counting", () => {
    expect(() => assertEditable({ ...baseGame, status: "counting" }, "settlement")).not.toThrow();
  });

  it("blocks every edit after the game is settled", () => {
    const settledGame: Game = { ...baseGame, status: "settled" };
    for (const edit of [
      "players",
      "seatCount",
      "buyIns",
      "withdrawals",
      "finalCounts",
      "chipSetup",
      "settlement",
    ] as const) {
      expect(() => assertEditable(settledGame, edit)).toThrow('while the game is "settled"');
    }
  });
});
