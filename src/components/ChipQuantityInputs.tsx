import { MinusIcon, PlusIcon } from "lucide-react";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approximateMinorUnits, type ChipDenomination, type ChipRate } from "@/core/chips.ts";
import { formatMoney } from "@/core/money.ts";
import { chipSwatchColour } from "@/ui/chipColours.ts";
import { changeQuantity, type QuantityInputs } from "@/ui/chipQuantities.ts";

type ChipQuantityInputsProps = {
  denominations: ChipDenomination[];
  rate: ChipRate;
  inputs: QuantityInputs;
  onChange: (inputs: QuantityInputs) => void;
};

/** One row per chip colour with − and + buttons, for counting or handing in chips. */
export function ChipQuantityInputs({
  denominations,
  rate,
  inputs,
  onChange,
}: ChipQuantityInputsProps) {
  return (
    <div className="grid gap-2">
      {denominations.map((denomination) => (
        <div key={denomination.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <ChipSwatch hex={chipSwatchColour(denomination.colour)} />
          <span className="leading-tight">
            {denomination.colour}
            <span className="block text-sm text-muted-foreground">
              {formatMoney(approximateMinorUnits(denomination.chipValue, rate))} each
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`One fewer ${denomination.colour} chip`}
              onClick={() => onChange(changeQuantity(inputs, denomination.id, -1))}
            >
              <MinusIcon />
            </Button>
            <Input
              aria-label={`Number of ${denomination.colour} chips`}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              className="w-16 text-center"
              value={inputs[denomination.id] ?? ""}
              onChange={(event) => onChange({ ...inputs, [denomination.id]: event.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`One more ${denomination.colour} chip`}
              onClick={() => onChange(changeQuantity(inputs, denomination.id, 1))}
            >
              <PlusIcon />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
