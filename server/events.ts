import type { Game } from "../src/core/game.ts";

export type GameListener = (game: Game) => void;

/** Sends each change to a game to the screens that watch it. It lives in memory, so one server process only. */
export class GameEvents {
  private readonly listeners = new Map<string, Set<GameListener>>();

  subscribe(gameId: string, listener: GameListener): () => void {
    const gameListeners = this.listeners.get(gameId) ?? new Set<GameListener>();
    gameListeners.add(listener);
    this.listeners.set(gameId, gameListeners);

    return () => {
      gameListeners.delete(listener);
      if (gameListeners.size === 0) this.listeners.delete(gameId);
    };
  }

  publish(game: Game): void {
    for (const listener of this.listeners.get(game.id) ?? []) {
      listener(game);
    }
  }

  listenerCount(gameId: string): number {
    return this.listeners.get(gameId)?.size ?? 0;
  }
}
