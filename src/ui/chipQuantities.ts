import type { ChipDenomination, ChipStack } from "@/core/chips.ts";

/** What a person typed for each chip colour, keyed by denomination id. */
export type QuantityInputs = Record<string, string>;

export function emptyQuantityInputs(denominations: ChipDenomination[]): QuantityInputs {
  return Object.fromEntries(denominations.map((d) => [d.id, ""]));
}

/** An empty field means zero. Returns undefined when the text is not a whole number. */
export function parseQuantity(text: string): number | undefined {
  const cleaned = text.trim();
  if (cleaned === "") return 0;
  if (!/^\d+$/.test(cleaned)) return undefined;
  const quantity = Number(cleaned);
  return Number.isSafeInteger(quantity) ? quantity : undefined;
}

/** Reads the inputs as a chip stack, or returns an error message for the first bad field. */
export function stackFromInputs(
  inputs: QuantityInputs,
  denominations: ChipDenomination[],
): ChipStack | string {
  const stack: ChipStack = {};
  for (const denomination of denominations) {
    const quantity = parseQuantity(inputs[denomination.id] ?? "");
    if (quantity === undefined) {
      return `Enter the number of ${denomination.colour} chips as a whole number.`;
    }
    if (quantity > 0) stack[denomination.id] = quantity;
  }
  return stack;
}

export function changeQuantity(inputs: QuantityInputs, id: string, change: number): QuantityInputs {
  const quantity = parseQuantity(inputs[id] ?? "") ?? 0;
  return { ...inputs, [id]: String(Math.max(0, quantity + change)) };
}
