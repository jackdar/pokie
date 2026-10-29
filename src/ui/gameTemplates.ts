import * as z from "zod/mini";
import { TABLE_COLOURS } from "@/core/game.ts";
import { MAX_SEATS, MIN_SEATS } from "@/core/table.ts";

/** One chip as the new-game form holds it. Value and quantity are what the host typed. */
export type TemplateChip = { colour: string; value: string; quantity: string };

const templateSchema = z.object({
  name: z.string().check(z.minLength(1), z.maxLength(80)),
  savedAt: z.string(),
  gameName: z.string().check(z.maxLength(80)),
  chips: z
    .array(z.object({ colour: z.string(), value: z.string(), quantity: z.string() }))
    .check(z.minLength(1)),
  seatCount: z.int().check(z.gte(MIN_SEATS), z.lte(MAX_SEATS)),
  tableColour: z.enum(TABLE_COLOURS),
  minBuyIn: z.string(),
  maxBuyIn: z.string(),
  settleMode: z.enum(["direct", "escrow", "cashBox"]),
  holderName: z.string(),
});

/** A new-game setup that the host saved on this device to use again. The name identifies it. */
export type GameTemplate = z.infer<typeof templateSchema>;

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Reads templates from storage. The stored data can come from an older app version or be edited by hand,
 * so the app drops each entry that does not match the template shape.
 */
export function parseGameTemplates(stored: unknown): GameTemplate[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((entry) => {
    const result = templateSchema.safeParse(entry);
    return result.success ? [result.data] : [];
  });
}

/** The templates with this one added. A template with the same name is replaced. Newest first. */
export function withTemplate(templates: GameTemplate[], template: GameTemplate): GameTemplate[] {
  return [template, ...templates.filter((t) => !sameName(t.name, template.name))];
}

export function withoutTemplate(templates: GameTemplate[], name: string): GameTemplate[] {
  return templates.filter((t) => !sameName(t.name, name));
}
