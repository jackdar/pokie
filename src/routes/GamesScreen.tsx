import { Link } from "@tanstack/react-router";
import { HostedGames } from "@/components/HostedGames.tsx";

export function GamesScreen() {
  return (
    <>
      <header className="mb-8 grid gap-1">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Pokie
        </Link>
        <h1 className="text-3xl font-bold">Your games</h1>
        <p className="text-muted-foreground">The games you host on this device.</p>
      </header>
      <HostedGames showEmptyMessage />
    </>
  );
}
