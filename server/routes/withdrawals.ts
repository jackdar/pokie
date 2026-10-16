import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { assertEditable, type Game, type Withdrawal } from "../../src/core/game.ts";
import { assertConsistentGame } from "../../src/core/settlement.ts";
import { GameRuleError } from "../../src/core/errors.ts";
import { assertSeated, playerAtSeat } from "../../src/core/table.ts";
import { inTransaction, type Database } from "../db/database.ts";
import { deleteWithdrawal, insertWithdrawal, touchGame } from "../db/gameRepo.ts";
import { loadGame, nowIso, parseJsonBody, requireHost } from "../http.ts";
import { addWithdrawalSchema } from "./schemas.ts";

export function withdrawalRoutes(db: Database): Hono {
  const routes = new Hono();

  routes.post("/:gameId/withdrawals", async (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    requireHost(c, stored);
    const body = await parseJsonBody(c, addWithdrawalSchema);
    assertEditable(stored.game, "withdrawals");
    assertSeated(stored.game, body.playerId);

    const now = nowIso();
    const withdrawal: Withdrawal = {
      id: randomUUID(),
      playerId: body.playerId,
      chipUnits: body.chipUnits,
      leavesTable: body.leavesTable,
      createdAt: now,
      ...(body.chips ? { chips: body.chips } : {}),
    };
    const game: Game = { ...stored.game, withdrawals: [...stored.game.withdrawals, withdrawal] };
    assertConsistentGame(game);

    inTransaction(db, () => {
      insertWithdrawal(db, game.id, withdrawal);
      touchGame(db, game.id, now);
    });
    return c.json({ game, withdrawal }, 201);
  });

  routes.delete("/:gameId/withdrawals/:withdrawalId", (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    requireHost(c, stored);
    assertEditable(stored.game, "withdrawals");

    const withdrawalId = c.req.param("withdrawalId");
    const withdrawal = stored.game.withdrawals.find((w) => w.id === withdrawalId);
    if (!withdrawal) {
      throw new HTTPException(404, {
        message: `Withdrawal "${withdrawalId}" does not exist in this game.`,
      });
    }
    // Undoing a departure puts the player back in their seat.
    if (withdrawal.leavesTable) {
      const player = stored.game.players.find((p) => p.id === withdrawal.playerId);
      const occupant = player && playerAtSeat(stored.game, player.seat);
      if (player && occupant) {
        throw new GameRuleError(
          `Cannot undo: ${occupant.name} now sits in seat ${player.seat + 1}, which was ${player.name}'s seat.`,
        );
      }
    }
    const game: Game = {
      ...stored.game,
      withdrawals: stored.game.withdrawals.filter((w) => w.id !== withdrawalId),
    };
    assertConsistentGame(game);

    inTransaction(db, () => {
      deleteWithdrawal(db, game.id, withdrawalId);
      touchGame(db, game.id, nowIso());
    });
    return c.json({ game });
  });

  return routes;
}
