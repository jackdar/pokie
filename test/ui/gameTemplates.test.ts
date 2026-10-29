import { describe, expect, it } from "vitest";
import {
  parseGameTemplates,
  withTemplate,
  withoutTemplate,
  type GameTemplate,
} from "../../src/ui/gameTemplates.ts";

const baseTemplate: GameTemplate = {
  name: "Friday cash game",
  savedAt: "2026-10-23T09:00:00.000Z",
  gameName: "Friday Pokie Night",
  chips: [
    { colour: "White", value: "0.25", quantity: "100" },
    { colour: "Red", value: "1.00", quantity: "50" },
  ],
  seatCount: 6,
  tableColour: "blue",
  minBuyIn: "20.00",
  maxBuyIn: "",
  settleMode: "cashBox",
  holderName: "Sam",
};

describe("parseGameTemplates", () => {
  it("reads templates that were stored as JSON", () => {
    const stored: unknown = JSON.parse(JSON.stringify([baseTemplate]));
    expect(parseGameTemplates(stored)).toEqual([baseTemplate]);
  });

  it("drops an entry with an unknown table colour and keeps the others", () => {
    const other = { ...baseTemplate, name: "Home game" };
    expect(parseGameTemplates([{ ...baseTemplate, tableColour: "orange" }, other])).toEqual([
      other,
    ]);
  });

  it("drops an entry with a seat count outside the table limits", () => {
    expect(parseGameTemplates([{ ...baseTemplate, seatCount: 11 }])).toEqual([]);
  });

  it("drops an entry with no chips", () => {
    expect(parseGameTemplates([{ ...baseTemplate, chips: [] }])).toEqual([]);
  });

  it("drops an entry with a missing field", () => {
    const { settleMode: _, ...withoutSettleMode } = baseTemplate;
    expect(parseGameTemplates([withoutSettleMode])).toEqual([]);
  });

  it("returns no templates when storage holds something other than a list", () => {
    expect(parseGameTemplates({ name: "Friday cash game" })).toEqual([]);
  });
});

describe("withTemplate", () => {
  it("puts a new template first", () => {
    const older = { ...baseTemplate, name: "Home game" };
    expect(withTemplate([older], baseTemplate)).toEqual([baseTemplate, older]);
  });

  it("replaces a template with the same name, ignoring case and spaces", () => {
    const replacement = { ...baseTemplate, name: " friday CASH game", seatCount: 9 };
    expect(withTemplate([baseTemplate], replacement)).toEqual([replacement]);
  });
});

describe("withoutTemplate", () => {
  it("removes the template with the given name", () => {
    const other = { ...baseTemplate, name: "Home game" };
    expect(withoutTemplate([baseTemplate, other], "Friday Cash Game")).toEqual([other]);
  });
});
