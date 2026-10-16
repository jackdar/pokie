import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

const createGameBody = {
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
};

let app: Hono;
let gameId: string;
let playerId: string;
let hostHeaders: Record<string, string>;

beforeEach(async () => {
  app = createApp({ db: openDatabase(":memory:") });
  const gameResponse = await app.request("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createGameBody),
  });
  const created = await gameResponse.json();
  gameId = created.game.id;
  hostHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${created.hostToken}`,
  };

  const playerResponse = await app.request(`/api/games/${gameId}/players`, {
    method: "POST",
    headers: hostHeaders,
    body: JSON.stringify({ name: "Ann", seat: 0 }),
  });
  playerId = (await playerResponse.json()).player.id;
  await app.request(`/api/games/${gameId}/buy-ins`, {
    method: "POST",
    headers: hostHeaders,
    body: JSON.stringify({ playerId, amountMinor: 1000 }),
  });
  await app.request(`/api/games/${gameId}`, {
    method: "PATCH",
    headers: hostHeaders,
    body: JSON.stringify({ status: "counting" }),
  });
});

describe("PUT /api/games/:gameId/counts/:playerId", () => {
  it("saves a count by denomination", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "byDenomination", counts: { red: 10 } } }),
    });

    expect(response.status).toBe(200);
    expect((await response.json()).game.finalCounts).toEqual([
      { playerId, count: { kind: "byDenomination", counts: { red: 10 } }, submittedBy: "host" },
    ]);
  });

  it("replaces an earlier count for the same player", async () => {
    for (const chipUnits of [400, 1000]) {
      await app.request(`/api/games/${gameId}/counts/${playerId}`, {
        method: "PUT",
        headers: hostHeaders,
        body: JSON.stringify({ count: { kind: "total", chipUnits } }),
      });
    }

    const stored = await (await app.request(`/api/games/${gameId}`)).json();
    expect(stored.game.finalCounts).toEqual([
      { playerId, count: { kind: "total", chipUnits: 1000 }, submittedBy: "host" },
    ]);
  });

  it("needs the host token", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1000 } }),
    });

    expect(response.status).toBe(401);
  });

  it("lets a player who joined count their own chips", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "open" }),
    });
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", seat: 1, buyInMinor: 1000 }),
    });
    const bob = await joined.json();
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });
    const bobHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bob.playerToken}`,
    };

    const own = await app.request(`/api/games/${gameId}/counts/${bob.player.id}`, {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1500 } }),
    });
    const someoneElse = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: bobHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 0 } }),
    });

    expect(own.status).toBe(200);
    expect((await own.json()).game.finalCounts).toContainEqual({
      playerId: bob.player.id,
      count: { kind: "total", chipUnits: 1500 },
      submittedBy: "player",
    });
    expect(someoneElse.status).toBe(403);
    expect((await someoneElse.json()).error).toBe("You can count only your own chips.");
  });

  it("rejects a token that belongs to nobody in the game", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer made-up" },
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1000 } }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects a count for an unknown player", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/zed`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1000 } }),
    });

    expect(response.status).toBe(422);
  });

  it("rejects a count for a player who has left", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "open" }),
    });
    await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 1000, leavesTable: true }),
    });
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 0 } }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Ann has left the table.");
  });

  it("rejects an unknown denomination", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "byDenomination", counts: { blue: 3 } } }),
    });

    expect(response.status).toBe(422);
  });

  it("rejects a negative chip count", async () => {
    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "byDenomination", counts: { red: -1 } } }),
    });

    expect(response.status).toBe(400);
  });

  it("blocks counts after the game goes back to open", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "open" }),
    });

    const response = await app.request(`/api/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1000 } }),
    });

    expect(response.status).toBe(422);
  });
});
