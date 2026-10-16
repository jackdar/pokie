import { useState } from "react";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { chipColours, chipSwatchColour } from "@/ui/chipColours.ts";

type ChipColourPickerProps = {
  colour: string;
  /** Colours that other chips use. The picker shows them but does not let you pick them. */
  takenColours: string[];
  onChange: (colour: string) => void;
};

export function ChipColourPicker({ colour, takenColours, onChange }: ChipColourPickerProps) {
  const [open, setOpen] = useState(false);
  const taken = new Set(takenColours.map((name) => name.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${colour} chip. Change the colour`}
        className="flex aspect-square shrink-0 items-center justify-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        <ChipSwatch hex={chipSwatchColour(colour)} className="size-10" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <p className="mb-2 text-sm text-muted-foreground">Chip colour</p>
        <div className="grid grid-cols-5 gap-2">
          {chipColours.map((option) => {
            const isCurrent = option.name.toLowerCase() === colour.toLowerCase();
            const isTaken = !isCurrent && taken.has(option.name.toLowerCase());
            return (
              <button
                key={option.name}
                type="button"
                aria-label={isTaken ? `${option.name}, used by another chip` : option.name}
                aria-pressed={isCurrent}
                disabled={isTaken}
                className={cn(
                  "flex aspect-square items-center justify-center justify-self-center rounded-full p-0.5 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-25",
                  isCurrent && "ring-2 ring-primary",
                )}
                onClick={() => {
                  onChange(option.name);
                  setOpen(false);
                }}
              >
                <ChipSwatch hex={option.hex} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
