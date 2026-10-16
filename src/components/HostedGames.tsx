import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { api } from "@/api/client.ts";
import { gameQueryKey } from "@/api/gameQueries.ts";
import { hostedGames, type HostedGame } from "@/api/deviceGames.ts";

const dateFormat = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function GameList({ title, games }: { title: string; games: HostedGame[] }) {
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
              className="flex justify-between gap-4 py-3 hover:text-primary"
            >
              <span>{game.name}</span>
              <span className="text-muted-foreground">
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
export function HostedGames({ showEmptyMessage = false }: { showEmptyMessage?: boolean }) {
  const games = hostedGames();
  const statuses = useQueries({
    queries: games.map((game) => ({
      queryKey: gameQueryKey(game.gameId),
      queryFn: async () => (await api.getGame(game.gameId)).game,
      retry: false,
    })),
  });

  // A game that failed to load has expired from the server. It is left out.
  const current: HostedGame[] = [];
  const past: HostedGame[] = [];
  games.forEach((game, index) => {
    const status = statuses[index];
    if (status?.isError) return;
    if (status?.data?.status === "closed") past.push(game);
    else current.push(game);
  });

  if (games.length === 0) {
    if (!showEmptyMessage) return null;
    return (
      <p className="text-muted-foreground">
        You do not host any games on this device yet.{" "}
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          Start a game
        </Link>
      </p>
    );
  }

  return (
    <div className="grid gap-10">
      <GameList title="Current games" games={current} />
      <GameList title="Past games" games={past} />
    </div>
  );
}
