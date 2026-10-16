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
let hostHeaders: Record<string, string>;

beforeEach(async () => {
  app = createApp({ db: openDatabase(":memory:") });
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

describe("POST /api/games/:gameId/players", () => {
  it("seats players where the host puts them and lists them in seat order", async () => {
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Bob", seat: 6 }),
    });
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "  Ann  ", seat: 2 }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).game.players).toEqual([
      { id: expect.any(String), name: "Ann", seat: 2 },
      { id: expect.any(String), name: "Bob", seat: 6 },
    ]);
  });

  it("records a first buy-in with the new player", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 2000 }),
    });

    const body = await response.json();
    expect(body.game.buyIns).toEqual([
      {
        id: expect.any(String),
        playerId: body.player.id,
        amountMinor: 2000,
        createdAt: expect.any(String),
      },
    ]);
  });

  it("rejects a seat that is already taken", async () => {
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 3 }),
    });

    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Bob", seat: 3, buyInMinor: 1000 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Seat 4 is already taken by Ann.");
    const stored = await (await app.request(`/api/games/${gameId}`)).json();
    expect(stored.game.buyIns).toEqual([]);
  });

  it("does not let a player who joins take a seat that someone sits in", async () => {
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", seat: 3 }),
    });

    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", seat: 3, buyInMinor: 1000 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Seat 4 is already taken by Ann.");
    const stored = await (await app.request(`/api/games/${gameId}`)).json();
    expect(stored.game.players.map((p: { name: string }) => p.name)).toEqual(["Ann"]);
    expect(stored.game.buyIns).toEqual([]);
  });

  it("rejects a seat beyond the table size", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 8 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Ann is in seat 9, but the table has 8 seats.");
  });

  it("lets a new player take the seat of a player who left", async () => {
    const annResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 1000 }),
    });
    const ann = (await annResponse.json()).player;
    await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: ann.id, chipUnits: 1000, leavesTable: true }),
    });

    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Bob", seat: 0 }),
    });

    expect(response.status).toBe(201);
  });

  it("lets a guest take a seat and gives them a player token", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 2000 }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.playerToken).toEqual(expect.any(String));
    expect(body.game.buyIns).toMatchObject([{ playerId: body.player.id, amountMinor: 2000 }]);
  });

  it("gives no player token to a player the host seats", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });

    expect((await response.json()).playerToken).toBeUndefined();
  });

  it("does not let a seated player take a second seat", async () => {
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });
    const { playerToken } = await joined.json();

    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${playerToken}` },
      body: JSON.stringify({ name: "Ann again", seat: 1 }),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("You already have a seat in this game.");
  });

  it("does not let a player act as the host", async () => {
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });
    const { playerToken } = await joined.json();

    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${playerToken}` },
      body: JSON.stringify({ status: "counting" }),
    });

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe("Only the host can do this.");
  });

  it("does not expose player token hashes", async () => {
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });

    const response = await app.request(`/api/games/${gameId}`);

    expect(await response.text()).not.toMatch(/token|hash/i);
  });

  it("rejects an empty name", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "   ", seat: 0 }),
    });

    expect(response.status).toBe(400);
  });

  it("blocks new players once counting starts", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });

    expect(response.status).toBe(422);
  });
});
