import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { ChipDenomination } from "../../src/core/chips.ts";
import { assertEditable, changeStatus, type Game } from "../../src/core/game.ts";
import { assertConsistentGame, settle } from "../../src/core/settlement.ts";
import { createToken, hashToken } from "../auth.ts";
import { inTransaction, type Database } from "../db/database.ts";
import { insertGame, updateGameSettings } from "../db/gameRepo.ts";
import { loadGame, nowIso, parseJsonBody, requireHost } from "../http.ts";
import { createGameSchema, updateGameSchema } from "./schemas.ts";

type DenominationInput = {
  id?: string | undefined;
  colour: string;
  chipValue: number;
  quantity?: number | undefined;
};

function withIds(denominations: DenominationInput[]): ChipDenomination[] {
  return denominations.map((d) => ({
    id: d.id ?? randomUUID(),
    colour: d.colour,
    chipValue: d.chipValue,
    ...(d.quantity === undefined ? {} : { quantity: d.quantity }),
  }));
}

export function gameRoutes(db: Database): Hono {
  const routes = new Hono();

  routes.post("/", async (c) => {
    const body = await parseJsonBody(c, createGameSchema);
    const game: Game = {
      id: randomUUID(),
      name: body.name,
      rate: body.rate,
      denominations: withIds(body.denominations),
      status: "open",
      seatCount: body.seatCount,
      tableColour: body.tableColour,
      ...(body.minBuyInMinor === undefined ? {} : { minBuyInMinor: body.minBuyInMinor }),
      ...(body.maxBuyInMinor === undefined ? {} : { maxBuyInMinor: body.maxBuyInMinor }),
      players: [],
      buyIns: [],
      withdrawals: [],
      finalCounts: [],
      settlement: body.settlement,
    };
    assertConsistentGame(game);

    const hostToken = createToken();
    insertGame(db, game, hashToken(hostToken), nowIso());
    return c.json({ game, hostToken }, 201);
  });

  routes.get("/:gameId", (c) => {
    const { game } = loadGame(db, c.req.param("gameId"));
    return c.json({ game });
  });

  routes.patch("/:gameId", async (c) => {
    const stored = loadGame(db, c.req.param("gameId"));
    requireHost(c, stored);
    const body = await parseJsonBody(c, updateGameSchema);

    let game = stored.game;
    if (body.name !== undefined) {
      assertEditable(stored.game, "name");
      game = { ...game, name: body.name };
    }
    if (body.rate !== undefined || body.denominations !== undefined) {
      assertEditable(stored.game, "chipSetup");
      game = {
        ...game,
        rate: body.rate ?? game.rate,
        denominations: body.denominations ? withIds(body.denominations) : game.denominations,
      };
    }
    if (body.settlement !== undefined) {
      assertEditable(stored.game, "settlement");
      game = { ...game, settlement: body.settlement };
    }
    if (body.minBuyInMinor !== undefined || body.maxBuyInMinor !== undefined) {
      assertEditable(stored.game, "buyInLimits");
      // A field left out keeps its limit. A null removes the limit.
      const min = body.minBuyInMinor === undefined ? game.minBuyInMinor : body.minBuyInMinor;
      const max = body.maxBuyInMinor === undefined ? game.maxBuyInMinor : body.maxBuyInMinor;
      game = { ...game, minBuyInMinor: min ?? undefined, maxBuyInMinor: max ?? undefined };
    }
    if (body.tableColour !== undefined) {
      assertEditable(stored.game, "tableColour");
      game = { ...game, tableColour: body.tableColour };
    }
    if (body.seatCount !== undefined) {
      assertEditable(stored.game, "seatCount");
      game = { ...game, seatCount: body.seatCount };
    }
    assertConsistentGame(game);

    if (body.status !== undefined && body.status !== game.status) {
      game = changeStatus(game, body.status);
      if (game.status === "settled") {
        const settlement = settle(game);
        if (!settlement.ok) {
          return c.json(
            {
              error: "Cannot settle: the chip counts do not match the chips issued.",
              reconciliation: settlement.reconciliation,
            },
            409,
          );
        }
      }
    }

    inTransaction(db, () => updateGameSettings(db, game, nowIso()));
    return c.json({ game });
  });

  routes.get("/:gameId/settlement", (c) => {
    const { game } = loadGame(db, c.req.param("gameId"));
    const settlement = settle(game);
    if (!settlement.ok) {
      return c.json(
        {
          error: "Cannot settle: the chip counts do not match the chips issued.",
          reconciliation: settlement.reconciliation,
        },
        409,
      );
    }
    return c.json({ settlement });
  });

  return routes;
}
