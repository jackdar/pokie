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
import { CasePickup } from "@/components/CasePickup.tsx";
import { ChipQuantityInputs } from "@/components/ChipQuantityInputs.tsx";
import { buyInLimitError, hasBuyInLimits } from "@/core/buyInLimits.ts";
import { hasChipCase, planBuyIn, stackValue } from "@/core/chipCase.ts";
import { approximateMinorUnits, minorUnitsToChipUnits, type ChipStack } from "@/core/chips.ts";
import type { Game, Player } from "@/core/game.ts";
import { playerTotals, suggestedBuyInMinor } from "@/core/ledger.ts";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/core/money.ts";
import { describeBuyInLimits, describeTopUp } from "@/ui/buyInLimits.ts";
import { emptyQuantityInputs, stackFromInputs } from "@/ui/chipQuantities.ts";

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
    (player: { name: string; seat: number; buyInMinor: number; buyInChips?: ChipStack }) =>
      api.addPlayer(game.id, hostToken, player),
  );
  const buyInMinor = parseMoneyInput(buyIn);
  const plan = buyInMinor ? planBuyIn(game, buyInMinor, "newPlayer") : undefined;
  const limitError = buyInMinor ? buyInLimitError(game, buyInMinor, 0) : undefined;
  const limits = describeBuyInLimits(game);

  function remember({ player, playerToken }: { player: Player; playerToken?: string }) {
    if (playerToken) rememberJoinedGame({ gameId: game.id, playerId: player.id, playerToken });
    onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName)
      return setFormError(isJoining ? "Enter your name." : "Enter the player's name.");
    if (!buyInMinor) return setFormError("Enter a buy-in amount, for example 20.00.");
    // The limit error already shows under the amount.
    if (limitError) return;
    setFormError(undefined);
    addPlayer.mutate(
      { name: trimmedName, seat, buyInMinor, ...(plan ? { buyInChips: plan.chips } : {}) },
      { onSuccess: remember },
    );
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
          {limits && <p className="text-sm text-muted-foreground">{limits}.</p>}
        </div>
        {limitError ? (
          <FormError message={limitError} />
        ) : (
          hasChipCase(game) && (
            <CasePickup game={game} amountMinor={buyInMinor} plan={plan} kind="newPlayer" />
          )
        )}
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
  /** The host can buy in and withdraw for anyone. A player can only buy in for themselves. */
  access: { role: "host"; hostToken: string } | { role: "player"; playerToken: string };
  onClose: () => void;
};

