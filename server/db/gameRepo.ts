import type { ChipCount, ChipDenomination, ChipStack } from "../../src/core/chips.ts";
import type {
  BuyIn,
  FinalCount,
  Game,
  GameStatus,
  Player,
  SettlementMode,
  TableColour,
  Withdrawal,
} from "../../src/core/game.ts";
import type { Database } from "./database.ts";

export type StoredGame = {
  game: Game;
  hostTokenHash: string;
  /** Player id to the hash of that player's token. Only players who joined on their own have one. */
  playerTokenHashes: Map<string, string>;
};

type GameRow = {
  id: string;
  name: string;
  rate_minor: number;
  rate_chips: number;
  denominations_json: string;
  settlement_json: string;
  status: GameStatus;
  seat_count: number;
  table_colour: TableColour;
  min_buy_in_minor: number | null;
  max_buy_in_minor: number | null;
  host_token_hash: string;
};

type PlayerRow = { id: string; name: string; seat: number; token_hash: string | null };

type BuyInRow = {
  id: string;
  player_id: string;
  amount_minor: number;
  chips_json: string | null;
  stack_before_minor: number | null;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  player_id: string;
  chip_units: number;
  chips_json: string | null;
  leaves_table: number;
  created_at: string;
};

type FinalCountRow = {
  player_id: string;
  count_json: string;
  submitted_by: FinalCount["submittedBy"];
};

export function findGame(db: Database, gameId: string): StoredGame | undefined {
  const gameRow = db.prepare("SELECT * FROM games WHERE id = ?").get(gameId) as GameRow | undefined;
  if (!gameRow) return undefined;

  const playerRows = db
    .prepare(
      "SELECT id, name, seat, token_hash FROM players WHERE game_id = ? ORDER BY seat, rowid",
    )
    .all(gameId) as PlayerRow[];
  const buyInRows = db
    .prepare(
      "SELECT id, player_id, amount_minor, chips_json, stack_before_minor, created_at FROM buy_ins WHERE game_id = ? ORDER BY created_at, rowid",
    )
    .all(gameId) as BuyInRow[];
  const withdrawalRows = db
    .prepare(
      "SELECT id, player_id, chip_units, leaves_table, chips_json, created_at FROM withdrawals WHERE game_id = ? ORDER BY created_at, rowid",
    )
    .all(gameId) as WithdrawalRow[];
  const countRows = db
    .prepare("SELECT player_id, count_json, submitted_by FROM final_counts WHERE game_id = ?")
    .all(gameId) as FinalCountRow[];

  const players: Player[] = playerRows.map((row) => ({
    id: row.id,
    name: row.name,
    seat: row.seat,
  }));
  const buyIns: BuyIn[] = buyInRows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    amountMinor: row.amount_minor,
    createdAt: row.created_at,
    ...(row.chips_json ? { chips: JSON.parse(row.chips_json) as ChipStack } : {}),
    ...(row.stack_before_minor === null ? {} : { stackBeforeMinor: row.stack_before_minor }),
  }));
  const withdrawals: Withdrawal[] = withdrawalRows.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    chipUnits: row.chip_units,
    ...(row.chips_json ? { chips: JSON.parse(row.chips_json) as ChipStack } : {}),
    leavesTable: row.leaves_table === 1,
    createdAt: row.created_at,
  }));
  const finalCounts: FinalCount[] = countRows.map((row) => ({
    playerId: row.player_id,
    count: JSON.parse(row.count_json) as ChipCount,
    submittedBy: row.submitted_by,
  }));

  return {
    hostTokenHash: gameRow.host_token_hash,
    playerTokenHashes: new Map(
      playerRows.flatMap((row) => (row.token_hash ? [[row.id, row.token_hash] as const] : [])),
    ),
    game: {
      id: gameRow.id,
      name: gameRow.name,
      rate: { minorUnits: gameRow.rate_minor, chipUnits: gameRow.rate_chips },
      denominations: JSON.parse(gameRow.denominations_json) as ChipDenomination[],
      settlement: JSON.parse(gameRow.settlement_json) as SettlementMode,
      status: gameRow.status,
      seatCount: gameRow.seat_count,
      tableColour: gameRow.table_colour,
      ...(gameRow.min_buy_in_minor === null ? {} : { minBuyInMinor: gameRow.min_buy_in_minor }),
      ...(gameRow.max_buy_in_minor === null ? {} : { maxBuyInMinor: gameRow.max_buy_in_minor }),
      players,
      buyIns,
      withdrawals,
      finalCounts,
    },
  };
}

