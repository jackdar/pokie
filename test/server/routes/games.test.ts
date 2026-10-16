import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

const createGameBody = {
  name: "Friday game",
  rate: { minorUnits: 1000, chipUnits: 1000 },
  denominations: [
    { id: "red", colour: "Red", chipValue: 100 },
    { id: "black", colour: "Black", chipValue: 500 },
  ],
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

describe("POST /api/games", () => {
  it("creates an open game with defaults and returns a host token", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createGameBody),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.hostToken).toEqual(expect.any(String));
    expect(body.game).toMatchObject({
      name: "Friday game",
      status: "open",
      settlement: { mode: "direct" },
      players: [],
    });
  });

  it("counts chip values in minor units when no rate is given", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Cash game",
        denominations: [{ colour: "Red", chipValue: 100 }],
      }),
    });

    expect((await response.json()).game.rate).toEqual({ minorUnits: 1, chipUnits: 1 });
  });

  it("gives an id to each denomination that has none", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createGameBody,
        denominations: [{ colour: "Blue", chipValue: 25 }],
      }),
    });

    const body = await response.json();
    expect(body.game.denominations).toEqual([
      { id: expect.any(String), colour: "Blue", chipValue: 25 },
    ]);
  });

  it("rejects a body that fails validation", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createGameBody, rate: { minorUnits: 10.5, chipUnits: 1000 } }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("rate.minorUnits");
  });

  it("rejects a body that is not JSON", async () => {
    const response = await app.request("/api/games", { method: "POST", body: "not json" });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The request body must be valid JSON." });
  });

  it("rejects duplicate denomination ids", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createGameBody,
        denominations: [
          { id: "red", colour: "Red", chipValue: 100 },
          { id: "red", colour: "Pink", chipValue: 50 },
        ],
      }),
    });

    expect(response.status).toBe(422);
  });
});

describe("table colour", () => {
  it("gives a new game the green table", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect((await response.json()).game.tableColour).toBe("green");
  });

  it("lets the host change the table colour for everyone", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ tableColour: "purple" }),
    });

    const response = await app.request(`/api/games/${gameId}`);
    expect((await response.json()).game.tableColour).toBe("purple");
  });

  it("rejects a colour that is not on the list", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ tableColour: "pink" }),
    });

    expect(response.status).toBe(400);
  });
});

describe("seat count", () => {
  it("gives a new game 8 seats by default", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect((await response.json()).game.seatCount).toBe(8);
  });

  it("rejects a table with more than 10 seats", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createGameBody, seatCount: 11 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("The table must have 2 to 10 seats. Got 11.");
  });

  it("lets the host change the seat count while the game is open", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ seatCount: 6 }),
    });

    expect((await response.json()).game.seatCount).toBe(6);
  });

  it("does not remove a seat that a player sits in", async () => {
    await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 7 }),
    });

    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ seatCount: 6 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("Ann is in seat 8, but the table has 6 seats.");
  });
});

describe("GET /api/games/:gameId", () => {
  it("returns the game to anyone with the link", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect(response.status).toBe(200);
    expect((await response.json()).game.id).toBe(gameId);
  });

  it("does not expose the host token hash", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect(await response.text()).not.toMatch(/hash/i);
  });

  it("returns 404 for an unknown game", async () => {
    const response = await app.request("/api/games/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Game "missing" does not exist.' });
  });
});

describe("PATCH /api/games/:gameId", () => {
  it("returns 401 without a host token", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New name" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 403 with a wrong host token", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { ...hostHeaders, Authorization: "Bearer wrong" },
      body: JSON.stringify({ name: "New name" }),
    });

    expect(response.status).toBe(403);
  });

  it("saves new settings for the host", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({
        name: "Saturday game",
        settlement: { mode: "escrow", holder: { kind: "external", name: "Dealer" } },
      }),
    });

    const response = await app.request(`/api/games/${gameId}`);
    expect((await response.json()).game).toMatchObject({
      name: "Saturday game",
      settlement: { mode: "escrow", holder: { kind: "external", name: "Dealer" } },
    });
  });

  it("rejects an escrow holder who is not a player", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({
        settlement: { mode: "escrow", holder: { kind: "player", playerId: "zed" } },
      }),
    });

    expect(response.status).toBe(422);
  });

  it("blocks chip setup changes once counting starts", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ rate: { minorUnits: 500, chipUnits: 1000 } }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      'You cannot change the chip setup while the game is "counting".',
    );
  });

  it("rejects a status change that skips a step", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "settled" }),
    });

    expect(response.status).toBe(422);
  });

  it("refuses to settle while chips do not balance", async () => {
    const playerResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });
    const { player } = await playerResponse.json();
    await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, amountMinor: 1000 }),
    });
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "settled" }),
    });

    expect(response.status).toBe(409);
    expect((await response.json()).reconciliation.playersMissingCount).toEqual([player.id]);
  });
});

describe("closing a game", () => {
  it("closes a settled game and then refuses every change", async () => {
    const playerResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 1000 }),
    });
    const { player } = await playerResponse.json();
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });
    await app.request(`/api/games/${gameId}/counts/${player.id}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 1000 } }),
    });
    for (const status of ["settled", "closed"]) {
      const response = await app.request(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: hostHeaders,
        body: JSON.stringify({ status }),
      });
      expect(response.status).toBe(200);
    }

    const reopen = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });
    const rename = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ name: "New name" }),
    });
    const settlement = await app.request(`/api/games/${gameId}/settlement`);

    expect(reopen.status).toBe(422);
    expect((await reopen.json()).error).toBe("This game is closed. It cannot change again.");
    expect(rename.status).toBe(422);
    expect(settlement.status).toBe(200);
  });

  it("does not close a game before it is settled", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "closed" }),
    });

    expect(response.status).toBe(422);
  });
});

describe("GET /api/games/:gameId/settlement", () => {
  it("returns payments once the chips balance", async () => {
    const annResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });
    const ann = (await annResponse.json()).player;
    const bobResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Bob", seat: 1 }),
    });
    const bob = (await bobResponse.json()).player;
    for (const playerId of [ann.id, bob.id]) {
      await app.request(`/api/games/${gameId}/buy-ins`, {
        method: "POST",
        headers: hostHeaders,
        body: JSON.stringify({ playerId, amountMinor: 1000 }),
      });
    }
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });
    await app.request(`/api/games/${gameId}/counts/${ann.id}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "byDenomination", counts: { black: 3 } } }),
    });
    await app.request(`/api/games/${gameId}/counts/${bob.id}`, {
      method: "PUT",
      headers: hostHeaders,
      body: JSON.stringify({ count: { kind: "total", chipUnits: 500 } }),
    });

    const response = await app.request(`/api/games/${gameId}/settlement`);

    expect(response.status).toBe(200);
    expect((await response.json()).settlement).toMatchObject({
      ok: true,
      transfers: [{ from: bob.id, to: ann.id, amountMinor: 500 }],
    });
  });

  it("returns 409 with the reconciliation while chips do not balance", async () => {
    const playerResponse = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0 }),
    });
    const { player } = await playerResponse.json();
    await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, amountMinor: 1000 }),
    });

    const response = await app.request(`/api/games/${gameId}/settlement`);

    expect(response.status).toBe(409);
    expect((await response.json()).reconciliation).toMatchObject({
      issuedChipUnits: 1000,
      countedChipUnits: 0,
      isBalanced: false,
    });
  });
});
