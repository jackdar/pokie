import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Game } from "../../src/core/game.ts";
import type { Database } from "../db/database.ts";
import type { GameEvents } from "../events.ts";
import { loadGame } from "../http.ts";

// Proxies and phone networks drop a connection that stays quiet for too long.
const keepAliveMs = 25_000;

export function eventRoutes(db: Database, events: GameEvents): Hono {
  const routes = new Hono();

  routes.get("/:gameId/events", (c) => {
    const { game } = loadGame(db, c.req.param("gameId"));

    return streamSSE(c, async (stream) => {
      const send = (latest: Game) =>
        stream.writeSSE({ event: "game", data: JSON.stringify(latest) });

      // Subscribe before the first send, so that no change can fall between the two.
      const unsubscribe = events.subscribe(game.id, (latest) => void send(latest));
      stream.onAbort(unsubscribe);

      await send(game);
      while (!stream.aborted && !stream.closed) {
        await stream.sleep(keepAliveMs);
        if (!stream.aborted) await stream.write(": keep-alive\n\n");
      }
      unsubscribe();
    });
  });

  return routes;
}