export function PlayerSheet({ game, player, access, onClose }: PlayerSheetProps) {
  const buyInToken = access.role === "host" ? access.hostToken : access.playerToken;
  const totals = playerTotals(game, player.id);
  const withdrawnMinor = approximateMinorUnits(totals.withdrawnChipUnits, game.rate);

  return (
    <BottomSheet
      title={access.role === "player" ? "Your seat" : player.name}
      description={`Seat ${player.seat + 1}`}
      onClose={onClose}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Bought in</dt>
        <dd className="text-right">{formatMoney(totals.paidInMinor)}</dd>
        <dt className="text-muted-foreground">Withdrawn</dt>
        <dd className="text-right">{formatMoney(withdrawnMinor)}</dd>
      </dl>
      {game.status === "open" ? (
        <>
          <BuyInForm
            game={game}
            player={player}
            token={buyInToken}
            isSelf={access.role === "player"}
            onDone={onClose}
          />
          {access.role === "host" && (
            <WithdrawalForm
              game={game}
              player={player}
              hostToken={access.hostToken}
              onDone={onClose}
            />
          )}
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

/** At a table with limits, a rebuy first asks what the player still has in front of them. */
function BuyInForm({
  game,
  player,
  token,
  isSelf,
  onDone,
}: Omit<PlayerFormProps, "hostToken"> & { token: string; isSelf: boolean }) {
  const [amount, setAmount] = useState(() => suggestedBuyInText(game));
  const [stack, setStack] = useState("");
  const [formError, setFormError] = useState<string>();
  const addBuyIn = useGameMutation(
    game.id,
    (buyIn: { amountMinor: number; chips?: ChipStack; stackBeforeMinor?: number }) =>
      api.addBuyIn(game.id, token, { playerId: player.id, ...buyIn }),
  );
  const isRebuy = playerTotals(game, player.id).paidInMinor > 0;
  const asksForStack = isRebuy && hasBuyInLimits(game);
  const amountMinor = parseMoneyInput(amount);
  const stackBeforeMinor = stack.trim() === "" ? undefined : parseMoneyInput(stack);
  const limitError =
    amountMinor && (!asksForStack || stackBeforeMinor !== undefined)
      ? buyInLimitError(game, amountMinor, stackBeforeMinor ?? 0)
      : undefined;
  const plan = amountMinor ? planBuyIn(game, amountMinor, "rebuy") : undefined;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (asksForStack && stackBeforeMinor === undefined) {
      return setFormError(
        `Enter what ${isSelf ? "you" : "the player"} still ${isSelf ? "have" : "has"} in front of ${isSelf ? "you" : "them"}, for example 12.00.`,
      );
    }
    if (!amountMinor) return setFormError("Enter a buy-in amount, for example 20.00.");
    // The limit error already shows under the amount.
    if (limitError) return;
    setFormError(undefined);
    addBuyIn.mutate(
      {
        amountMinor,
        ...(plan ? { chips: plan.chips } : {}),
        ...(asksForStack && stackBeforeMinor !== undefined ? { stackBeforeMinor } : {}),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="grid gap-3 border-t pt-4" onSubmit={submit} noValidate>
      {asksForStack && (
        <div className="grid gap-1.5">
          <Label htmlFor="player-stack">
            {isSelf ? "Still in front of you" : "Still in front of them"}
          </Label>
          <MoneyInput id="player-stack" value={stack} placeholder="0.00" onChange={setStack} />
          {stackBeforeMinor !== undefined && (
            <p className="text-sm text-muted-foreground">{describeTopUp(game, stackBeforeMinor)}</p>
          )}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="player-buy-in">Buy in again</Label>
        <MoneyInput id="player-buy-in" value={amount} placeholder="20.00" onChange={setAmount} />
      </div>
      {limitError ? (
        <FormError message={limitError} />
      ) : (
        hasChipCase(game) && (
          <CasePickup game={game} amountMinor={amountMinor} plan={plan} kind="rebuy" />
        )
      )}
      <FormError message={formError ?? addBuyIn.error?.message} />
      <Button type="submit" size="lg" disabled={addBuyIn.isPending}>
        Add buy-in
      </Button>
    </form>
  );
}

/** With a chip case the host counts the chips by colour, so that they go back in the case. */
function WithdrawalForm({ game, player, hostToken, onDone }: PlayerFormProps) {
  const usesCase = hasChipCase(game);
  const [amount, setAmount] = useState("");
  const [quantities, setQuantities] = useState(() => emptyQuantityInputs(game.denominations));
  const [leavesTable, setLeavesTable] = useState(false);
  const [formError, setFormError] = useState<string>();
  const addWithdrawal = useGameMutation(
    game.id,
    (withdrawal: { chipUnits: number; leavesTable: boolean; chips?: ChipStack }) =>
      api.addWithdrawal(game.id, hostToken, { playerId: player.id, ...withdrawal }),
  );
  const returnedChips = usesCase ? stackFromInputs(quantities, game.denominations) : undefined;

  function submitFromCase() {
    if (typeof returnedChips === "string") return setFormError(returnedChips);
    const chips = returnedChips ?? {};
    const chipUnits = stackValue(chips, game.denominations);
    if (chipUnits === 0 && !leavesTable) {
      return setFormError("Count the chips handed in, or tick the box if the player is leaving.");
    }
    setFormError(undefined);
    addWithdrawal.mutate({ chipUnits, leavesTable, chips }, { onSuccess: onDone });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (usesCase) return submitFromCase();
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
      {usesCase ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Withdraw chips: count what goes back in the case</p>
          <ChipQuantityInputs
            denominations={game.denominations}
            rate={game.rate}
            inputs={quantities}
            onChange={setQuantities}
          />
          {typeof returnedChips === "object" && (
            <p className="text-right text-muted-foreground">
              Worth{" "}
              {formatMoney(
                approximateMinorUnits(stackValue(returnedChips, game.denominations), game.rate),
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="player-withdrawal">Withdraw chips</Label>
          <MoneyInput
            id="player-withdrawal"
            value={amount}
            placeholder="Value of the chips handed in"
            onChange={setAmount}
          />
        </div>
      )}
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
