import { MinusIcon, PlusIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, type FormEvent } from "react";
import { api, type GameUpdate } from "@/api/client.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { BottomSheet } from "@/components/BottomSheet.tsx";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { FormError } from "@/components/FormError.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { TableColourPicker } from "@/components/TableColourPicker.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Game, SettlementMode, TableColour } from "@/core/game.ts";
import { holderLabel, settleModeOptions, type SettleModeId } from "@/ui/settleModes.ts";
import { approximateMinorUnits } from "@/core/chips.ts";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/core/money.ts";
import { resolveMoneyHolder } from "@/core/settlement.ts";
import { MAX_SEATS, MIN_SEATS, seatedPlayers } from "@/core/table.ts";
import { chipSwatchColour } from "@/ui/chipColours.ts";

type GameSettingsSheetProps = {
  game: Game;
  hostToken: string;
  onClose: () => void;
};

/** "external", or the id of the player who holds the money. */
type HolderChoice = string;

const externalChoice = "external";

function initialHolderChoice(game: Game): HolderChoice {
  const { settlement } = game;
  if (settlement.mode === "direct") return externalChoice;
  const holder = resolveMoneyHolder(game, settlement.holder);
  return holder.kind === "external" ? externalChoice : holder.playerId;
}

export function GameSettingsSheet({ game, hostToken, onClose }: GameSettingsSheetProps) {
  const [seatCount, setSeatCount] = useState(game.seatCount);
  const [tableColour, setTableColour] = useState<TableColour>(game.tableColour);
  const [minBuyIn, setMinBuyIn] = useState(() =>
    game.minBuyInMinor === undefined ? "" : formatMoneyInput(game.minBuyInMinor),
  );
  const [maxBuyIn, setMaxBuyIn] = useState(() =>
    game.maxBuyInMinor === undefined ? "" : formatMoneyInput(game.maxBuyInMinor),
  );
  const [settleMode, setSettleMode] = useState<SettleModeId>(game.settlement.mode);
  const [holderChoice, setHolderChoice] = useState(() => initialHolderChoice(game));
  const [externalName, setExternalName] = useState(
    game.settlement.mode !== "direct" && game.settlement.holder.kind === "external"
      ? game.settlement.holder.name
      : "",
  );
  const [formError, setFormError] = useState<string>();
  const [copied, setCopied] = useState<"host" | "join">();
  const save = useGameMutation(game.id, (update: GameUpdate) =>
    api.updateGame(game.id, hostToken, update),
  );

  const canChangeSeats = game.status === "open";
  const canChangeSettlement = game.status === "open" || game.status === "counting";
  const canChangeColour = game.status !== "closed";
  const canChangeLimits = game.status === "open";
  const players = seatedPlayers(game);

  function buildSettlement(): SettlementMode | string {
    if (settleMode === "direct") return { mode: "direct" };
    if (holderChoice === externalChoice) {
      const name = externalName.trim();
      if (!name) return "Enter the name of the person who holds the money.";
      return { mode: settleMode, holder: { kind: "external", name } };
    }
    return { mode: settleMode, holder: { kind: "player", playerId: holderChoice } };
  }

  // Send only the settings that the game's status still allows the host to change.
  function submit(event: FormEvent) {
    event.preventDefault();
    const update: GameUpdate = {};
    if (tableColour !== game.tableColour) update.tableColour = tableColour;
    if (canChangeSeats && seatCount !== game.seatCount) update.seatCount = seatCount;
    if (canChangeLimits) {
      const min = minBuyIn.trim() === "" ? null : parseMoneyInput(minBuyIn);
      const max = maxBuyIn.trim() === "" ? null : parseMoneyInput(maxBuyIn);
      if (min === undefined || min === 0) {
        return setFormError(
          "Enter the table minimum as an amount, for example 20.00, or leave it empty.",
        );
      }
      if (max === undefined || max === 0) {
        return setFormError(
          "Enter the table maximum as an amount, for example 50.00, or leave it empty.",
        );
      }
      if ((game.minBuyInMinor ?? null) !== min) update.minBuyInMinor = min;
      if ((game.maxBuyInMinor ?? null) !== max) update.maxBuyInMinor = max;
    }
    if (canChangeSettlement) {
      const settlement = buildSettlement();
      if (typeof settlement === "string") return setFormError(settlement);
      update.settlement = settlement;
    }
    setFormError(undefined);
    save.mutate(update, { onSuccess: onClose });
  }

  function gameLink(kind: "host" | "join"): string {
    const url = new URL(`/games/${game.id}`, window.location.origin);
    if (kind === "host") url.searchParams.set("host", hostToken);
    return url.toString();
  }

  async function copyLink(kind: "host" | "join") {
    try {
      await navigator.clipboard.writeText(gameLink(kind));
      setCopied(kind);
    } catch {
      setFormError("Cannot copy to the clipboard. Copy the address from the address bar instead.");
    }
  }

  return (
    <BottomSheet title="Game settings" description={game.name} onClose={onClose}>
      <form className="grid gap-5" onSubmit={submit} noValidate>
        <fieldset className="grid gap-2" disabled={!canChangeColour}>
          <legend className="mb-1.5 text-sm font-medium">Table colour</legend>
          <TableColourPicker value={tableColour} onChange={setTableColour} surface="sheet" />
          <p className="text-sm text-muted-foreground">Everyone in the game sees this colour.</p>
        </fieldset>

        <fieldset className="grid gap-2" disabled={!canChangeLimits}>
          <legend className="mb-1.5 text-sm font-medium">Table limits</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="settings-min-buy-in">Minimum</Label>
              <MoneyInput
                id="settings-min-buy-in"
                value={minBuyIn}
                placeholder="No minimum"
                onChange={setMinBuyIn}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="settings-max-buy-in">Maximum</Label>
              <MoneyInput
                id="settings-max-buy-in"
                value={maxBuyIn}
                placeholder="No maximum"
                onChange={setMaxBuyIn}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {canChangeLimits
              ? "After any buy-in, a player's stack must be between these amounts."
              : "You can change the limits only while the game is in play."}
          </p>
        </fieldset>

        <fieldset className="grid gap-2" disabled={!canChangeSeats}>
          <legend className="mb-1.5 text-sm font-medium">Seats at the table</legend>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Remove a seat"
              disabled={seatCount <= MIN_SEATS}
              onClick={() => setSeatCount((count) => count - 1)}
            >
              <MinusIcon />
            </Button>
            <output aria-live="polite" className="min-w-[2ch] text-center text-xl font-semibold">
              {seatCount}
            </output>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add a seat"
              disabled={seatCount >= MAX_SEATS}
              onClick={() => setSeatCount((count) => count + 1)}
            >
              <PlusIcon />
            </Button>
          </div>
          {!canChangeSeats && (
            <p className="text-sm text-muted-foreground">
              You can change the seats only while the game is in play.
            </p>
          )}
        </fieldset>

        <fieldset className="grid gap-2" disabled={!canChangeSettlement}>
          <legend className="mb-1.5 text-sm font-medium">Settle up</legend>
          <RadioGroup
            value={settleMode}
            onValueChange={(value) =>
              setSettleMode(settleModeOptions.find((o) => o.id === value)?.id ?? "direct")
            }
          >
            {settleModeOptions.map((option) => (
              <Label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary"
              >
                <RadioGroupItem value={option.id} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">{option.title}</span>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
          {settleMode !== "direct" && (
            <div className="grid gap-2 pt-2">
              <p className="text-sm font-medium">{holderLabel(settleMode)}</p>
              <RadioGroup value={holderChoice} onValueChange={setHolderChoice}>
                {players.map((player) => (
                  <Label
                    key={player.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary"
                  >
                    <RadioGroupItem value={player.id} />
                    {player.name}
                  </Label>
                ))}
                <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
                  <RadioGroupItem value={externalChoice} />
                  Someone who does not play
                </Label>
              </RadioGroup>
              {holderChoice === externalChoice && (
                <div className="grid gap-1.5">
                  <Label htmlFor="settings-holder-name">Their name</Label>
                  <Input
                    id="settings-holder-name"
                    value={externalName}
                    maxLength={80}
                    placeholder="Host"
                    onChange={(event) => setExternalName(event.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </fieldset>

        <FormError message={formError ?? save.error?.message} />
        <Button type="submit" size="lg" disabled={save.isPending || !canChangeColour}>
          Save settings
        </Button>
      </form>

      <section className="grid gap-2 border-t pt-4" aria-labelledby="chips-title">
        <h3 id="chips-title" className="text-sm font-medium">
          Chips
        </h3>
        <ul className="grid gap-1.5">
          {game.denominations
            .toSorted((a, b) => a.chipValue - b.chipValue)
            .map((denomination) => (
              <li key={denomination.id} className="flex items-center gap-2.5">
                <ChipSwatch
                  hex={chipSwatchColour(denomination.colour)}
                  className="size-6 border-[3px]"
                />
                <span className="flex-1">{denomination.colour}</span>
                {denomination.quantity !== undefined && (
                  <span className="text-muted-foreground">{denomination.quantity} in the case</span>
                )}
                <span className="min-w-[5ch] text-right font-semibold">
                  {formatMoney(approximateMinorUnits(denomination.chipValue, game.rate))}
                </span>
              </li>
            ))}
        </ul>
        <p className="text-sm text-muted-foreground">Chip values are set when the game starts.</p>
      </section>

      <section className="grid gap-2 border-t pt-4" aria-labelledby="links-title">
        <h3 id="links-title" className="text-sm font-medium">
          Links
        </h3>
        <p className="text-muted-foreground">
          Game code{" "}
          <span className="text-2xl font-bold tracking-[0.2em] text-foreground [font-stretch:75%]">
            {game.joinCode}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          Players can type this code at the top of the Pokie home page to join.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyLink("join")}>
            {copied === "join" ? "Copied" : "Copy join link"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copyLink("host")}>
            {copied === "host" ? "Copied" : "Copy host link"}
          </Button>
        </div>
        <figure className="grid justify-items-start gap-2">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG
              value={gameLink("join")}
              size={176}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              title="QR code for the join link"
            />
          </div>
          <figcaption className="text-sm text-muted-foreground">
            Players can scan this to open the join link.
          </figcaption>
        </figure>
        <p className="text-sm text-muted-foreground">
          Send the join link to the table. Players open it, tap a free seat, and enter their buy-in.
          The host link lets the person who opens it make every change, so share it only with a
          co-host.
        </p>
      </section>
    </BottomSheet>
  );
}
