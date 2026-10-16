import type { Database } from "./database.ts";

/**
 * One change to the database schema.
 * To change the schema, add a new migration with the next version number to the list in
 * migrations/index.ts. Never edit a migration that has run on a real database.
 */
export type Migration = {
  version: number;
  name: string;
  up: (db: Database) => void;
};

type ColumnInfo = { name: string };

function columnNames(db: Database, table: string): Set<string> {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  return new Set(columns.map((column) => column.name));
}

export function addColumnIfMissing(
  db: Database,
  table: string,
  column: string,
  definition: string,
): void {
  if (!columnNames(db, table).has(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function dropColumnIfPresent(db: Database, table: string, column: string): void {
  if (columnNames(db, table).has(column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

export function schemaVersion(db: Database): number {
  return (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
}

/**
 * Runs, in order, every migration that the database has not run yet.
 * The database keeps the version of its last migration in SQLite's user_version.
 * Foreign keys are off while a migration runs, so that a migration can copy a table that other
 * tables point to without deleting their rows. A foreign key check before each commit makes sure
 * that the migration left every reference intact.
 */
export function runMigrations(db: Database, migrations: Migration[]): void {
  const latest = migrations.reduce((max, migration) => Math.max(max, migration.version), 0);
  const current = schemaVersion(db);
  if (current > latest) {
    throw new Error(
      `The database is at schema version ${current}, but this version of Pokie knows only up to ${latest}. Update Pokie, or use a backup of the database from this version.`,
    );
  }

  const pending = migrations
    .filter((migration) => migration.version > current)
    .toSorted((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN IMMEDIATE");
    try {
      migration.up(db);
      const broken = db.prepare("PRAGMA foreign_key_check").all();
      if (broken.length > 0) {
        throw new Error(`${broken.length} rows point to rows that do not exist.`);
      }
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(
        `Database migration ${migration.version} (${migration.name}) failed. The database is unchanged.`,
        { cause: error },
      );
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
    }
  }
}
