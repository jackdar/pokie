import type { Game } from "@/core/game.ts";
import { EXTERNAL_ESCROW_ID } from "@/core/settlement.ts";

/** The name to show for one side of a payment: a player, or an escrow holder who does not play. */
export function partyName(game: Game, partyId: string): string {
  const { settlement } = game;
  if (
    partyId === EXTERNAL_ESCROW_ID &&
    settlement.mode === "escrow" &&
    settlement.holder.kind === "external"
  ) {
    return settlement.holder.name;
  }
  return game.players.find((player) => player.id === partyId)?.name ?? "Unknown player";
}

export function escrowHolderName(game: Game): string | undefined {
  const { settlement } = game;
  if (settlement.mode !== "escrow") return undefined;
  return settlement.holder.kind === "external"
    ? settlement.holder.name
    : partyName(game, settlement.holder.playerId);
}
