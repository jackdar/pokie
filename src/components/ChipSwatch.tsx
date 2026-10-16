import { cn } from "@/lib/utils";

type ChipSwatchProps = {
  hex: string;
  className?: string;
};

/** A small poker chip: a coloured disc with the dashed edge spots that real chips have. */
export function ChipSwatch({ hex, className }: ChipSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block aspect-square size-8 shrink-0 rounded-full border-[4px] border-dashed border-white/70 shadow-[inset_0_0_0_3px_rgb(0_0_0/0.18),0_1px_3px_rgb(0_0_0/0.4)]",
        className,
      )}
      style={{ backgroundColor: hex }}
    />
  );
}
