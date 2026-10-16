import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertEditable, type BuyIn, type Game } from "../../src/core/game.ts";
import { assertConsistentGame } from "../../src/core/settlement.ts";
import { assertSeated } from "../../src/core/table.ts";
import { inTransaction, type Database } from "../db/database.ts";
import { deleteBuyIn, insertBuyIn, touchGame } from "../db/gameRepo.ts";
import { loadGame, nowIso, parseJsonBody, requireHost } from "../http.ts";
import { addBuyInSchema } from "./schemas.ts";

export function buyInRoutes(db: Database): Hono {
  const routes = new Hono();

  routes.post("/:gameId/buy-ins", async (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    requireHost(c, stored);
    const body = await parseJsonBody(c, addBuyInSchema);
    assertEditable(stored.game, "buyIns");
    assertSeated(stored.game, body.playerId);

    const now = nowIso();
    const buyIn: BuyIn = {
      id: randomUUID(),
      playerId: body.playerId,
      amountMinor: body.amountMinor,
      createdAt: now,
    };
    const game: Game = { ...stored.game, buyIns: [...stored.game.buyIns, buyIn] };
    assertConsistentGame(game);

    inTransaction(db, () => {
      insertBuyIn(db, game.id, buyIn);
      touchGame(db, game.id, now);
    });
    return c.json({ game, buyIn }, 201);
  });

  routes.delete("/:gameId/buy-ins/:buyInId", (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    requireHost(c, stored);
    assertEditable(stored.game, "buyIns");

    const buyInId = c.req.param("buyInId");
    if (!stored.game.buyIns.some((buyIn) => buyIn.id === buyInId)) {
      throw new HTTPException(404, { message: `Buy-in "${buyInId}" does not exist in this game.` });
    }
    const game: Game = {
      ...stored.game,
      buyIns: stored.game.buyIns.filter((buyIn) => buyIn.id !== buyInId),
    };

    inTransaction(db, () => {
      deleteBuyIn(db, game.id, buyInId);
      touchGame(db, game.id, nowIso());
    });
    return c.json({ game });
  });

  return routes;
}
