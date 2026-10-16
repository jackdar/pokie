import { buyInRange } from "@/core/buyInLimits.ts";
import type { Game } from "@/core/game.ts";
import { formatMoney, type MinorUnits } from "@/core/money.ts";

/** A short line about the table limits, for example "Buy-ins from $20.00 to $50.00". */
export function describeBuyInLimits(game: Game): string | undefined {
  const { minBuyInMinor: min, maxBuyInMinor: max } = game;
  if (min !== undefined && max !== undefined) {
    return `Buy-ins from ${formatMoney(min)} to ${formatMoney(max)}`;
  }
  if (max !== undefined) return `Buy-ins up to ${formatMoney(max)}`;
  if (min !== undefined) return `Buy-ins from ${formatMoney(min)}`;
  return undefined;
}

/** What a player with this stack may buy in for, for example "You can buy in for $8.00 to $38.00." */
export function describeTopUp(game: Game, stackBeforeMinor: MinorUnits): string {
  const { smallest, largest } = buyInRange(game, stackBeforeMinor);
  if (largest === undefined) return `You can buy in for ${formatMoney(smallest)} or more.`;
  if (largest < smallest) return "This stack is already at the table maximum.";
  if (smallest === largest) return `You can buy in for ${formatMoney(largest)}.`;
  return `You can buy in for ${formatMoney(smallest)} to ${formatMoney(largest)}.`;
}
