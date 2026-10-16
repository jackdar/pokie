import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/api/client.ts";
import { gameQueryKey } from "@/api/gameQueries.ts";
import { hostedGames, type HostedGame } from "@/api/deviceGames.ts";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

/** A hosted game, with its join code once the game has loaded from the server. */
type ListedGame = HostedGame & { joinCode: string | undefined };

function GameList({ title, games }: { title: string; games: ListedGame[] }) {
  if (games.length === 0) return null;
  const headingId = `games-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section className="grid gap-3" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-semibold">
        {title}
      </h2>
      <ul className="border-t">
        {games.map((game) => (
          <li key={game.gameId} className="border-b">
            <Link
              to="/games/$gameId"
              params={{ gameId: game.gameId }}
              className="flex items-baseline gap-4 py-3 hover:text-primary"
            >
              <span className="flex-1 truncate">{game.name}</span>
              {game.joinCode && (
                <span className="font-semibold tracking-[0.2em]">
                  <span className="sr-only">Game code </span>
                  {game.joinCode}
                </span>
              )}
              <span className="w-[6ch] text-right text-muted-foreground">
                {dateFormat.format(new Date(game.createdAt))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The games this device hosts, split into games still running and closed games. */
export function HostedGames() {
  const games = hostedGames();
  const loaded = useQueries({
    queries: games.map((game) => ({
      queryKey: gameQueryKey(game.gameId),
      queryFn: async () => (await api.getGame(game.gameId)).game,
      retry: false,
    })),
  });

  // A game that failed to load has expired from the server. It is left out.
  const current: ListedGame[] = [];
  const past: ListedGame[] = [];
  games.forEach((game, index) => {
    const result = loaded[index];
    if (result?.isError) return;
    const listed = { ...game, joinCode: result?.data?.joinCode };
    if (result?.data?.status === "closed") past.push(listed);
    else current.push(listed);
  });

  if (games.length === 0) return null;

  return (
    <div className="grid gap-10">
      <GameList title="Current games" games={current} />
      <GameList title="Past games" games={past} />
    </div>
  );
}
