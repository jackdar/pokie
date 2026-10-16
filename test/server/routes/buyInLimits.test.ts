import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

// A $20 minimum and a $50 maximum.
const createGameBody = {
  name: "Friday game",
  denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
  minBuyInMinor: 2000,
  maxBuyInMinor: 5000,
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

describe("first buy-in", () => {
  it("keeps the table limits on the game", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect((await response.json()).game).toMatchObject({
      minBuyInMinor: 2000,
      maxBuyInMinor: 5000,
    });
  });

  it("rejects a first buy-in over the table maximum", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 6000 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe("The table maximum is $50.00.");
  });

  it("rejects a first buy-in under the table minimum", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 1000 }),
    });

    expect(response.status).toBe(422);
  });
});

describe("buying back in", () => {
  it("needs what the player still has in front of them", async () => {
    const seated = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 5000 }),
    });
    const { player } = await seated.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, amountMinor: 1000 }),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(
      "Enter what the player still has in front of them before they buy back in.",
    );
  });

  it("lets a player top up to the table maximum and records the stack", async () => {
    const seated = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 5000 }),
    });
    const { player } = await seated.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, amountMinor: 3800, stackBeforeMinor: 1200 }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).buyIn).toMatchObject({
      amountMinor: 3800,
      stackBeforeMinor: 1200,
    });
  });

  it("rejects a top-up past the table maximum", async () => {
    const seated = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 5000 }),
    });
    const { player } = await seated.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, amountMinor: 4000, stackBeforeMinor: 1200 }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      "With $12.00 in front of them, a player can buy in for up to $38.00. The table maximum is $50.00.",
    );
  });

  it("holds a player who buys in on their own to the same limits", async () => {
    const joined = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bob", seat: 1, buyInMinor: 3000 }),
    });
    const bob = await joined.json();

    const response = await app.request(`/api/games/${gameId}/buy-ins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bob.playerToken}`,
      },
      body: JSON.stringify({ playerId: bob.player.id, amountMinor: 3000, stackBeforeMinor: 3000 }),
    });

    expect(response.status).toBe(422);
  });
});

describe("changing the limits", () => {
  it("lets the host change and remove limits while the game is open", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ maxBuyInMinor: 10000, minBuyInMinor: null }),
    });

    const game = (await (await app.request(`/api/games/${gameId}`)).json()).game;
    expect(game.maxBuyInMinor).toBe(10000);
    expect(game.minBuyInMinor).toBeUndefined();
  });

  it("rejects a minimum above the maximum", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ minBuyInMinor: 6000 }),
    });

    expect(response.status).toBe(422);
  });

  it("blocks limit changes once counting starts", async () => {
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });

    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ maxBuyInMinor: 10000 }),
    });

    expect(response.status).toBe(422);
  });
});
