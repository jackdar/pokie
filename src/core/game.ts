import type { ChipCount, ChipDenomination, ChipRate } from "./chips.ts";
import { GameRuleError } from "./errors.ts";
import type { MinorUnits } from "./money.ts";

export type Player = {
  id: string;
  name: string;
  /** Zero-based seat index. */
  seat: number;
};

export type BuyIn = {
  id: string;
  playerId: string;
  amountMinor: MinorUnits;
  createdAt: string;
};

/** Chips that a player hands in during the game. They count toward that player's cash-out. */
export type Withdrawal = {
  id: string;
  playerId: string;
  chipUnits: number;
  leavesTable: boolean;
  createdAt: string;
};

export type FinalCount = {
  playerId: string;
  count: ChipCount;
  submittedBy: "host" | "player";
};

export type EscrowHolder =
  | { kind: "player"; playerId: string }
  | { kind: "external"; name: string };

export type SettlementMode = { mode: "direct" } | { mode: "escrow"; holder: EscrowHolder };

export const TABLE_COLOURS = ["green", "blue", "red", "purple"] as const;

export type TableColour = (typeof TABLE_COLOURS)[number];

/** A closed game is final. Nothing in it can change again. */
export type GameStatus = "open" | "counting" | "settled" | "closed";

export type Game = {
  id: string;
  name: string;
  rate: ChipRate;
  denominations: ChipDenomination[];
  status: GameStatus;
  seatCount: number;
  tableColour: TableColour;
  /** Ordered by seat, then by join order. Settlement uses this order to break ties. */
  players: Player[];
  buyIns: BuyIn[];
  withdrawals: Withdrawal[];
  finalCounts: FinalCount[];
  settlement: SettlementMode;
};

const allowedTransitions: Record<GameStatus, GameStatus[]> = {
  open: ["counting"],
  counting: ["open", "settled"],
  settled: ["counting", "closed"],
  closed: [],
};

export type GameEdit =
  | "name"
  | "tableColour"
  | "players"
  | "seatCount"
  | "buyIns"
  | "withdrawals"
  | "finalCounts"
  | "chipSetup"
  | "settlement";

const editableIn: Record<GameEdit, { statuses: GameStatus[]; label: string }> = {
  name: { statuses: ["open", "counting", "settled"], label: "the name" },
  tableColour: { statuses: ["open", "counting", "settled"], label: "the table colour" },
  players: { statuses: ["open"], label: "players" },
  seatCount: { statuses: ["open"], label: "the seat count" },
  buyIns: { statuses: ["open"], label: "buy-ins" },
  withdrawals: { statuses: ["open"], label: "withdrawals" },
  finalCounts: { statuses: ["counting"], label: "final counts" },
  chipSetup: { statuses: ["open"], label: "the chip setup" },
  settlement: { statuses: ["open", "counting"], label: "the settlement mode" },
};

export function assertEditable(game: Game, edit: GameEdit): void {
  const rule = editableIn[edit];
  if (!rule.statuses.includes(game.status)) {
    throw new GameRuleError(`You cannot change ${rule.label} while the game is "${game.status}".`);
  }
}

export function changeStatus(game: Game, nextStatus: GameStatus): Game {
  if (game.status === "closed") {
    throw new GameRuleError("This game is closed. It cannot change again.");
  }
  if (!allowedTransitions[game.status].includes(nextStatus)) {
    throw new GameRuleError(`A game cannot move from "${game.status}" to "${nextStatus}".`);
  }
  return { ...game, status: nextStatus };
}
