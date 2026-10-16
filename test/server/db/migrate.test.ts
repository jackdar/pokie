import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../../server/db/database.ts";
import { findGame, insertPlayer } from "../../../server/db/gameRepo.ts";
import { runMigrations, schemaVersion } from "../../../server/db/migrate.ts";
import { migrations } from "../../../server/db/migrations/index.ts";

// The schema of the first release: a currency column, and one player per seat.
const firstReleaseSchema = `
  CREATE TABLE games (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL,
    rate_minor INTEGER NOT NULL, rate_chips INTEGER NOT NULL,
    denominations_json TEXT NOT NULL, settlement_json TEXT NOT NULL, status TEXT NOT NULL,
    host_token_hash TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE players (
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seat INTEGER NOT NULL, name TEXT NOT NULL, token_hash TEXT, UNIQUE (game_id, seat)
  ) STRICT;
  CREATE TABLE buy_ins (
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL, created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE final_counts (
    game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    count_json TEXT NOT NULL, submitted_by TEXT NOT NULL, PRIMARY KEY (game_id, player_id)
  ) STRICT;
  INSERT INTO games VALUES ('g1', 'Old game', 'GBP', 1000, 1000, '[{"id":"red","colour":"Red","chipValue":100}]',
    '{"mode":"direct"}', 'counting', 'hash', '2026-10-16T19:00:00.000Z');
  INSERT INTO players VALUES ('ann', 'g1', 0, 'Ann', NULL);
  INSERT INTO buy_ins VALUES ('b1', 'g1', 'ann', 1000, '2026-10-16T19:00:00.000Z');
  INSERT INTO final_counts VALUES ('g1', 'ann', '{"kind":"total","chipUnits":1000}', 'host');
`;

// The schema just before the chip case: seats, colours, and withdrawals, but no chip columns.
const beforeChipCaseSchema = `
  CREATE TABLE games (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, rate_minor INTEGER NOT NULL, rate_chips INTEGER NOT NULL,
    denominations_json TEXT NOT NULL, settlement_json TEXT NOT NULL, status TEXT NOT NULL,
    seat_count INTEGER NOT NULL, table_colour TEXT NOT NULL,
    host_token_hash TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE players (
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seat INTEGER NOT NULL, name TEXT NOT NULL, token_hash TEXT
  ) STRICT;
  CREATE TABLE buy_ins (
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    amount_minor INTEGER NOT NULL, created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE withdrawals (
    id TEXT PRIMARY KEY, game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    chip_units INTEGER NOT NULL, leaves_table INTEGER NOT NULL, created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE final_counts (
    game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    count_json TEXT NOT NULL, submitted_by TEXT NOT NULL, PRIMARY KEY (game_id, player_id)
  ) STRICT;
  INSERT INTO games VALUES ('g1', 'Friday game', 1, 1, '[{"id":"red","colour":"Red","chipValue":100}]',
    '{"mode":"direct"}', 'open', 6, 'blue', 'hash', '2026-10-17T19:00:00.000Z');
  INSERT INTO players VALUES ('ann', 'g1', 2, 'Ann', NULL);
  INSERT INTO buy_ins VALUES ('b1', 'g1', 'ann', 2000, '2026-10-17T19:00:00.000Z');
  INSERT INTO withdrawals VALUES ('w1', 'g1', 'ann', 500, 0, '2026-10-17T20:00:00.000Z');
`;

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "pokie-migrate-"));
});

afterEach(() => {
  rmSync(folder, { recursive: true });
});

describe("runMigrations", () => {
  it("creates every table in a new database and records the latest version", () => {
    const db = openDatabase(":memory:");

    expect(schemaVersion(db)).toBe(migrations.at(-1)!.version);
    expect(findGame(db, "missing")).toBeUndefined();
  });

  it("upgrades a database from the first release without losing data", () => {
    const path = join(folder, "pokie.db");
    const legacy = new DatabaseSync(path);
    legacy.exec(firstReleaseSchema);
    legacy.close();

    const db = openDatabase(path);
    const stored = findGame(db, "g1");

    expect(stored?.game).toMatchObject({
      name: "Old game",
      seatCount: 8,
      tableColour: "green",
      joinCode: expect.stringMatching(/^[23456789ABCDEFGHJKMNPQRSTWXYZ]{6}$/),
      players: [{ id: "ann", name: "Ann", seat: 0 }],
      buyIns: [{ id: "b1", amountMinor: 1000 }],
      withdrawals: [],
      finalCounts: [{ playerId: "ann", count: { kind: "total", chipUnits: 1000 } }],
    });
    expect(stored?.game).not.toHaveProperty("currency");
  });

  it("removes the one player per seat rule from a first release database", () => {
    const path = join(folder, "pokie.db");
    const legacy = new DatabaseSync(path);
    legacy.exec(firstReleaseSchema);
    legacy.close();

    const db = openDatabase(path);

    expect(() => insertPlayer(db, "g1", { id: "bob", name: "Bob", seat: 0 })).not.toThrow();
  });

  it("upgrades a database from just before the chip case", () => {
    const path = join(folder, "pokie.db");
    const legacy = new DatabaseSync(path);
    legacy.exec(beforeChipCaseSchema);
    legacy.close();

    const db = openDatabase(path);

    expect(findGame(db, "g1")?.game).toMatchObject({
      seatCount: 6,
      tableColour: "blue",
      buyIns: [{ id: "b1", amountMinor: 2000 }],
      withdrawals: [{ id: "w1", chipUnits: 500, leavesTable: false }],
    });
  });

  it("gives every existing game its own join code", () => {
    const path = join(folder, "pokie.db");
    const legacy = new DatabaseSync(path);
    legacy.exec(beforeChipCaseSchema);
    legacy.exec(`INSERT INTO games VALUES ('g2', 'Another game', 1, 1, '[]', '{"mode":"direct"}',
      'open', 8, 'green', 'hash', '2026-10-17T19:00:00.000Z')`);
    legacy.close();

    const db = openDatabase(path);
    const codes = ["g1", "g2"].map((id) => findGame(db, id)?.game.joinCode);

    expect(codes[0]).toMatch(/^[23456789ABCDEFGHJKMNPQRSTWXYZ]{6}$/);
    expect(codes[1]).toMatch(/^[23456789ABCDEFGHJKMNPQRSTWXYZ]{6}$/);
    expect(codes[0]).not.toBe(codes[1]);
  });

  it("does nothing when the database is already up to date", () => {
    const path = join(folder, "pokie.db");
    openDatabase(path).close();

    const db = openDatabase(path);

    expect(schemaVersion(db)).toBe(migrations.at(-1)!.version);
  });

  it("refuses a database from a newer version of Pokie", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA user_version = 99");

    expect(() => runMigrations(db, migrations)).toThrow(
      `The database is at schema version 99, but this version of Pokie knows only up to ${migrations.at(-1)!.version}.`,
    );
  });

  it("leaves the database unchanged when a migration fails", () => {
    const db = new DatabaseSync(":memory:");
    const failing = [
      {
        version: 1,
        name: "creates a table, then fails",
        up: (target: DatabaseSync) => {
          target.exec("CREATE TABLE half_done (id TEXT)");
          throw new Error("Something went wrong.");
        },
      },
    ];

    expect(() => runMigrations(db, failing)).toThrow(
      "Database migration 1 (creates a table, then fails) failed. The database is unchanged.",
    );
    expect(schemaVersion(db)).toBe(0);
    expect(
      db.prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'").get(),
    ).toBeUndefined();
  });
});
