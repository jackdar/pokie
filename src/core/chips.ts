import { GameRuleError } from "./errors.ts";
import { assertPositiveMinorUnits, type MinorUnits } from "./money.ts";

export type ChipDenomination = {
  id: string;
  colour: string;
  chipValue: number;
  /** How many chips of this colour are in the host's chip case. Leave it out when the game has no case. */
  quantity?: number;
};

/** A number of chips for each denomination id, for example { red: 12, black: 2 }. */
export type ChipStack = Record<string, number>;

/** How much money buys how many chip units, for example 1000 pence = 1000 chips. */
export type ChipRate = {
  minorUnits: MinorUnits;
  chipUnits: number;
};

export type ChipCount =
  | { kind: "byDenomination"; counts: Record<string, number> }
  | { kind: "total"; chipUnits: number };

function assertChipQuantity(quantity: number, label: string): void {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new GameRuleError(`${label} must be a whole number of zero or more. Got ${quantity}.`);
  }
}

export function assertValidRate(rate: ChipRate): void {
  assertPositiveMinorUnits(rate.minorUnits, "Rate money amount");
  if (!Number.isSafeInteger(rate.chipUnits) || rate.chipUnits <= 0) {
    throw new GameRuleError(
      `Rate chip amount must be a whole number more than zero. Got ${rate.chipUnits}.`,
    );
  }
}

export function chipValueOfCount(count: ChipCount, denominations: ChipDenomination[]): number {
  if (count.kind === "total") {
    assertChipQuantity(count.chipUnits, "Total chip value");
    return count.chipUnits;
  }

  let total = 0;
  for (const [denominationId, quantity] of Object.entries(count.counts)) {
    const denomination = denominations.find((d) => d.id === denominationId);
    if (!denomination) {
      throw new GameRuleError(`Chip count uses unknown denomination "${denominationId}".`);
    }
    assertChipQuantity(quantity, `Count of ${denomination.colour} chips`);
    total += quantity * denomination.chipValue;
  }
  return total;
}

/** For display only. Settlement uses exact rounding rules in netResults. */
export function approximateMinorUnits(chipUnits: number, rate: ChipRate): MinorUnits {
  return Math.round((chipUnits * rate.minorUnits) / rate.chipUnits);
}

/**
 * Buy-ins must convert to a whole number of chip units.
 * Otherwise the chips issued cannot match the chips on the table.
 */
export function minorUnitsToChipUnits(amount: MinorUnits, rate: ChipRate): number {
  const scaled = amount * rate.chipUnits;
  if (scaled % rate.minorUnits !== 0) {
    throw new GameRuleError(
      `Buy-in of ${amount} minor units does not convert to whole chips at ${rate.minorUnits} minor units per ${rate.chipUnits} chips.`,
    );
  }
  return scaled / rate.minorUnits;
}
