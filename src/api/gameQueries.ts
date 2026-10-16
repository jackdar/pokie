import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Game } from "../core/game.ts";
import { api } from "./client.ts";

const pollIntervalMs = 3000;

export const gameQueryKey = (gameId: string) => ["game", gameId] as const;

export function useGame(gameId: string) {
  return useQuery({
    queryKey: gameQueryKey(gameId),
    queryFn: async () => (await api.getGame(gameId)).game,
    refetchInterval: pollIntervalMs,
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
