import { describe, expect, it } from "vitest";
import type { Game } from "../../src/core/game.ts";
import { GameEvents } from "../../server/events.ts";

const baseGame: Game = {
  id: "game-1",
  name: "Friday game",
  rate: { minorUnits: 1, chipUnits: 1 },
  denominations: [],
  status: "open",
  seatCount: 8,
  tableColour: "green",
  players: [],
  buyIns: [],
  withdrawals: [],
  finalCounts: [],
  settlement: { mode: "direct" },
};

describe("GameEvents", () => {
  it("sends a published game to each listener of that game", () => {
    const events = new GameEvents();
    const first: Game[] = [];
    const second: Game[] = [];
    events.subscribe("game-1", (game) => first.push(game));
    events.subscribe("game-1", (game) => second.push(game));

    events.publish(baseGame);

    expect(first).toEqual([baseGame]);
    expect(second).toEqual([baseGame]);
  });

  it("does not send a game to listeners of another game", () => {
    const events = new GameEvents();
    const received: Game[] = [];
    events.subscribe("game-2", (game) => received.push(game));

    events.publish(baseGame);

    expect(received).toEqual([]);
  });

  it("stops sending after a listener unsubscribes", () => {
    const events = new GameEvents();
    const received: Game[] = [];
    const unsubscribe = events.subscribe("game-1", (game) => received.push(game));

    unsubscribe();
    events.publish(baseGame);

    expect(received).toEqual([]);
    expect(events.listenerCount("game-1")).toBe(0);
  });
});
