import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/api/client.ts";
import { hostTokenFor, joinedGameFor, rememberHostedGame } from "@/api/deviceGames.ts";
import { applyTableColour } from "@/ui/tableColours.ts";
import { canSelectSeat, findViewer, viewerHint } from "@/ui/viewer.ts";
import { useGame, useGameMutation } from "@/api/gameQueries.ts";
import { CountSheet } from "@/components/CountSheet.tsx";
import { CountSummary } from "@/components/CountSummary.tsx";
import { FormError } from "@/components/FormError.tsx";
import { GameSettingsSheet } from "@/components/GameSettingsSheet.tsx";
import { Ledger } from "@/components/Ledger.tsx";
import { PokerTable } from "@/components/PokerTable.tsx";
import { EmptySeatSheet, PlayerSheet } from "@/components/SeatSheets.tsx";
import { SettlementView } from "@/components/SettlementView.tsx";
import { StatusActions } from "@/components/StatusActions.tsx";
import { Button } from "@/components/ui/button";
import type { GameStatus } from "@/core/game.ts";
import type { LedgerEntry } from "@/core/ledger.ts";
import { settle } from "@/core/settlement.ts";
import { playerAtSeat } from "@/core/table.ts";

const statusLabels: Record<GameStatus, string> = {
  open: "In play",
  counting: "Counting chips",
  settled: "Settled",
  closed: "Closed",
};

export function GameScreen() {
  const { gameId } = useParams({ from: "/games/$gameId" });
  const { host: hostTokenFromLink } = useSearch({ from: "/games/$gameId" });
  const navigate = useNavigate();
  const gameQuery = useGame(gameId);
  const [hostToken] = useState(() => hostTokenFromLink ?? hostTokenFor(gameId));
  const [selectedSeat, setSelectedSeat] = useState<number>();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const game = gameQuery.data;
  const tableColour = game?.tableColour ?? "green";

  useEffect(() => {
    applyTableColour(tableColour);
    return () => applyTableColour("green");
  }, [tableColour]);

  // Keep the host token from a host link on this device, then remove it from the address bar.
  useEffect(() => {
    if (!hostTokenFromLink || !game) return;
    rememberHostedGame({
      gameId,
      name: game.name,
      hostToken: hostTokenFromLink,
      createdAt: new Date().toISOString(),
    });
    void navigate({ to: "/games/$gameId", params: { gameId }, search: {}, replace: true });
  }, [hostTokenFromLink, game, gameId, navigate]);

  const undo = useGameMutation(gameId, (entry: LedgerEntry) => {
    if (!hostToken) throw new Error("Only the host can undo entries.");
    return entry.kind === "buyIn"
      ? api.removeBuyIn(gameId, hostToken, entry.id)
      : api.removeWithdrawal(gameId, hostToken, entry.id);
  });

  if (gameQuery.isPending) {
    return <p className="text-muted-foreground">Loading the game…</p>;
  }

  if (!game) {
    const notFound = gameQuery.error instanceof ApiError && gameQuery.error.status === 404;
    return (
      <div className="grid gap-3">
        <h1 className="text-3xl font-bold">
          {notFound ? "Game not found" : "Cannot load the game"}
        </h1>
        <p className="text-muted-foreground">
          {notFound
            ? "This game does not exist. Games are deleted 30 days after the last change."
            : gameQuery.error?.message}
        </p>
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          Start a new game
        </Link>
      </div>
    );
  }

  // Read on every render. Storage changes when this device joins the game.
  const viewer = findViewer(game, hostToken, joinedGameFor(game.id));
  const hint = viewerHint(viewer, game);
  const selectedPlayer = selectedSeat === undefined ? undefined : playerAtSeat(game, selectedSeat);
  const settlement = settle(game);
  const closeSeat = () => setSelectedSeat(undefined);
  const countToken =
    viewer.role === "host"
      ? viewer.hostToken
      : viewer.role === "player"
        ? viewer.playerToken
        : undefined;

  return (
    <>
      <header className="mb-8 grid gap-1">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Pokie
        </Link>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">{game.name}</h1>
          {viewer.role === "host" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Game settings"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon />
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">{statusLabels[game.status]}</p>
        {hint && <p>{hint}</p>}
      </header>

      {viewer.role === "host" && game.status !== "closed" && (
        <div className="mb-8">
          <StatusActions
            game={game}
            hostToken={viewer.hostToken}
            isBalanced={settlement.reconciliation.isBalanced}
          />
        </div>
      )}

      {game.status === "counting" && (
        <div className="mb-8">
          <CountSummary game={game} reconciliation={settlement.reconciliation} />
        </div>
      )}

      {(game.status === "settled" || game.status === "closed") && settlement.ok && (
        <section className="mb-10 grid gap-3" aria-labelledby="settlement-title">
          <h2 id="settlement-title" className="text-xl font-semibold">
            Who pays whom
          </h2>
          <SettlementView game={game} settlement={settlement} />
        </section>
      )}

      <section className="grid gap-3" aria-labelledby="table-title">
        <h2 id="table-title" className="text-xl font-semibold">
          Table
        </h2>
        <PokerTable
          game={game}
          canSelectSeat={(_, player) => canSelectSeat(viewer, game, player)}
          onSeatSelect={setSelectedSeat}
          ownPlayerId={viewer.role === "player" ? viewer.player.id : undefined}
        />
      </section>

      <section className="mt-10 grid gap-3" aria-labelledby="ledger-title">
        <h2 id="ledger-title" className="text-xl font-semibold">
          Buy-ins and withdrawals
        </h2>
        <Ledger
          game={game}
          onUndo={
            viewer.role === "host" && game.status === "open"
              ? (entry) => undo.mutate(entry)
              : undefined
          }
          undoPending={undo.isPending}
        />
        <FormError message={undo.error?.message} />
      </section>

      {countToken && selectedPlayer && game.status === "counting" && (
        <CountSheet game={game} player={selectedPlayer} token={countToken} onClose={closeSeat} />
      )}
      {viewer.role === "host" && selectedPlayer && game.status !== "counting" && (
        <PlayerSheet
          game={game}
          player={selectedPlayer}
          hostToken={viewer.hostToken}
          onClose={closeSeat}
        />
      )}
      {viewer.role !== "player" &&
        selectedSeat !== undefined &&
        !selectedPlayer &&
        game.status === "open" && (
          <EmptySeatSheet
            game={game}
            seat={selectedSeat}
            hostToken={viewer.role === "host" ? viewer.hostToken : undefined}
            onClose={closeSeat}
          />
        )}
      {viewer.role === "host" && settingsOpen && (
        <GameSettingsSheet
          game={game}
          hostToken={viewer.hostToken}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
