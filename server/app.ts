import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { GameRuleError } from "../src/core/errors.ts";
import type { Database } from "./db/database.ts";
import { buyInRoutes } from "./routes/buyIns.ts";
import { finalCountRoutes } from "./routes/finalCounts.ts";
import { gameRoutes } from "./routes/games.ts";
import { playerRoutes } from "./routes/players.ts";
import { withdrawalRoutes } from "./routes/withdrawals.ts";

export type AppOptions = {
  db: Database;
  /** The folder with the built frontend. Leave it out to serve the API only. */
  staticRoot?: string;
};

export function createApp({ db, staticRoot }: AppOptions): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    if (error instanceof GameRuleError) {
      return c.json({ error: error.message }, 422);
    }
    console.error(error);
    return c.json({ error: "The server had an unexpected error." }, 500);
  });

  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.route("/api/games", gameRoutes(db));
  app.route("/api/games", playerRoutes(db));
  app.route("/api/games", buyInRoutes(db));
  app.route("/api/games", withdrawalRoutes(db));
  app.route("/api/games", finalCountRoutes(db));
  app.all("/api/*", (c) => c.json({ error: "This API route does not exist." }, 404));

  if (staticRoot) {
    app.use("*", serveStatic({ root: staticRoot }));
    // Client-side routes have no file on disk. Send the app shell so that a reload works.
    app.get("*", serveStatic({ root: staticRoot, path: "index.html" }));
  }

  return app;
}
