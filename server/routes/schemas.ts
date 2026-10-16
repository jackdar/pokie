import { z } from "zod";
import { TABLE_COLOURS } from "../../src/core/game.ts";
import { DEFAULT_SEATS } from "../../src/core/table.ts";

const nameSchema = z.string().trim().min(1).max(80);

const rateSchema = z.object({
  minorUnits: z.int().positive(),
  chipUnits: z.int().positive(),
});

const denominationSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  colour: z.string().trim().min(1).max(40),
  chipValue: z.int().positive(),
  quantity: z.int().nonnegative().optional(),
});

const chipStackSchema = z.record(z.string(), z.int().nonnegative());

const settlementSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("direct") }),
  z.object({
    mode: z.literal("escrow"),
    holder: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("player"), playerId: z.string().min(1) }),
      z.object({ kind: z.literal("external"), name: nameSchema }),
    ]),
  }),
]);

export const createGameSchema = z.object({
  name: nameSchema,
  // The app enters chip values in money, so one chip unit is one minor unit.
  rate: rateSchema.default({ minorUnits: 1, chipUnits: 1 }),
  denominations: z.array(denominationSchema).min(1).max(20),
  settlement: settlementSchema.default({ mode: "direct" }),
  seatCount: z.int().default(DEFAULT_SEATS),
  tableColour: z.enum(TABLE_COLOURS).default("green"),
  minBuyInMinor: z.int().positive().optional(),
  maxBuyInMinor: z.int().positive().optional(),
});

export const updateGameSchema = z.object({
  name: nameSchema.optional(),
  rate: rateSchema.optional(),
  denominations: z.array(denominationSchema).min(1).max(20).optional(),
  settlement: settlementSchema.optional(),
  seatCount: z.int().optional(),
  tableColour: z.enum(TABLE_COLOURS).optional(),
  /** null removes the limit. */
  minBuyInMinor: z.int().positive().nullable().optional(),
  maxBuyInMinor: z.int().positive().nullable().optional(),
  status: z.enum(["open", "counting", "settled", "closed"]).optional(),
});

export const addPlayerSchema = z.object({
  name: nameSchema,
  seat: z.int().nonnegative(),
  buyInMinor: z.int().positive().optional(),
  /** The chips taken from the chip case for the first buy-in. */
  buyInChips: chipStackSchema.optional(),
});

export const addBuyInSchema = z.object({
  playerId: z.string().min(1),
  amountMinor: z.int().positive(),
  chips: chipStackSchema.optional(),
  /** What the player still has in front of them. Needed for a rebuy when the table has limits. */
  stackBeforeMinor: z.int().nonnegative().optional(),
});

export const addWithdrawalSchema = z.object({
  playerId: z.string().min(1),
  chipUnits: z.int().nonnegative(),
  leavesTable: z.boolean().default(false),
  chips: chipStackSchema.optional(),
});

export const saveFinalCountSchema = z.object({
  count: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("byDenomination"),
      counts: z.record(z.string(), z.int().nonnegative()),
    }),
    z.object({ kind: z.literal("total"), chipUnits: z.int().nonnegative() }),
  ]),
});
