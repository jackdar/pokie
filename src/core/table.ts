import { GameRuleError } from "./errors.ts";
import type { Game, Player } from "./game.ts";

export const MIN_SEATS = 2;
export const MAX_SEATS = 10;
export const DEFAULT_SEATS = 8;

export function hasLeftTable(game: Game, playerId: string): boolean {
  return game.withdrawals.some((w) => w.playerId === playerId && w.leavesTable);
}

export function seatedPlayers(game: Game): Player[] {
  return game.players.filter((player) => !hasLeftTable(game, player.id));
}

export function playerAtSeat(game: Game, seat: number): Player | undefined {
  return seatedPlayers(game).find((player) => player.seat === seat);
}

/** Throws when the player is not in the game or has left the table. */
export function assertSeated(game: Game, playerId: string): void {
  const player = game.players.find((p) => p.id === playerId);
  if (!player) {
    throw new GameRuleError(`Player "${playerId}" is not in this game.`);
  }
  if (hasLeftTable(game, playerId)) {
    throw new GameRuleError(`${player.name} has left the table.`);
  }
}

export function assertValidTable(game: Game): void {
  if (
    !Number.isSafeInteger(game.seatCount) ||
    game.seatCount < MIN_SEATS ||
    game.seatCount > MAX_SEATS
  ) {
    throw new GameRuleError(
      `The table must have ${MIN_SEATS} to ${MAX_SEATS} seats. Got ${game.seatCount}.`,
    );
  }

  const takenSeats = new Map<number, Player>();
  for (const player of seatedPlayers(game)) {
    if (!Number.isSafeInteger(player.seat) || player.seat < 0 || player.seat >= game.seatCount) {
      throw new GameRuleError(
        `${player.name} is in seat ${player.seat + 1}, but the table has ${game.seatCount} seats.`,
      );
    }
    const occupant = takenSeats.get(player.seat);
    if (occupant) {
      throw new GameRuleError(`Seat ${player.seat + 1} is already taken by ${occupant.name}.`);
    }
    takenSeats.set(player.seat, player);
  }
}
