import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { canSelectSeat, findViewer, viewerHint, type Viewer } from "../../src/ui/viewer.ts";

const ann = { id: "ann", name: "Ann", seat: 2 };
const bob = { id: "bob", name: "Bob", seat: 5 };

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  joinCode: "K7QM4P",
  players: [ann, bob],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

const host: Viewer = { role: "host", hostToken: "host-token" };
const annOnThisDevice: Viewer = { role: "player", player: ann, playerToken: "ann-token" };
const guest: Viewer = { role: "guest" };

describe("findViewer", () => {
  it("treats a device with the host token as the host", () => {
    expect(findViewer(baseGame, "host-token", undefined)).toEqual(host);
  });

  it("treats a device that joined as that player", () => {
    const joined = { gameId: "game-1", playerId: "ann", playerToken: "ann-token" };
    expect(findViewer(baseGame, undefined, joined)).toEqual(annOnThisDevice);
  });

  it("treats a player who left the table as a guest", () => {
    const game: Game = {
      ...baseGame,
      withdrawals: [
        {
          id: "w1",
          playerId: "ann",
          chipUnits: 0,
          leavesTable: true,
          createdAt: "2026-10-16T21:00:00Z",
        },
      ],
    };
    const joined = { gameId: "game-1", playerId: "ann", playerToken: "ann-token" };
    expect(findViewer(game, undefined, joined)).toEqual(guest);
  });

  it("treats anyone else as a guest", () => {
    expect(findViewer(baseGame, undefined, undefined)).toEqual(guest);
  });
});

describe("canSelectSeat", () => {
  it("lets a guest pick only a free seat while the game is open", () => {
    expect(canSelectSeat(guest, baseGame, undefined)).toBe(true);
    expect(canSelectSeat(guest, baseGame, bob)).toBe(false);
    expect(canSelectSeat(guest, { ...baseGame, status: "counting" }, undefined)).toBe(false);
  });

  it("lets a player tap only their own seat, to buy in or to count", () => {
    const counting: Game = { ...baseGame, status: "counting" };
    expect(canSelectSeat(annOnThisDevice, baseGame, ann)).toBe(true);
    expect(canSelectSeat(annOnThisDevice, counting, ann)).toBe(true);
    expect(canSelectSeat(annOnThisDevice, counting, bob)).toBe(false);
    expect(canSelectSeat(annOnThisDevice, baseGame, undefined)).toBe(false);
  });

  it("does not let a player tap their seat after the game is settled", () => {
    expect(canSelectSeat(annOnThisDevice, { ...baseGame, status: "settled" }, ann)).toBe(false);
  });

  it("lets the host tap any player, and free seats while the game is open", () => {
    expect(canSelectSeat(host, baseGame, bob)).toBe(true);
    expect(canSelectSeat(host, baseGame, undefined)).toBe(true);
    expect(canSelectSeat(host, { ...baseGame, status: "counting" }, undefined)).toBe(false);
  });
});

describe("viewerHint", () => {
  it("invites a guest to join while the game is open", () => {
    expect(viewerHint(guest, baseGame)).toBe("Tap a free seat on the table to join the game.");
  });

  it("tells a player how to buy in again while the game is open", () => {
    expect(viewerHint(annOnThisDevice, baseGame)).toBe(
      "You are in seat 3. Tap your seat to buy in again.",
    );
  });

  it("asks a player to count during counting", () => {
    expect(viewerHint(annOnThisDevice, { ...baseGame, status: "counting" })).toBe(
      "You are in seat 3. Tap your seat to count your chips.",
    );
  });

  it("shows no hint to the host", () => {
    expect(viewerHint(host, baseGame)).toBeUndefined();
  });
});
