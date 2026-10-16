import type { Game } from "@/core/game.ts";
import { EXTERNAL_HOLDER_ID } from "@/core/settlement.ts";

/** The name to show for one side of a payment: a player, or a money holder who does not play. */
export function partyName(game: Game, partyId: string): string {
  const { settlement } = game;
  if (
    partyId === EXTERNAL_HOLDER_ID &&
    settlement.mode !== "direct" &&
    settlement.holder.kind === "external"
  ) {
    return settlement.holder.name;
  }
  return game.players.find((player) => player.id === partyId)?.name ?? "Unknown player";
}

/** The person who holds the money in escrow or cash box mode. */
export function moneyHolderName(game: Game): string | undefined {
  const { settlement } = game;
  if (settlement.mode === "direct") return undefined;
  return settlement.holder.kind === "external"
    ? settlement.holder.name
    : partyName(game, settlement.holder.playerId);
}
