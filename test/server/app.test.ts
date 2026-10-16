import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { openDatabase } from "../../server/db/database.ts";

let staticRoot: string;

beforeEach(() => {
  staticRoot = mkdtempSync(join(tmpdir(), "pokie-static-"));
  writeFileSync(join(staticRoot, "index.html"), "<p>app shell</p>");
  writeFileSync(join(staticRoot, "app.js"), "console.log('app');");
});

afterEach(() => {
  rmSync(staticRoot, { recursive: true });
});

describe("createApp", () => {
  it("reports health", async () => {
    const app = createApp({ db: openDatabase(":memory:") });

    const response = await app.request("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("returns a JSON 404 for an unknown API route", async () => {
    const app = createApp({ db: openDatabase(":memory:"), staticRoot });

    const response = await app.request("/api/nothing-here");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "This API route does not exist." });
  });

  it("serves a built frontend file", async () => {
    const app = createApp({ db: openDatabase(":memory:"), staticRoot });

    const response = await app.request("/app.js");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.log('app');");
  });

  it("serves the app shell for a client-side route", async () => {
    const app = createApp({ db: openDatabase(":memory:"), staticRoot });

    const response = await app.request("/games/123/host");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<p>app shell</p>");
  });
});
