import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Game } from "../core/game.ts";
import { api } from "./client.ts";

export const gameQueryKey = (gameId: string) => ["game", gameId] as const;

/**
 * Loads the game once, then keeps it current with live updates from the server.
 * The browser reconnects the stream on its own, and the server sends the whole game again on each connect.
 */
export function useGame(gameId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`/api/games/${gameId}/events`);
    source.addEventListener("game", (event) => {
      queryClient.setQueryData(gameQueryKey(gameId), JSON.parse(event.data) as Game);
    });
    return () => source.close();
  }, [gameId, queryClient]);

  return useQuery({
    queryKey: gameQueryKey(gameId),
    queryFn: async () => (await api.getGame(gameId)).game,
  });
}

/** Every write returns the new game. Put it in the cache so the screen updates without a refetch. */
export function useGameMutation<TVariables, TResult extends { game: Game }>(
  gameId: string,
  write: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: ({ game }) => {
      queryClient.setQueryData(gameQueryKey(gameId), game);
    },
  });
}
