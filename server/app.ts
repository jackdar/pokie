import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { GameRuleError } from "../src/core/errors.ts";
import type { Database } from "./db/database.ts";
import { findGame } from "./db/gameRepo.ts";
import { GameEvents } from "./events.ts";
import { buyInRoutes } from "./routes/buyIns.ts";
import { eventRoutes } from "./routes/events.ts";
import { finalCountRoutes } from "./routes/finalCounts.ts";
import { gameRoutes } from "./routes/games.ts";
import { joinRoutes } from "./routes/join.ts";
import { playerRoutes } from "./routes/players.ts";
import { withdrawalRoutes } from "./routes/withdrawals.ts";

export type AppOptions = {
  db: Database;
  /** Tests pass their own hub to watch what the app publishes. */
  events?: GameEvents;
  /** The folder with the built frontend. Leave it out to serve the API only. */
  staticRoot?: string;
};

export function createApp({ db, events = new GameEvents(), staticRoot }: AppOptions): Hono {
  const app = new Hono();

  // After any change to a game succeeds, send the new game to every screen that watches it.
  const publishAfterWrite: MiddlewareHandler = async (c, next) => {
    await next();
    if (c.req.method === "GET" || !c.res.ok) return;
    const stored = findGame(db, c.req.param("gameId") ?? "");
    if (stored) events.publish(stored.game);
  };
  // This pattern matches /api/games/:gameId and every path below it.
  app.use("/api/games/:gameId/*", publishAfterWrite);

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
  app.route("/api/games", eventRoutes(db, events));
  app.route("/api/join", joinRoutes(db));
  app.all("/api/*", (c) => c.json({ error: "This API route does not exist." }, 404));

  if (staticRoot) {
    app.use("*", serveStatic({ root: staticRoot }));
    // Client-side routes have no file on disk. Send the app shell so that a reload works.
    app.get("*", serveStatic({ root: staticRoot, path: "index.html" }));
  }

  return app;
}
