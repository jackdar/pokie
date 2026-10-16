import type { JoinedGame } from "@/api/deviceGames.ts";
import type { Game, Player } from "@/core/game.ts";
import { seatedPlayers } from "@/core/table.ts";

/** Who uses this device for this game. The role decides which seats they may tap. */
export type Viewer =
  | { role: "host"; hostToken: string }
  | { role: "player"; player: Player; playerToken: string }
  | { role: "guest" };

export function findViewer(
  game: Game,
  hostToken: string | undefined,
  joined: JoinedGame | undefined,
): Viewer {
  if (hostToken) return { role: "host", hostToken };
  const player = joined && seatedPlayers(game).find((p) => p.id === joined.playerId);
  if (joined && player) return { role: "player", player, playerToken: joined.playerToken };
  return { role: "guest" };
}

export function canSelectSeat(viewer: Viewer, game: Game, player: Player | undefined): boolean {
  if (viewer.role === "host") return player !== undefined || game.status === "open";
  if (viewer.role === "player")
    return player?.id === viewer.player.id && game.status === "counting";
  return player === undefined && game.status === "open";
}

export function viewerHint(viewer: Viewer, game: Game): string | undefined {
  if (viewer.role === "player") {
    const seat = `You are in seat ${viewer.player.seat + 1}.`;
    return game.status === "counting" ? `${seat} Tap your seat to count your chips.` : seat;
  }
  if (viewer.role === "guest") {
    return game.status === "open"
      ? "Tap a free seat on the table to join the game."
      : "You are watching this game.";
  }
  return undefined;
}
