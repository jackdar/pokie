import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

const createGameBody = {
  name: "Friday game",
  denominations: [{ id: "red", colour: "Red", chipValue: 100 }],
  settlement: { mode: "cashBox", holder: { kind: "external", name: "Host" } },
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

describe("cash box games", () => {
  it("keeps the cash box settlement mode", async () => {
    const response = await app.request(`/api/games/${gameId}`);

    expect((await response.json()).game.settlement).toEqual(createGameBody.settlement);
  });

  it("has the holder pay every player their chips at the end", async () => {
    const ids: string[] = [];
    for (const [name, seat] of [
      ["Ann", 0],
      ["Bob", 1],
    ] as const) {
      const seated = await app.request(`/api/games/${gameId}/players`, {
        method: "POST",
        headers: hostHeaders,
        body: JSON.stringify({ name, seat, buyInMinor: 2000 }),
      });
      ids.push((await seated.json()).player.id);
    }
    await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({ status: "counting" }),
    });
    for (const [playerId, chipUnits] of [
      [ids[0], 3500],
      [ids[1], 500],
    ] as const) {
      await app.request(`/api/games/${gameId}/counts/${playerId}`, {
        method: "PUT",
        headers: hostHeaders,
        body: JSON.stringify({ count: { kind: "total", chipUnits } }),
      });
    }

    const response = await app.request(`/api/games/${gameId}/settlement`);

    expect((await response.json()).settlement).toMatchObject({
      transfers: [
        { to: ids[0], amountMinor: 3500 },
        { to: ids[1], amountMinor: 500 },
      ],
      cashBox: { collectedMinor: 4000, paidDuringGameMinor: 0 },
    });
  });

  it("rejects a money holder who is not a player", async () => {
    const response = await app.request(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: hostHeaders,
      body: JSON.stringify({
        settlement: { mode: "cashBox", holder: { kind: "player", playerId: "zed" } },
      }),
    });

    expect(response.status).toBe(422);
  });
});
