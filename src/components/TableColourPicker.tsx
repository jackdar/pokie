import type { TableColour } from "@/core/game.ts";
import { cn } from "@/lib/utils";
import { tableColourOptions } from "@/ui/tableColours.ts";

type TableColourPickerProps = {
  value: TableColour;
  onChange: (colour: TableColour) => void;
  /** The background behind the picker. The ring gap around the chosen colour must match it. */
  surface: "page" | "sheet";
};

export function TableColourPicker({ value, onChange, surface }: TableColourPickerProps) {
  return (
    <div role="radiogroup" aria-label="Table colour" className="flex gap-3">
      {tableColourOptions.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          aria-label={option.label}
          title={option.label}
          className={cn(
            "flex aspect-square size-10 items-center justify-center rounded-full border-2 border-rail-light focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
            value === option.id && "ring-2 ring-primary ring-offset-2",
            value === option.id &&
              (surface === "sheet" ? "ring-offset-popover" : "ring-offset-background"),
          )}
          style={{ backgroundColor: option.felt }}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}
