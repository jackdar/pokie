import { GameRuleError } from "./errors.ts";

/** A whole number of cents. */
export type MinorUnits = number;

export const MONEY_SYMBOL = "$";

const fractionDigits = 2;

export function assertMinorUnits(amount: MinorUnits, label: string): void {
  if (!Number.isSafeInteger(amount)) {
    throw new GameRuleError(`${label} must be a whole number of cents. Got ${amount}.`);
  }
}

export function assertPositiveMinorUnits(amount: MinorUnits, label: string): void {
  assertMinorUnits(amount, label);
  if (amount <= 0) {
    throw new GameRuleError(`${label} must be more than zero. Got ${amount}.`);
  }
}

export function formatMoney(amount: MinorUnits, locale?: string): string {
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(amount) / 10 ** fractionDigits);
  return `${amount < 0 ? "-" : ""}${MONEY_SYMBOL}${number}`;
}

/** The value to put in a money input, for example "10.00". parseMoneyInput reads it back. */
export function formatMoneyInput(amount: MinorUnits): string {
  return (amount / 10 ** fractionDigits).toFixed(fractionDigits);
}

/**
 * Reads an amount that a person typed, for example "20" or "12.50".
 * Returns undefined when the text is not a valid amount.
 */
export function parseMoneyInput(text: string): MinorUnits | undefined {
  const cleaned = text.trim().replaceAll(",", "").replace(/^\$/, "");
  const match = cleaned.match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return undefined;

  const [, whole = "", fraction = ""] = match;
  if (fraction.length > fractionDigits) return undefined;

  const amount = Number(whole + fraction.padEnd(fractionDigits, "0"));
  return Number.isSafeInteger(amount) ? amount : undefined;
}
