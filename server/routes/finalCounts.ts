import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertEditable, type FinalCount, type Game } from "../../src/core/game.ts";
import { assertConsistentGame } from "../../src/core/settlement.ts";
import { assertSeated } from "../../src/core/table.ts";
import { inTransaction, type Database } from "../db/database.ts";
import { saveFinalCount, touchGame } from "../db/gameRepo.ts";
import { identifyCaller, loadGame, nowIso, parseJsonBody } from "../http.ts";
import { saveFinalCountSchema } from "./schemas.ts";

export function finalCountRoutes(db: Database): Hono {
  const routes = new Hono();

  routes.put("/:gameId/counts/:playerId", async (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    const playerId = c.req.param("playerId");
    const caller = identifyCaller(c, stored);
    if (caller.role === "guest") {
      throw new HTTPException(401, {
        message: "This action needs the host token or your player token.",
      });
    }
    if (caller.role === "player" && caller.playerId !== playerId) {
      throw new HTTPException(403, { message: "You can count only your own chips." });
    }
    const body = await parseJsonBody(c, saveFinalCountSchema);
    assertEditable(stored.game, "finalCounts");
    assertSeated(stored.game, playerId);

    const finalCount: FinalCount = {
      playerId,
      count: body.count,
      submittedBy: caller.role,
    };
    const game: Game = {
      ...stored.game,
      finalCounts: [
        ...stored.game.finalCounts.filter((existing) => existing.playerId !== finalCount.playerId),
        finalCount,
      ],
    };
    assertConsistentGame(game);

    inTransaction(db, () => {
      saveFinalCount(db, game.id, finalCount);
      touchGame(db, game.id, nowIso());
    });
    return c.json({ game });
  });

  return routes;
}
