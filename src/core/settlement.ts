import { assertValidRate, chipValueOfCount, minorUnitsToChipUnits } from "./chips.ts";
import { GameRuleError } from "./errors.ts";
import type { EscrowHolder, FinalCount, Game, SettlementMode } from "./game.ts";
import { assertPositiveMinorUnits, type MinorUnits } from "./money.ts";
import { assertValidTable, hasLeftTable } from "./table.ts";

/** The party id of an escrow holder who is not a player. */
export const EXTERNAL_ESCROW_ID = "escrow";

export type Reconciliation = {
  issuedChipUnits: number;
  withdrawnChipUnits: number;
  countedChipUnits: number;
  /** Withdrawn plus counted, minus issued. Positive means extra chips came back. */
  differenceChipUnits: number;
  playersMissingCount: string[];
  isBalanced: boolean;
};

export type PlayerResult = {
  playerId: string;
  paidInMinor: MinorUnits;
  cashOutMinor: MinorUnits;
  netMinor: MinorUnits;
};

export type Transfer = {
  from: string;
  to: string;
  amountMinor: MinorUnits;
};

export type EscrowSummary = {
  holderId: string;
  collect: Transfer[];
  payOut: Transfer[];
};

export type SettlementResult =
  | { ok: false; reconciliation: Reconciliation }
  | {
      ok: true;
      reconciliation: Reconciliation;
      mode: SettlementMode;
      results: PlayerResult[];
      transfers: Transfer[];
      escrow?: EscrowSummary;
    };

function assertKnownPlayer(game: Game, playerId: string, source: string): void {
  if (!game.players.some((player) => player.id === playerId)) {
    throw new GameRuleError(`${source} refers to unknown player "${playerId}".`);
  }
}

function finalCountsByPlayer(game: Game): Map<string, FinalCount> {
  const counts = new Map<string, FinalCount>();
  for (const finalCount of game.finalCounts) {
    assertKnownPlayer(game, finalCount.playerId, "A final count");
    if (counts.has(finalCount.playerId)) {
      throw new GameRuleError(`Player "${finalCount.playerId}" has more than one final count.`);
    }
    counts.set(finalCount.playerId, finalCount);
  }
  return counts;
}

function paidInByPlayer(game: Game): Map<string, MinorUnits> {
  const paidIn = new Map<string, MinorUnits>();
  for (const buyIn of game.buyIns) {
    assertKnownPlayer(game, buyIn.playerId, "A buy-in");
    assertPositiveMinorUnits(buyIn.amountMinor, "Buy-in amount");
    paidIn.set(buyIn.playerId, (paidIn.get(buyIn.playerId) ?? 0) + buyIn.amountMinor);
  }
  return paidIn;
}

function withdrawnByPlayer(game: Game): Map<string, number> {
  const withdrawn = new Map<string, number>();
  const playersWhoLeft = new Set<string>();
  for (const withdrawal of game.withdrawals) {
    assertKnownPlayer(game, withdrawal.playerId, "A withdrawal");
    if (!Number.isSafeInteger(withdrawal.chipUnits) || withdrawal.chipUnits < 0) {
      throw new GameRuleError(
        `A withdrawal must be a whole number of chips of zero or more. Got ${withdrawal.chipUnits}.`,
      );
    }
    // A player who leaves with no chips still records the departure. A player who stays must hand in chips.
    if (withdrawal.chipUnits === 0 && !withdrawal.leavesTable) {
      throw new GameRuleError("A withdrawal must hand in some chips unless the player leaves.");
    }
    if (withdrawal.leavesTable) {
      if (playersWhoLeft.has(withdrawal.playerId)) {
        throw new GameRuleError(`Player "${withdrawal.playerId}" cannot leave the table twice.`);
      }
      playersWhoLeft.add(withdrawal.playerId);
    }
    withdrawn.set(
      withdrawal.playerId,
      (withdrawn.get(withdrawal.playerId) ?? 0) + withdrawal.chipUnits,
    );
  }
  return withdrawn;
}

export function reconcile(game: Game): Reconciliation {
  assertValidRate(game.rate);
  const paidIn = paidInByPlayer(game);
  const withdrawn = withdrawnByPlayer(game);
  const counts = finalCountsByPlayer(game);

  let issuedChipUnits = 0;
  for (const buyIn of game.buyIns) {
    issuedChipUnits += minorUnitsToChipUnits(buyIn.amountMinor, game.rate);
  }

  let withdrawnChipUnits = 0;
  for (const chipUnits of withdrawn.values()) {
    withdrawnChipUnits += chipUnits;
  }

  let countedChipUnits = 0;
  for (const finalCount of counts.values()) {
    countedChipUnits += chipValueOfCount(finalCount.count, game.denominations);
  }

  const playersMissingCount = game.players
    .filter(
      (player) => paidIn.has(player.id) && !counts.has(player.id) && !hasLeftTable(game, player.id),
    )
    .map((player) => player.id);

  const differenceChipUnits = withdrawnChipUnits + countedChipUnits - issuedChipUnits;
  return {
    issuedChipUnits,
    withdrawnChipUnits,
    countedChipUnits,
    differenceChipUnits,
    playersMissingCount,
    isBalanced: differenceChipUnits === 0 && playersMissingCount.length === 0,
  };
}

