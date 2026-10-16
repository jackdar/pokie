import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDatabase } from "./db/database.ts";
import { deleteGamesUpdatedBefore } from "./db/gameRepo.ts";

const port = Number(process.env.PORT ?? 8080);
const databasePath = process.env.DATABASE_PATH ?? "./data/pokie.db";
const staticRoot = process.env.STATIC_ROOT ?? "./dist";
const retentionDays = Number(process.env.GAME_RETENTION_DAYS ?? 30);

const oneDayMs = 24 * 60 * 60 * 1000;

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive whole number. Got "${process.env.PORT}".`);
}
if (!Number.isInteger(retentionDays) || retentionDays <= 0) {
  throw new Error(
    `GAME_RETENTION_DAYS must be a positive whole number. Got "${process.env.GAME_RETENTION_DAYS}".`,
  );
}

const db = openDatabase(databasePath);

function deleteExpiredGames(): void {
  const cutoff = new Date(Date.now() - retentionDays * oneDayMs).toISOString();
  const deleted = deleteGamesUpdatedBefore(db, cutoff);
  if (deleted > 0) {
    console.log(`Deleted ${deleted} game(s) with no change in ${retentionDays} days.`);
  }
}

deleteExpiredGames();
setInterval(deleteExpiredGames, oneDayMs).unref();

const server = serve({ fetch: createApp({ db, staticRoot }).fetch, port }, (info) => {
  console.log(`Pokie is listening on port ${info.port}. Database: ${databasePath}`);
});

function shutDown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Live update streams stay open until the browser closes them. End them so that the server can stop.
  if ("closeAllConnections" in server) server.closeAllConnections();
}

process.on("SIGTERM", shutDown);
process.on("SIGINT", shutDown);
