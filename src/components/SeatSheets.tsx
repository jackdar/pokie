import { useState, type FormEvent } from "react";
import { api } from "@/api/client.ts";
import { rememberJoinedGame } from "@/api/deviceGames.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { BottomSheet } from "@/components/BottomSheet.tsx";
import { FormError } from "@/components/FormError.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approximateMinorUnits, minorUnitsToChipUnits } from "@/core/chips.ts";
import type { Game, Player } from "@/core/game.ts";
import { playerTotals, suggestedBuyInMinor } from "@/core/ledger.ts";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/core/money.ts";

function suggestedBuyInText(game: Game): string {
  const amount = suggestedBuyInMinor(game);
  return amount === undefined ? "" : formatMoneyInput(amount);
}

type EmptySeatSheetProps = {
  game: Game;
  seat: number;
  /** With a host token the host seats someone. Without one, the person on this device takes the seat. */
  hostToken: string | undefined;
  onClose: () => void;
};

export function EmptySeatSheet({ game, seat, hostToken, onClose }: EmptySeatSheetProps) {
  const isJoining = hostToken === undefined;
  const [name, setName] = useState("");
  const [buyIn, setBuyIn] = useState(() => suggestedBuyInText(game));
  const [formError, setFormError] = useState<string>();
  const addPlayer = useGameMutation(
    game.id,
    (player: { name: string; seat: number; buyInMinor: number }) =>
      api.addPlayer(game.id, hostToken, player),
  );

  function remember({ player, playerToken }: { player: Player; playerToken?: string }) {
    if (playerToken) rememberJoinedGame({ gameId: game.id, playerId: player.id, playerToken });
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const buyInMinor = parseMoneyInput(buyIn);
    if (!trimmedName)
      return setFormError(isJoining ? "Enter your name." : "Enter the player's name.");
    if (!buyInMinor) return setFormError("Enter a buy-in amount, for example 20.00.");
    setFormError(undefined);
    addPlayer.mutate({ name: trimmedName, seat, buyInMinor }, { onSuccess: remember });
  }

  return (
    <BottomSheet
      title={isJoining ? `Sit in seat ${seat + 1}` : `Seat ${seat + 1}`}
      description={
        isJoining
          ? "Enter your name and what you put in. The host sees your buy-in straight away."
          : "This seat is free."
      }
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="seat-name">{isJoining ? "Your name" : "Name"}</Label>
          <Input
            id="seat-name"
            value={name}
            maxLength={80}
            autoComplete="off"
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="seat-buy-in">Buy-in</Label>
          <MoneyInput id="seat-buy-in" value={buyIn} placeholder="20.00" onChange={setBuyIn} />
        </div>
        <FormError message={formError ?? addPlayer.error?.message} />
        <Button type="submit" size="lg" disabled={addPlayer.isPending}>
          {isJoining ? "Take this seat" : "Seat player"}
        </Button>
      </form>
    </BottomSheet>
  );
}

type PlayerSheetProps = {
  game: Game;
  player: Player;
  hostToken: string;
  onClose: () => void;
};

export function PlayerSheet({ game, player, hostToken, onClose }: PlayerSheetProps) {
  const totals = playerTotals(game, player.id);
  const withdrawnMinor = approximateMinorUnits(totals.withdrawnChipUnits, game.rate);

  return (
    <BottomSheet title={player.name} description={`Seat ${player.seat + 1}`} onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Bought in</dt>
        <dd className="text-right">{formatMoney(totals.paidInMinor)}</dd>
        <dt className="text-muted-foreground">Withdrawn</dt>
        <dd className="text-right">{formatMoney(withdrawnMinor)}</dd>
      </dl>
      {game.status === "open" ? (
        <>
          <BuyInForm game={game} player={player} hostToken={hostToken} onDone={onClose} />
          <WithdrawalForm game={game} player={player} hostToken={hostToken} onDone={onClose} />
        </>
      ) : (
        <p className="text-muted-foreground">
          Buy-ins and withdrawals are closed while the game is {game.status}.
        </p>
      )}
    </BottomSheet>
  );
}

type PlayerFormProps = {
  game: Game;
  player: Player;
  hostToken: string;
  onDone: () => void;
};

function BuyInForm({ game, player, hostToken, onDone }: PlayerFormProps) {
  const [amount, setAmount] = useState(() => suggestedBuyInText(game));
  const [formError, setFormError] = useState<string>();
  const addBuyIn = useGameMutation(game.id, (amountMinor: number) =>
    api.addBuyIn(game.id, hostToken, { playerId: player.id, amountMinor }),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountMinor = parseMoneyInput(amount);
    if (!amountMinor) return setFormError("Enter a buy-in amount, for example 20.00.");
    setFormError(undefined);
    addBuyIn.mutate(amountMinor, { onSuccess: onDone });
  }

  return (
    <form className="grid gap-3 border-t pt-4" onSubmit={submit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="player-buy-in">Buy in again</Label>
        <MoneyInput id="player-buy-in" value={amount} placeholder="20.00" onChange={setAmount} />
      </div>
      <FormError message={formError ?? addBuyIn.error?.message} />
      <Button type="submit" size="lg" disabled={addBuyIn.isPending}>
        Add buy-in
      </Button>
    </form>
  );
}

function WithdrawalForm({ game, player, hostToken, onDone }: PlayerFormProps) {
  const [amount, setAmount] = useState("");
  const [leavesTable, setLeavesTable] = useState(false);
  const [formError, setFormError] = useState<string>();
  const addWithdrawal = useGameMutation(
    game.id,
    (withdrawal: { chipUnits: number; leavesTable: boolean }) =>
      api.addWithdrawal(game.id, hostToken, { playerId: player.id, ...withdrawal }),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountMinor = amount.trim() === "" && leavesTable ? 0 : parseMoneyInput(amount);
    if (amountMinor === undefined) {
      return setFormError("Enter the value of the chips, for example 15.00.");
    }
    if (amountMinor === 0 && !leavesTable) {
      return setFormError(
        "Enter the value of the chips, or tick the box if the player is leaving.",
      );
    }
    setFormError(undefined);
    addWithdrawal.mutate(
      { chipUnits: minorUnitsToChipUnits(amountMinor, game.rate), leavesTable },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="grid gap-3 border-t pt-4" onSubmit={submit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="player-withdrawal">Withdraw chips</Label>
        <MoneyInput
          id="player-withdrawal"
          value={amount}
          placeholder="Value of the chips handed in"
          onChange={setAmount}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <Checkbox
          id="player-leaves"
          checked={leavesTable}
          onCheckedChange={(checked) => setLeavesTable(checked === true)}
        />
        <Label htmlFor="player-leaves" className="font-normal">
          {player.name} is leaving the table
        </Label>
      </div>
      <FormError message={formError ?? addWithdrawal.error?.message} />
      <Button type="submit" size="lg" variant="secondary" disabled={addWithdrawal.isPending}>
        {leavesTable ? "Withdraw and leave" : "Withdraw chips"}
      </Button>
    </form>
  );
}
