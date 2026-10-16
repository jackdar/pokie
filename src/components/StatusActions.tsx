import { useState } from "react";
import { api } from "@/api/client.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { FormError } from "@/components/FormError.tsx";
import { Button } from "@/components/ui/button";
import type { Game, GameStatus } from "@/core/game.ts";

type StatusActionsProps = {
  game: Game;
  hostToken: string;
  isBalanced: boolean;
};

export function StatusActions({ game, hostToken, isBalanced }: StatusActionsProps) {
  const changeStatus = useGameMutation(game.id, (status: GameStatus) =>
    api.updateGame(game.id, hostToken, { status }),
  );
  const pending = changeStatus.isPending;
  const [confirmingClose, setConfirmingClose] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {game.status === "open" && (
          <Button size="lg" disabled={pending} onClick={() => changeStatus.mutate("counting")}>
            Start counting
          </Button>
        )}
        {game.status === "counting" && (
          <>
            <Button
              size="lg"
              disabled={pending || !isBalanced}
              onClick={() => changeStatus.mutate("settled")}
            >
              Settle up
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => changeStatus.mutate("open")}
            >
              Back to buy-ins
            </Button>
          </>
        )}
        {game.status === "settled" && !confirmingClose && (
          <>
            <Button size="lg" disabled={pending} onClick={() => setConfirmingClose(true)}>
              Close game
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => changeStatus.mutate("counting")}
            >
              Reopen counting
            </Button>
          </>
        )}
        {game.status === "settled" && confirmingClose && (
          <>
            <Button size="lg" disabled={pending} onClick={() => changeStatus.mutate("closed")}>
              Close for good
            </Button>
            <Button size="lg" variant="outline" onClick={() => setConfirmingClose(false)}>
              Keep it open
            </Button>
          </>
        )}
      </div>
      {game.status === "settled" && confirmingClose && (
        <p className="text-sm text-muted-foreground">
          A closed game cannot change again. Everyone with the link can still see who pays whom.
        </p>
      )}
      {game.status === "open" && (
        <p className="text-sm text-muted-foreground">
          Counting closes buy-ins and withdrawals. You can go back if someone buys in again.
        </p>
      )}
      <FormError message={changeStatus.error?.message} />
    </div>
  );
}
