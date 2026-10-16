import { createUniqueJoinCode } from "../../joinCode.ts";
import type { Migration } from "../migrate.ts";

/** Gives every game a short code that people can type on the home page to join it. */
export const joinCodes: Migration = {
  version: 2,
  name: "join codes",
  up(db) {
    db.exec("ALTER TABLE games ADD COLUMN join_code TEXT");

    const taken = new Set<string>();
    const games = db.prepare("SELECT id FROM games").all() as { id: string }[];
    const setCode = db.prepare("UPDATE games SET join_code = ? WHERE id = ?");
    for (const game of games) {
      const code = createUniqueJoinCode((candidate) => taken.has(candidate));
      taken.add(code);
      setCode.run(code, game.id);
    }

    db.exec("CREATE UNIQUE INDEX games_join_code ON games (join_code)");
  },
};
