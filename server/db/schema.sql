CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate_minor INTEGER NOT NULL,
  rate_chips INTEGER NOT NULL,
  denominations_json TEXT NOT NULL,
  settlement_json TEXT NOT NULL,
  status TEXT NOT NULL,
  seat_count INTEGER NOT NULL,
  table_colour TEXT NOT NULL,
  host_token_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS games_updated_at ON games (updated_at);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  seat INTEGER NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS players_game_id ON players (game_id);

CREATE TABLE IF NOT EXISTS buy_ins (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS buy_ins_game_id ON buy_ins (game_id);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  chip_units INTEGER NOT NULL,
  leaves_table INTEGER NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS withdrawals_game_id ON withdrawals (game_id);

CREATE TABLE IF NOT EXISTS final_counts (
  game_id TEXT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  count_json TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  PRIMARY KEY (game_id, player_id)
) STRICT;
