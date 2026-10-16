import {
  chipValueOfCount,
  minorUnitsToChipUnits,
  type ChipDenomination,
  type ChipStack,
} from "./chips.ts";
import { GameRuleError } from "./errors.ts";
import type { Game } from "./game.ts";
import type { MinorUnits } from "./money.ts";
import { seatedPlayers } from "./table.ts";

/** A planned stack, and how many stacks like it the chips could cover when it was planned. */
export type StackPlan = { chips: ChipStack; stacks: number };

/** Above this many steps the exact search gets slow on a phone, so the app does not plan a stack. */
const maxSearchSteps = 10_000_000;

export function hasChipCase(game: Game): boolean {
  return (
    game.denominations.length > 0 &&
    game.denominations.every((denomination) => denomination.quantity !== undefined)
  );
}

export function stackValue(stack: ChipStack, denominations: ChipDenomination[]): number {
  return chipValueOfCount({ kind: "byDenomination", counts: stack }, denominations);
}

export function stackChipCount(stack: ChipStack): number {
  return Object.values(stack).reduce((sum, quantity) => sum + quantity, 0);
}

/** How many of each chip the host owns. */
export function ownedChips(denominations: ChipDenomination[]): ChipStack {
  return Object.fromEntries(denominations.map((d) => [d.id, d.quantity ?? 0]));
}

/** The chips in the case now: what the host owns, less buy-ins, plus withdrawals. */
export function caseContents(game: Game): ChipStack {
  const contents = ownedChips(game.denominations);
  for (const buyIn of game.buyIns) {
    for (const [id, quantity] of Object.entries(buyIn.chips ?? {})) {
      contents[id] = (contents[id] ?? 0) - quantity;
    }
  }
  for (const withdrawal of game.withdrawals) {
    for (const [id, quantity] of Object.entries(withdrawal.chips ?? {})) {
      contents[id] = (contents[id] ?? 0) + quantity;
    }
  }
  return contents;
}

