import { chipValueOfCount, minorUnitsToChipUnits } from "./chips.ts";
import type { Game } from "./game.ts";
import type { MinorUnits } from "./money.ts";

export type LedgerEntry =
  | {
      kind: "buyIn";
      id: string;
      playerId: string;
      createdAt: string;
      amountMinor: MinorUnits;
      chipUnits: number;
    }
  | {
      kind: "withdrawal";
      id: string;
      playerId: string;
      createdAt: string;
      chipUnits: number;
      leavesTable: boolean;
    };

/** Buy-ins and withdrawals in one list, newest first. */
export function ledgerEntries(game: Game): LedgerEntry[] {
  const buyIns: LedgerEntry[] = game.buyIns.map((buyIn) => ({
    kind: "buyIn",
    id: buyIn.id,
    playerId: buyIn.playerId,
    createdAt: buyIn.createdAt,
    amountMinor: buyIn.amountMinor,
    chipUnits: minorUnitsToChipUnits(buyIn.amountMinor, game.rate),
  }));
  const withdrawals: LedgerEntry[] = game.withdrawals.map((withdrawal) => ({
    kind: "withdrawal",
    id: withdrawal.id,
    playerId: withdrawal.playerId,
    createdAt: withdrawal.createdAt,
    chipUnits: withdrawal.chipUnits,
    leavesTable: withdrawal.leavesTable,
  }));
  // Both lists come in the order they were saved. Reversing first keeps the latest entry first when two share a time.
  return [...buyIns, ...withdrawals]
    .toReversed()
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type PlayerTotals = {
  paidInMinor: MinorUnits;
  boughtChipUnits: number;
  withdrawnChipUnits: number;
  /** Undefined until the player's final count is saved. */
  countedChipUnits: number | undefined;
};

export function playerTotals(game: Game, playerId: string): PlayerTotals {
  const paidInMinor = game.buyIns
    .filter((buyIn) => buyIn.playerId === playerId)
    .reduce((sum, buyIn) => sum + buyIn.amountMinor, 0);
  const withdrawnChipUnits = game.withdrawals
    .filter((withdrawal) => withdrawal.playerId === playerId)
    .reduce((sum, withdrawal) => sum + withdrawal.chipUnits, 0);
  const finalCount = game.finalCounts.find((count) => count.playerId === playerId);
  return {
    paidInMinor,
    boughtChipUnits: minorUnitsToChipUnits(paidInMinor, game.rate),
    withdrawnChipUnits,
    countedChipUnits: finalCount
      ? chipValueOfCount(finalCount.count, game.denominations)
      : undefined,
  };
}

/** The amount of the latest buy-in. Undefined when nobody has bought in. */
export function suggestedBuyInMinor(game: Game): MinorUnits | undefined {
  return game.buyIns.at(-1)?.amountMinor;
}

export type PoolSummary = {
  paidInMinor: MinorUnits;
  withdrawnChipUnits: number;
  chipUnitsInPlay: number;
};

export function poolSummary(game: Game): PoolSummary {
  const paidInMinor = game.buyIns.reduce((sum, buyIn) => sum + buyIn.amountMinor, 0);
  const withdrawnChipUnits = game.withdrawals.reduce((sum, w) => sum + w.chipUnits, 0);
  return {
    paidInMinor,
    withdrawnChipUnits,
    chipUnitsInPlay: minorUnitsToChipUnits(paidInMinor, game.rate) - withdrawnChipUnits,
  };
}
