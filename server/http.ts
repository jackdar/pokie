import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { bearerToken, tokenMatchesHash } from "./auth.ts";
import type { Database } from "./db/database.ts";
import { findGame, type StoredGame } from "./db/gameRepo.ts";

export async function parseJsonBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "The request body must be valid JSON." });
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }
  return result.data;
}

export function loadGame(db: Database, gameId: string): StoredGame {
  const stored = findGame(db, gameId);
  if (!stored) {
    throw new HTTPException(404, { message: `Game "${gameId}" does not exist.` });
  }
  return stored;
}

export type Caller = { role: "host" } | { role: "player"; playerId: string } | { role: "guest" };

/** Finds out who sends the request. A token that matches nobody in the game is an error. */
export function identifyCaller(c: Context, stored: StoredGame): Caller {
  const token = bearerToken(c.req.header("Authorization"));
  if (!token) return { role: "guest" };
  if (tokenMatchesHash(token, stored.hostTokenHash)) return { role: "host" };
  for (const [playerId, tokenHash] of stored.playerTokenHashes) {
    if (tokenMatchesHash(token, tokenHash)) return { role: "player", playerId };
  }
  throw new HTTPException(403, { message: "The token is not correct for this game." });
}

export function requireHost(c: Context, stored: StoredGame): void {
  const caller = identifyCaller(c, stored);
  if (caller.role === "guest") {
    throw new HTTPException(401, { message: "This action needs the host token." });
  }
  if (caller.role !== "host") {
    throw new HTTPException(403, { message: "Only the host can do this." });
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
