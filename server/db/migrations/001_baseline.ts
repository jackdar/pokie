import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "../database.ts";
import { addColumnIfMissing, dropColumnIfPresent, type Migration } from "../migrate.ts";

const baselineSql = readFileSync(join(import.meta.dirname, "001_baseline.sql"), "utf8");

/**
 * Early versions allowed one player per seat. A new player may now take the seat of a player who left.
 * SQLite cannot drop a table constraint, so the table is copied without it.
 */
function removeOnePlayerPerSeatRule(db: Database): void {
  const table = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'players'")
    .get() as { sql: string } | undefined;
  if (!table || !/UNIQUE\s*\(\s*game_id\s*,\s*seat\s*\)/i.test(table.sql)) return;

  db.exec(`
    CREATE TABLE players_upgraded (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
      seat INTEGER NOT NULL,
      name TEXT NOT NULL,
      token_hash TEXT
    ) STRICT;
    INSERT INTO players_upgraded (id, game_id, seat, name, token_hash)
      SELECT id, game_id, seat, name, token_hash FROM players;
    DROP TABLE players;
    ALTER TABLE players_upgraded RENAME TO players;
    CREATE INDEX IF NOT EXISTS players_game_id ON players (game_id);
  `);
}

/**
 * Creates the tables in a new database. It also brings a database from a Pokie version made before
 * migrations existed up to the same schema. Those versions changed tables without recording it, so
 * each step checks the table first.
 */
export const baseline: Migration = {
  version: 1,
  name: "baseline",
  up(db) {
    db.exec(baselineSql);
    removeOnePlayerPerSeatRule(db);
    dropColumnIfPresent(db, "games", "currency");
    addColumnIfMissing(db, "games", "seat_count", "INTEGER NOT NULL DEFAULT 8");
    addColumnIfMissing(db, "games", "table_colour", "TEXT NOT NULL DEFAULT 'green'");
    addColumnIfMissing(db, "games", "min_buy_in_minor", "INTEGER");
    addColumnIfMissing(db, "games", "max_buy_in_minor", "INTEGER");
    addColumnIfMissing(db, "buy_ins", "chips_json", "TEXT");
    addColumnIfMissing(db, "buy_ins", "stack_before_minor", "INTEGER");
    addColumnIfMissing(db, "withdrawals", "chips_json", "TEXT");
  },
};