/** Throws a GameRuleError when any part of the game refers to something that does not exist. */
export function assertConsistentGame(game: Game): void {
  const denominationIds = new Set<string>();
  for (const denomination of game.denominations) {
    if (denominationIds.has(denomination.id)) {
      throw new GameRuleError(`Two chip denominations use the id "${denomination.id}".`);
    }
    denominationIds.add(denomination.id);
  }

  assertValidTable(game);

  const { settlement } = game;
  if (settlement.mode === "escrow" && settlement.holder.kind === "player") {
    assertKnownPlayer(game, settlement.holder.playerId, "The escrow holder");
  }

  reconcile(game);
}

/**
 * Converts each player's withdrawn and counted chips to money. Results follow the order of game.players.
 * Chip value often does not divide into whole minor units. Each cash-out is rounded down first.
 * The minor units left over then go one each to the players with the largest remainders.
 * Ties go to the player who comes first in game.players. This keeps the total cash-out equal to the total paid in.
 */
export function netResults(game: Game): PlayerResult[] {
  const reconciliation = reconcile(game);
  if (!reconciliation.isBalanced) {
    throw new GameRuleError(
      "Cannot calculate results: the chip counts do not match the chips issued.",
    );
  }

  const paidIn = paidInByPlayer(game);
  const withdrawn = withdrawnByPlayer(game);
  const counts = finalCountsByPlayer(game);

  const rows = game.players.map((player, order) => {
    const finalCount = counts.get(player.id);
    const countedChipUnits = finalCount
      ? chipValueOfCount(finalCount.count, game.denominations)
      : 0;
    const chipUnits = countedChipUnits + (withdrawn.get(player.id) ?? 0);
    const scaled = chipUnits * game.rate.minorUnits;
    return {
      order,
      playerId: player.id,
      paidInMinor: paidIn.get(player.id) ?? 0,
      cashOutMinor: Math.floor(scaled / game.rate.chipUnits),
      remainder: scaled % game.rate.chipUnits,
    };
  });

  const totalPaidIn = rows.reduce((sum, row) => sum + row.paidInMinor, 0);
  const totalRoundedDown = rows.reduce((sum, row) => sum + row.cashOutMinor, 0);
  const leftover = totalPaidIn - totalRoundedDown;

  const byRemainder = rows.toSorted((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (const row of byRemainder.slice(0, leftover)) {
    row.cashOutMinor += 1;
  }

  return rows.map((row) => ({
    playerId: row.playerId,
    paidInMinor: row.paidInMinor,
    cashOutMinor: row.cashOutMinor,
    netMinor: row.cashOutMinor - row.paidInMinor,
  }));
}

/**
 * Matches the biggest debtor with the biggest creditor until all are settled.
 * This gives at most one payment fewer than the number of players with a non-zero result.
 */
export function minimalTransfers(results: PlayerResult[]): Transfer[] {
  const creditors = results
    .filter((result) => result.netMinor > 0)
    .map((result) => ({ playerId: result.playerId, remaining: result.netMinor }))
    .toSorted((a, b) => b.remaining - a.remaining);
  const debtors = results
    .filter((result) => result.netMinor < 0)
    .map((result) => ({ playerId: result.playerId, remaining: -result.netMinor }))
    .toSorted((a, b) => b.remaining - a.remaining);

  const transfers: Transfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]!;
    const debtor = debtors[debtorIndex]!;
    const amountMinor = Math.min(creditor.remaining, debtor.remaining);

    transfers.push({ from: debtor.playerId, to: creditor.playerId, amountMinor });
    creditor.remaining -= amountMinor;
    debtor.remaining -= amountMinor;

    if (creditor.remaining === 0) creditorIndex += 1;
    if (debtor.remaining === 0) debtorIndex += 1;
  }
  return transfers;
}

export function escrowHolderId(holder: EscrowHolder): string {
  return holder.kind === "player" ? holder.playerId : EXTERNAL_ESCROW_ID;
}

/** A holder who also plays keeps their own result, so they never pay themselves. */
export function escrowTransfers(results: PlayerResult[], holder: EscrowHolder): Transfer[] {
  const holderId = escrowHolderId(holder);
  if (holder.kind === "player" && !results.some((result) => result.playerId === holderId)) {
    throw new GameRuleError(`Escrow holder "${holderId}" is not a player in this game.`);
  }

  const transfers: Transfer[] = [];
  for (const result of results) {
    if (result.playerId === holderId || result.netMinor === 0) continue;
    transfers.push(
      result.netMinor < 0
        ? { from: result.playerId, to: holderId, amountMinor: -result.netMinor }
        : { from: holderId, to: result.playerId, amountMinor: result.netMinor },
    );
  }
  return transfers;
}

export function settle(game: Game): SettlementResult {
  const reconciliation = reconcile(game);
  if (!reconciliation.isBalanced) {
    return { ok: false, reconciliation };
  }

  const results = netResults(game);
  const mode = game.settlement;
  if (mode.mode === "direct") {
    return { ok: true, reconciliation, mode, results, transfers: minimalTransfers(results) };
  }

  const holderId = escrowHolderId(mode.holder);
  const transfers = escrowTransfers(results, mode.holder);
  return {
    ok: true,
    reconciliation,
    mode,
    results,
    transfers,
    escrow: {
      holderId,
      collect: transfers.filter((transfer) => transfer.to === holderId),
      payOut: transfers.filter((transfer) => transfer.from === holderId),
    },
  };
}
