import { describe, expect, it } from "vitest";
import { chipSwatchColour, unusedChipColours } from "../../src/ui/chipColours.ts";

describe("chipSwatchColour", () => {
  it("matches a colour name in any case", () => {
    expect(chipSwatchColour("Red")).toBe("#C8433A");
    expect(chipSwatchColour("BLUE")).toBe("#3366B8");
  });

  it("uses the last colour word in a longer name", () => {
    expect(chipSwatchColour("light green")).toBe("#2F8A57");
  });

  it("falls back to grey for a name it does not know", () => {
    expect(chipSwatchColour("Teal")).toBe("#8B918E");
  });
});

describe("unusedChipColours", () => {
  it("leaves out colours that chips already use, in any case", () => {
    const names = unusedChipColours(["White", "red"]).map((colour) => colour.name);
    expect(names).not.toContain("White");
    expect(names).not.toContain("Red");
    expect(names[0]).toBe("Blue");
  });

  it("returns every colour when no chip exists", () => {
    expect(unusedChipColours([])).toHaveLength(10);
  });
});
