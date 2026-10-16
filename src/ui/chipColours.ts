export type ChipColour = { name: string; hex: string };

/** The colours a host can pick for a chip, in the order the picker shows them. */
export const chipColours: ChipColour[] = [
  { name: "White", hex: "#ECE8DF" },
  { name: "Red", hex: "#C8433A" },
  { name: "Blue", hex: "#3366B8" },
  { name: "Green", hex: "#2F8A57" },
  { name: "Black", hex: "#262626" },
  { name: "Yellow", hex: "#E2B93B" },
  { name: "Purple", hex: "#7A4FA8" },
  { name: "Orange", hex: "#DD7A2E" },
  { name: "Pink", hex: "#D96A9A" },
  { name: "Grey", hex: "#8B918E" },
];

const fallbackColour = "#8B918E";

const coloursByWord = new Map<string, string>([
  ...chipColours.map((colour): [string, string] => [colour.name.toLowerCase(), colour.hex]),
  ["gray", "#8B918E"],
]);

/** Picks a swatch colour from a chip's colour name, for example "Red" or "dark blue". */
export function chipSwatchColour(colourName: string): string {
  const words = colourName.toLowerCase().split(/\s+/);
  for (const word of words.toReversed()) {
    const colour = coloursByWord.get(word);
    if (colour) return colour;
  }
  return fallbackColour;
}

/** The picker colours that no chip in the game uses yet. */
export function unusedChipColours(usedNames: string[]): ChipColour[] {
  const used = new Set(usedNames.map((name) => name.toLowerCase()));
  return chipColours.filter((colour) => !used.has(colour.name.toLowerCase()));
}
