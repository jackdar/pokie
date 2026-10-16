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
    body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 1000 }),
  });
  playerId = (await playerResponse.json()).player.id;
});

describe("POST /api/games/:gameId/withdrawals", () => {
  it("records a partial withdrawal and keeps the player seated", async () => {
    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 400 }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.withdrawal).toMatchObject({ playerId, chipUnits: 400, leavesTable: false });

    const buyIn = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, amountMinor: 500 }),
    });
    expect(buyIn.status).toBe(201);
  });

  it("lets a player leave with no chips", async () => {
    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 0, leavesTable: true }),
    });

    expect(response.status).toBe(201);
  });

  it("rejects a zero withdrawal from a player who stays", async () => {
    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 0 }),
    });

    expect(response.status).toBe(422);
  });

  it("rejects a withdrawal from a player who has left", async () => {
    await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 1000, leavesTable: true }),
    });

    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 100 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Ann has left the table.");
  });

  it("blocks withdrawals once counting starts", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 100 }),
    });

    expect(response.status).toBe(422);
  });

  it("needs the host token", async () => {
    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, chipUnits: 100 }),
    });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/games/:gameId/withdrawals/:withdrawalId", () => {
  it("undoes a departure and puts the player back in their seat", async () => {
    const created = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 1000, leavesTable: true }),
    });
    const { withdrawal } = await created.json();

    const response = await app.request(`/api/games/${gameId}/withdrawals/${withdrawal.id}`, {
      method: "DELETE",
      headers: hostHeaders,
    });

    expect(response.status).toBe(200);
    expect((await response.json()).game.withdrawals).toEqual([]);
  });

  it("refuses to undo a departure after someone took the seat", async () => {
    const created = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId, chipUnits: 1000, leavesTable: true }),
    });
    const { withdrawal } = await created.json();
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Bob", seat: 0 }),
    });

    const response = await app.request(`/api/games/${gameId}/withdrawals/${withdrawal.id}`, {
      method: "DELETE",
      headers: hostHeaders,
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      "Cannot undo: Bob now sits in seat 1, which was Ann's seat.",
    );
  });

  it("returns 404 for an unknown withdrawal", async () => {
    const response = await app.request(`/api/games/${gameId}/withdrawals/missing`, {
      method: "DELETE",
      headers: hostHeaders,
    });

    expect(response.status).toBe(404);
  });
});
