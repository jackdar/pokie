import { GameRuleError } from "./errors.ts";
import type { Game } from "./game.ts";
import { formatMoney, type MinorUnits } from "./money.ts";

/**
 * The amounts a buy-in may be, given what the player still has in front of them.
 * After a buy-in the player's stack must be between the table minimum and the table maximum.
 * Undefined "largest" means the table has no maximum.
 */
export type BuyInRange = { smallest: MinorUnits; largest: MinorUnits | undefined };

export function hasBuyInLimits(game: Game): boolean {
  return game.minBuyInMinor !== undefined || game.maxBuyInMinor !== undefined;
}

export function buyInRange(game: Game, stackBeforeMinor: MinorUnits): BuyInRange {
  const smallest = Math.max(1, (game.minBuyInMinor ?? 0) - stackBeforeMinor);
  const largest =
    game.maxBuyInMinor === undefined ? undefined : game.maxBuyInMinor - stackBeforeMinor;
  return { smallest, largest };
}

/** Explains why a buy-in breaks the table limits, or returns undefined when it is allowed. */
export function buyInLimitError(
  game: Game,
  amountMinor: MinorUnits,
  stackBeforeMinor: MinorUnits,
): string | undefined {
  const { smallest, largest } = buyInRange(game, stackBeforeMinor);
  if (largest !== undefined && largest < smallest) {
    return `A stack of ${formatMoney(stackBeforeMinor)} is already at the table maximum of ${formatMoney(game.maxBuyInMinor!)}.`;
  }
  if (largest !== undefined && amountMinor > largest) {
    return stackBeforeMinor > 0
      ? `With ${formatMoney(stackBeforeMinor)} in front of them, a player can buy in for up to ${formatMoney(largest)}. The table maximum is ${formatMoney(game.maxBuyInMinor!)}.`
      : `The table maximum is ${formatMoney(largest)}.`;
  }
  if (amountMinor < smallest) {
    return stackBeforeMinor > 0
      ? `With ${formatMoney(stackBeforeMinor)} in front of them, a player must buy in for at least ${formatMoney(smallest)}. The table minimum is ${formatMoney(game.minBuyInMinor!)}.`
      : `The table minimum is ${formatMoney(smallest)}.`;
  }
  return undefined;
}

export function assertWithinBuyInLimits(
  game: Game,
  amountMinor: MinorUnits,
  stackBeforeMinor: MinorUnits,
): void {
  const error = buyInLimitError(game, amountMinor, stackBeforeMinor);
  if (error) throw new GameRuleError(error);
}

export function assertValidBuyInLimits(game: Game): void {
  for (const [label, amount] of [
    ["The table minimum", game.minBuyInMinor],
    ["The table maximum", game.maxBuyInMinor],
  ] as const) {
    if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0)) {
      throw new GameRuleError(`${label} must be a whole number of cents more than zero.`);
    }
  }
  if (
    game.minBuyInMinor !== undefined &&
    game.maxBuyInMinor !== undefined &&
    game.minBuyInMinor > game.maxBuyInMinor
  ) {
    throw new GameRuleError("The table minimum cannot be more than the table maximum.");
  }
}
