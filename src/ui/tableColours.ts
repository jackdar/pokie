import type { TableColour } from "@/core/game.ts";

/** The swatch for each table colour, and the room colour for the browser bar. Keep in step with styles.css. */
export const tableColourOptions: { id: TableColour; label: string; felt: string; room: string }[] =
  [
    { id: "green", label: "Green", felt: "#1e5a47", room: "#18211f" },
    { id: "blue", label: "Blue", felt: "#1d4f7a", room: "#161c24" },
    { id: "red", label: "Red", felt: "#7a2430", room: "#221719" },
    { id: "purple", label: "Purple", felt: "#4f2b75", room: "#1d1726" },
  ];

/** Colours the whole page for one game. Pages outside a game use green. */
export function applyTableColour(colour: TableColour): void {
  document.documentElement.dataset.theme = colour;
  const room = tableColourOptions.find((option) => option.id === colour)?.room;
  if (room) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", room);
}
