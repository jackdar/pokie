import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import type { Game } from "../../../src/core/game.ts";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";
import { GameEvents } from "../../../server/events.ts";

const createGameBody = {
  name: "Friday game",
  denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
};

let app: Hono;
let events: GameEvents;
let gameId: string;
let hostHeaders: Record<string, string>;

beforeEach(async () => {
  events = new GameEvents();
  app = createApp({ db: openDatabase(":memory:"), events });
  const response = await app.request("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createGameBody),
  });
  const created = await response.json();
  gameId = created.game.id;
  hostHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${created.hostToken}`,
  };
});

describe("GET /api/games/:gameId/events", () => {
  it("streams the game when it opens and again after each change", async () => {
    const abort = new AbortController();
    const response = await app.request(`/api/games/${gameId}/events`, { signal: abort.signal });
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain("event: game");
    const firstGame: Game = JSON.parse(first.split("data: ")[1]!);
    expect(firstGame.players).toEqual([]);

    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 2000 }),
    });

    const second = decoder.decode((await reader.read()).value);
    const secondGame: Game = JSON.parse(second.split("data: ")[1]!);
    expect(secondGame.players.map((player) => player.name)).toEqual(["Ann"]);
    expect(secondGame.buyIns).toHaveLength(1);

    abort.abort();
    await reader.cancel();
  });

  it("stops listening when the screen closes the stream", async () => {
    const abort = new AbortController();
    const response = await app.request(`/api/games/${gameId}/events`, { signal: abort.signal });
    const reader = response.body!.getReader();
    await reader.read();
    expect(events.listenerCount(gameId)).toBe(1);

    await reader.cancel();

    expect(events.listenerCount(gameId)).toBe(0);
  });

  it("returns 404 for an unknown game", async () => {
    const response = await app.request("/api/games/missing/events");

    expect(response.status).toBe(404);
  });
});

describe("publishing changes", () => {
  it("publishes the saved game after a successful change", async () => {
    const published: Game[] = [];
    events.subscribe(gameId, (game) => published.push(game));

    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ tableColour: "blue" }),
    });

    expect(published.map((game) => game.tableColour)).toEqual(["blue"]);
  });

  it("publishes nothing when a change fails", async () => {
    const published: Game[] = [];
    events.subscribe(gameId, (game) => published.push(game));

    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "settled" }),
    });

    expect(published).toEqual([]);
  });

  it("publishes nothing for a read", async () => {
    const published: Game[] = [];
    events.subscribe(gameId, (game) => published.push(game));

    await app.request(`/api/games/${gameId}`);

    expect(published).toEqual([]);
  });
});
