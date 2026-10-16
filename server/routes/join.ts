import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { normalizeJoinCode } from "../../src/core/joinCode.ts";
import type { Database } from "../db/database.ts";
import { findGameIdByJoinCode } from "../db/gameRepo.ts";

export function joinRoutes(db: Database): Hono {
  const routes = new Hono();

  routes.get("/:code", (c) => {
    const code = normalizeJoinCode(c.req.param("code"));
    const gameId = code && findGameIdByJoinCode(db, code);
    if (!gameId) {
      throw new HTTPException(404, {
        message: "No game has that code. Check the code with the host.",
      });
    }
    return c.json({ gameId });
  });

  return routes;
}