/** Each of the given number of stacks gets the same share of every colour. */
export function fairShare(
  available: ChipStack,
  denominations: ChipDenomination[],
  stacks: number,
): ChipStack {
  return Object.fromEntries(
    denominations.map((d) => [d.id, Math.floor((available[d.id] ?? 0) / Math.max(1, stacks))]),
  );
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/**
 * Finds how many of each chip make up the amount exactly, using as many chips as possible.
 * More chips means more small chips, and small chips are the ones players bet with.
 * Returns undefined when no mix within the limits adds up to the amount.
 */
function mostChipsForAmount(
  amount: number,
  values: number[],
  limits: number[],
): number[] | undefined {
  const step = values.reduce(greatestCommonDivisor, 0);
  if (step === 0 || amount % step !== 0) return undefined;
  const target = amount / step;
  const scaled = values.map((value) => value / step);
  const searchSteps = limits.reduce((sum, limit) => sum + (target + 1) * (limit + 1), 0);
  if (searchSteps > maxSearchSteps) return undefined;

  const unreachable = -1;
  let best = new Int32Array(target + 1).fill(unreachable);
  best[0] = 0;
  const choices: Int32Array[] = [];

  for (let index = 0; index < scaled.length; index += 1) {
    const value = scaled[index]!;
    const limit = limits[index] ?? 0;
    const next = new Int32Array(target + 1).fill(unreachable);
    const choice = new Int32Array(target + 1);
    for (let sum = 0; sum <= target; sum += 1) {
      for (let quantity = 0; quantity <= limit && quantity * value <= sum; quantity += 1) {
        const before = best[sum - quantity * value]!;
        if (before === unreachable) continue;
        if (before + quantity > next[sum]!) {
          next[sum] = before + quantity;
          choice[sum] = quantity;
        }
      }
    }
    choices.push(choice);
    best = next;
  }

  if (best[target] === unreachable) return undefined;
  const quantities = Array.from<number>({ length: scaled.length }).fill(0);
  let remaining = target;
  for (let index = scaled.length - 1; index >= 0; index -= 1) {
    const quantity = choices[index]![remaining]!;
    quantities[index] = quantity;
    remaining -= quantity * scaled[index]!;
  }
  return quantities;
}

/**
 * Plans one stack worth the amount, so that the available chips can cover the given number of stacks.
 * When that is not possible, it plans for fewer stacks, down to one.
 */
export function planStack(
  amountChipUnits: number,
  denominations: ChipDenomination[],
  available: ChipStack,
  stacks: number,
): StackPlan | undefined {
  if (amountChipUnits <= 0) return undefined;
  for (let count = Math.max(1, stacks); count >= 1; count -= 1) {
    const share = fairShare(available, denominations, count);
    const quantities = mostChipsForAmount(
      amountChipUnits,
      denominations.map((d) => d.chipValue),
      denominations.map((d) => share[d.id] ?? 0),
    );
    if (quantities) {
      const chips = Object.fromEntries(
        denominations
          .map((d, index): [string, number] => [d.id, quantities[index] ?? 0])
          .filter(([, quantity]) => quantity > 0),
      );
      return { chips, stacks: count };
    }
  }
  return undefined;
}

/** "newPlayer" takes one of the empty seats. "rebuy" is a seated player who buys in again. */
export type BuyInKind = "newPlayer" | "rebuy";

/**
 * How many stacks the case must still cover, this buy-in included.
 * A new player sits in one of the empty seats. A rebuy comes on top of the empty seats.
 */
export function stacksStillNeeded(game: Game, kind: BuyInKind): number {
  const emptySeats = game.seatCount - seatedPlayers(game).length;
  return Math.max(1, kind === "newPlayer" ? emptySeats : emptySeats + 1);
}

/** What to take from the case for a buy-in of this amount. Undefined when the game has no case. */
export function planBuyIn(
  game: Game,
  amountMinor: MinorUnits,
  kind: BuyInKind,
): StackPlan | undefined {
  if (!hasChipCase(game) || amountMinor <= 0) return undefined;
  const scaled = amountMinor * game.rate.chipUnits;
  if (scaled % game.rate.minorUnits !== 0) return undefined;
  return planStack(
    minorUnitsToChipUnits(amountMinor, game.rate),
    game.denominations,
    caseContents(game),
    stacksStillNeeded(game, kind),
  );
}

/** Each seat's share of the whole case, before anyone buys in. */
export function seatShare(game: Game): ChipStack {
  return fairShare(ownedChips(game.denominations), game.denominations, game.seatCount);
}

function assertStack(stack: ChipStack, game: Game, label: string): void {
  for (const [id, quantity] of Object.entries(stack)) {
    const denomination = game.denominations.find((d) => d.id === id);
    if (!denomination) throw new GameRuleError(`${label} uses unknown denomination "${id}".`);
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new GameRuleError(`${label} must use a whole number of ${denomination.colour} chips.`);
    }
  }
}

/** Throws a GameRuleError when the chip case does not add up. */
export function assertValidChipCase(game: Game): void {
  const withQuantity = game.denominations.filter((d) => d.quantity !== undefined);
  if (withQuantity.length > 0 && withQuantity.length < game.denominations.length) {
    throw new GameRuleError("Enter how many you have of every chip, or of none.");
  }
  for (const denomination of withQuantity) {
    const quantity = denomination.quantity!;
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new GameRuleError(
        `The number of ${denomination.colour} chips must be a whole number of zero or more.`,
      );
    }
  }

  const caseIsSet = hasChipCase(game);
  for (const buyIn of game.buyIns) {
    if (!buyIn.chips) continue;
    if (!caseIsSet) throw new GameRuleError("This game has no chip case to take chips from.");
    assertStack(buyIn.chips, game, "A buy-in");
    const expected = minorUnitsToChipUnits(buyIn.amountMinor, game.rate);
    if (stackValue(buyIn.chips, game.denominations) !== expected) {
      throw new GameRuleError("The chips for a buy-in must add up to the buy-in amount.");
    }
  }
  for (const withdrawal of game.withdrawals) {
    if (!withdrawal.chips) continue;
    if (!caseIsSet) throw new GameRuleError("This game has no chip case to put chips back in.");
    assertStack(withdrawal.chips, game, "A withdrawal");
    if (stackValue(withdrawal.chips, game.denominations) !== withdrawal.chipUnits) {
      throw new GameRuleError("The chips for a withdrawal must add up to the withdrawal value.");
    }
  }

  if (!caseIsSet) return;
  const contents = caseContents(game);
  for (const denomination of game.denominations) {
    const left = contents[denomination.id] ?? 0;
    if (left < 0) {
      throw new GameRuleError(
        `The chip case does not have enough ${denomination.colour} chips. It is ${-left} short.`,
      );
    }
  }
}
