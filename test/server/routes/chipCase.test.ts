import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { caseContents } from "../../../src/core/chipCase.ts";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

const createGameBody = {
  name: "Friday game",
  seatCount: 4,
  denominations: [
    { id: "white", colour: "White", chipValue: 25, quantity: 100 },
    { id: "red", colour: "Red", chipValue: 100, quantity: 50 },
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

describe("chip case", () => {
  it("keeps how many of each chip the case holds", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect((await response.json()).game.denominations).toEqual(createGameBody.denominations);
  });

  it("takes the chips for a first buy-in out of the case", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({
        name: "Ann",
        seat: 0,
        buyInMinor: 1000,
        buyInChips: { white: 20, red: 5 },
      }),
    });

    expect(response.status).toBe(201);
    expect(caseContents((await response.json()).game)).toEqual({ white: 80, red: 45 });
  });

  it("puts withdrawn chips back in the case", async () => {
    const seated = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({
        name: "Ann",
        seat: 0,
        buyInMinor: 1000,
        buyInChips: { white: 20, red: 5 },
      }),
    });
    const { player } = await seated.json();

    const response = await app.request(`/api/games/${gameId}/withdrawals`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ playerId: player.id, chipUnits: 300, chips: { red: 3 } }),
    });

    expect(response.status).toBe(201);
    expect(caseContents((await response.json()).game)).toEqual({ white: 80, red: 48 });
  });

  it("rejects buy-in chips that do not add up to the buy-in", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 1000, buyInChips: { red: 5 } }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      "The chips for a buy-in must add up to the buy-in amount.",
    );
  });

  it("rejects a buy-in that needs more chips than the case holds", async () => {
    const response = await app.request(`/api/games/${gameId}/players`, {
      method: "POST",
      headers: hostHeaders,
      body: JSON.stringify({ name: "Ann", seat: 0, buyInMinor: 6000, buyInChips: { red: 60 } }),
    });

    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe(
      "The chip case does not have enough Red chips. It is 10 short.",
    );
  });

  it("rejects a game with quantities for only some chips", async () => {
    const response = await app.request("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createGameBody,
        denominations: [
          { colour: "White", chipValue: 25, quantity: 100 },
          { colour: "Red", chipValue: 100 },
        ],
      }),
    });

    expect(response.status).toBe(422);
  });
});