export function insertGame(db: Database, game: Game, hostTokenHash: string, now: string): void {
  db.prepare(
    `INSERT INTO games (id, name, rate_minor, rate_chips, denominations_json, settlement_json, status, seat_count, table_colour, min_buy_in_minor, max_buy_in_minor, host_token_hash, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    game.id,
    game.name,
    game.rate.minorUnits,
    game.rate.chipUnits,
    JSON.stringify(game.denominations),
    JSON.stringify(game.settlement),
    game.status,
    game.seatCount,
    game.tableColour,
    game.minBuyInMinor ?? null,
    game.maxBuyInMinor ?? null,
    hostTokenHash,
    now,
  );
}

export function updateGameSettings(db: Database, game: Game, now: string): void {
  db.prepare(
    `UPDATE games
     SET name = ?, rate_minor = ?, rate_chips = ?, denominations_json = ?, settlement_json = ?, status = ?, seat_count = ?, table_colour = ?, min_buy_in_minor = ?, max_buy_in_minor = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    game.name,
    game.rate.minorUnits,
    game.rate.chipUnits,
    JSON.stringify(game.denominations),
    JSON.stringify(game.settlement),
    game.status,
    game.seatCount,
    game.tableColour,
    game.minBuyInMinor ?? null,
    game.maxBuyInMinor ?? null,
    now,
    game.id,
  );
}

export function touchGame(db: Database, gameId: string, now: string): void {
  db.prepare("UPDATE games SET updated_at = ? WHERE id = ?").run(now, gameId);
}

export function insertPlayer(
  db: Database,
  gameId: string,
  player: Player,
  tokenHash?: string,
): void {
  db.prepare(
    "INSERT INTO players (id, game_id, seat, name, token_hash) VALUES (?, ?, ?, ?, ?)",
  ).run(player.id, gameId, player.seat, player.name, tokenHash ?? null);
}

export function insertBuyIn(db: Database, gameId: string, buyIn: BuyIn): void {
  db.prepare(
    "INSERT INTO buy_ins (id, game_id, player_id, amount_minor, chips_json, stack_before_minor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    buyIn.id,
    gameId,
    buyIn.playerId,
    buyIn.amountMinor,
    buyIn.chips ? JSON.stringify(buyIn.chips) : null,
    buyIn.stackBeforeMinor ?? null,
    buyIn.createdAt,
  );
}

export function deleteBuyIn(db: Database, gameId: string, buyInId: string): void {
  db.prepare("DELETE FROM buy_ins WHERE game_id = ? AND id = ?").run(gameId, buyInId);
}

export function insertWithdrawal(db: Database, gameId: string, withdrawal: Withdrawal): void {
  db.prepare(
    "INSERT INTO withdrawals (id, game_id, player_id, chip_units, leaves_table, chips_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    withdrawal.id,
    gameId,
    withdrawal.playerId,
    withdrawal.chipUnits,
    withdrawal.leavesTable ? 1 : 0,
    withdrawal.chips ? JSON.stringify(withdrawal.chips) : null,
    withdrawal.createdAt,
  );
}

export function deleteWithdrawal(db: Database, gameId: string, withdrawalId: string): void {
  db.prepare("DELETE FROM withdrawals WHERE game_id = ? AND id = ?").run(gameId, withdrawalId);
}

export function saveFinalCount(db: Database, gameId: string, finalCount: FinalCount): void {
  db.prepare(
    `INSERT INTO final_counts (game_id, player_id, count_json, submitted_by) VALUES (?, ?, ?, ?)
     ON CONFLICT (game_id, player_id) DO UPDATE SET count_json = excluded.count_json, submitted_by = excluded.submitted_by`,
  ).run(gameId, finalCount.playerId, JSON.stringify(finalCount.count), finalCount.submittedBy);
}

export function deleteGamesUpdatedBefore(db: Database, cutoff: string): number {
  const result = db.prepare("DELETE FROM games WHERE updated_at < ?").run(cutoff);
  return Number(result.changes);
}
