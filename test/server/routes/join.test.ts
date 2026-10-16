import type { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../server/app.ts";
import { openDatabase } from "../../../server/db/database.ts";

let app: Hono;
let gameId: string;
let joinCode: string;

beforeEach(async () => {
  app = createApp({ db: openDatabase(":memory:") });
  const response = await app.request("/api/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Friday game",
      denominations: [{ colour: "Red", chipValue: 100 }],
    }),
  });
  const created = await response.json();
  gameId = created.game.id;
  joinCode = created.game.joinCode;
});

describe("join codes", () => {
  it("gives a new game a six character code", () => {
    expect(joinCode).toMatch(/^[23456789ABCDEFGHJKMNPQRSTWXYZ]{6}$/);
  });

  it("finds the game from its code", async () => {
    const response = await app.request(`/api/join/${joinCode}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ gameId });
  });

  it("finds the game from a code typed in lower case with a dash", async () => {
    const typed = `${joinCode.slice(0, 3)}-${joinCode.slice(3)}`.toLowerCase();

    const response = await app.request(`/api/join/${typed}`);

    expect(await response.json()).toEqual({ gameId });
  });

  it("returns 404 for a code that no game has", async () => {
    const unknown = joinCode === "222222" ? "333333" : "222222";

    const response = await app.request(`/api/join/${unknown}`);

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe(
      "No game has that code. Check the code with the host.",
    );
  });

  it("returns 404 for text that cannot be a code", async () => {
    const response = await app.request("/api/join/not-a-code");

    expect(response.status).toBe(404);
  });
});
