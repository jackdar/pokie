import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

const createGameBody = {
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 500 },
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
});

describe("POST /api/games/:gameId/buy-ins", () => {
  it("records a buy-in and a rebuy for the same player", async () => {
    for (const amountMinor of [1000, 500]) {
      const response = await app.request(`/api/games/${gameId}/buy-ins`, {
        method: "POST",
        headers: hostHeaders,
        body: JSON.stringify({ playerId, amountMinor }),
      });
      expect(response.status).toBe(201);
    }

    const stored = await (await app.request(`/api/games/${gameId}`)).json();
    expect(stored.game.buyIns).toMatchObject([
      { playerId, amountMinor: 1000 },
      { playerId, amountMinor: 500 },
    ]);
  });

  it("needs the host token or a player token", async () => {
    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, amountMinor: 1000 }),
    });

    expect(response.status).toBe(401);
  });

  it("lets a player who joined buy in again for themselves", async () => {
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", seat: 1, buyInMinor: 1000 }),
    });
    const bob = await joined.json();
    const bobHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bob.playerToken}`,
    };

    const own = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: bobHeaders,
      body: JSON.stringify({ playerId: bob.player.id, amountMinor: 500 }),
    });
    const forAnn = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: bobHeaders,
      body: JSON.stringify({ playerId, amountMinor: 500 }),
    });

    expect(own.status).toBe(201);
    expect(forAnn.status).toBe(403);
    expect((await forAnn.json()).error).toBe("You can buy in only for yourself.");
  });

  it("stops a player buying in once counting starts", async () => {
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

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bob.playerToken}`,
      },
      body: JSON.stringify({ playerId: bob.player.id, amountMinor: 500 }),
    });

    expect(response.status).toBe(422);
  });

  it("does not let a player undo a buy-in", async () => {
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", seat: 1, buyInMinor: 1000 }),
    });
    const bob = await joined.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins/${bob.game.buyIns[0].id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${bob.playerToken}` },
    });

    expect(response.status).toBe(403);
  });

  it("rejects a buy-in for an unknown player", async () => {
    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: "zed", amountMinor: 1000 }),
    });

    expect(response.status).toBe(422);
  });

  it("rejects a buy-in from a player who has left", async () => {
    await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 0, leavesTable: true }),
    });

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, amountMinor: 1000 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Ann has left the table.");
  });

  it("rejects a buy-in that does not convert to whole chips", async () => {
    // At £10 per 500 chips, 1p buys half a chip.
    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, amountMinor: 1 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("does not convert to whole chips");
  });

  it("rejects a zero amount", async () => {
    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, amountMinor: 0 }),
    });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/games/:gameId/buy-ins/:buyInId", () => {
  it("removes a buy-in", async () => {
    const created = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, amountMinor: 1000 }),
    });
    const { buyIn } = await created.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins/${buyIn.id}`, {
      method: "DELETE",
      headers: hostHeaders,
    });

    expect(response.status).toBe(200);
    const stored = await (await app.request(`/api/games/${gameId}`)).json();
    expect(stored.game.buyIns).toEqual([]);
  });

  it("returns 404 for an unknown buy-in", async () => {
    const response = await app.request(`/api/games/${gameId}/buy-ins/missing`, {
      method: "DELETE",
      headers: hostHeaders,
    });

    expect(response.status).toBe(404);
  });

  it("needs the host token", async () => {
    const response = await app.request(`/api/games/${gameId}/buy-ins/any`, { method: "DELETE" });

    expect(response.status).toBe(401);
  });
});
