import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertEditable, type BuyIn, type Game, type Player } from "../../src/core/game.ts";
import { assertConsistentGame } from "../../src/core/settlement.ts";
import { createToken, hashToken } from "../auth.ts";
import { inTransaction, type Database } from "../db/database.ts";
import { insertBuyIn, insertPlayer, touchGame } from "../db/gameRepo.ts";
import { identifyCaller, loadGame, nowIso, parseJsonBody } from "../http.ts";
import { addPlayerSchema } from "./schemas.ts";

export function playerRoutes(db: Database): Hono {
  const routes = new Hono();

  // The host seats anyone. A guest with the game link seats themselves and gets a player token.
  routes.post("/:gameId/players", async (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    const caller = identifyCaller(c, stored);
    if (caller.role === "player") {
      throw new HTTPException(403, { message: "You already have a seat in this game." });
    }
    const body = await parseJsonBody(c, addPlayerSchema);
    assertEditable(stored.game, "players");

    const now = nowIso();
    const player: Player = { id: randomUUID(), name: body.name, seat: body.seat };
    const buyIn: BuyIn | undefined =
      body.buyInMinor === undefined
        ? undefined
        : { id: randomUUID(), playerId: player.id, amountMinor: body.buyInMinor, createdAt: now };
    const game: Game = {
      ...stored.game,
      players: [...stored.game.players, player],
      buyIns: buyIn ? [...stored.game.buyIns, buyIn] : stored.game.buyIns,
    };
    assertConsistentGame(game);

    const playerToken = caller.role === "guest" ? createToken() : undefined;
    inTransaction(db, () => {
      insertPlayer(db, game.id, player, playerToken && hashToken(playerToken));
      if (buyIn) insertBuyIn(db, game.id, buyIn);
      touchGame(db, game.id, now);
    });
    return c.json({ game: loadGame(db, game.id).game, player, playerToken }, 201);
  });

  return routes;
}
