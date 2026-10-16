import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import {
  approximateMinorUnits,
  type ChipDenomination,
  type ChipRate,
  type ChipStack,
} from "@/core/chips.ts";
import { formatMoney } from "@/core/money.ts";
import { chipSwatchColour } from "@/ui/chipColours.ts";

type ChipStackListProps = {
  stack: ChipStack;
  denominations: ChipDenomination[];
  rate: ChipRate;
};

/** Shows a stack as "12 × White ($0.25)" lines, from the smallest chip to the largest. */
export function ChipStackList({ stack, denominations, rate }: ChipStackListProps) {
  const rows = denominations
    .filter((denomination) => (stack[denomination.id] ?? 0) > 0)
    .toSorted((a, b) => a.chipValue - b.chipValue);

  return (
    <ul className="grid gap-1.5">
      {rows.map((denomination) => (
        <li key={denomination.id} className="flex items-center gap-3">
          <ChipSwatch hex={chipSwatchColour(denomination.colour)} className="size-6 border-[3px]" />
          <span className="min-w-[3ch] text-right text-lg font-semibold [font-stretch:75%]">
            {stack[denomination.id]}
          </span>
          <span>
            × {denomination.colour}{" "}
            <span className="text-muted-foreground">
              ({formatMoney(approximateMinorUnits(denomination.chipValue, rate))})
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
