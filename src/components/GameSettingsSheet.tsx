import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type GameUpdate } from "@/api/client.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { BottomSheet } from "@/components/BottomSheet.tsx";
import { FormError } from "@/components/FormError.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Game, SettlementMode, TableColour } from "@/core/game.ts";
import { cn } from "@/lib/utils";
import { tableColourOptions } from "@/ui/tableColours.ts";
import { MAX_SEATS, MIN_SEATS, seatedPlayers } from "@/core/table.ts";

type GameSettingsSheetProps = {
  game: Game;
  hostToken: string;
  onClose: () => void;
};

/** "direct", "external", or the id of the player who holds the money. */
type HolderChoice = string;

const directChoice = "direct";
const externalChoice = "external";

function initialChoice(settlement: SettlementMode): HolderChoice {
  if (settlement.mode === "direct") return directChoice;
  return settlement.holder.kind === "external" ? externalChoice : settlement.holder.playerId;
}

export function GameSettingsSheet({ game, hostToken, onClose }: GameSettingsSheetProps) {
  const [seatCount, setSeatCount] = useState(game.seatCount);
  const [tableColour, setTableColour] = useState<TableColour>(game.tableColour);
  const [choice, setChoice] = useState(() => initialChoice(game.settlement));
  const [externalName, setExternalName] = useState(
    game.settlement.mode === "escrow" && game.settlement.holder.kind === "external"
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
  const players = seatedPlayers(game);

  function buildSettlement(): SettlementMode | string {
    if (choice === directChoice) return { mode: "direct" };
    if (choice === externalChoice) {
      const name = externalName.trim();
      if (!name) return "Enter the name of the person who collects and pays out.";
      return { mode: "escrow", holder: { kind: "external", name } };
    }
    return { mode: "escrow", holder: { kind: "player", playerId: choice } };
  }

  // Send only the settings that the game's status still allows the host to change.
  function submit(event: FormEvent) {
    event.preventDefault();
    const update: GameUpdate = {};
    if (tableColour !== game.tableColour) update.tableColour = tableColour;
    if (canChangeSeats && seatCount !== game.seatCount) update.seatCount = seatCount;
    if (canChangeSettlement) {
      const settlement = buildSettlement();
      if (typeof settlement === "string") return setFormError(settlement);
      update.settlement = settlement;
    }
    setFormError(undefined);
    save.mutate(update, { onSuccess: onClose });
  }

  async function copyLink(kind: "host" | "join") {
    const url = new URL(`/games/${game.id}`, window.location.origin);
    if (kind === "host") url.searchParams.set("host", hostToken);
    try {
      await navigator.clipboard.writeText(url.toString());
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
          <div role="radiogroup" aria-label="Table colour" className="flex gap-3">
            {tableColourOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={tableColour === option.id}
                aria-label={option.label}
                title={option.label}
                className={cn(
                  "flex aspect-square size-10 items-center justify-center rounded-full border-2 border-rail-light focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                  tableColour === option.id &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-popover",
                )}
                style={{ backgroundColor: option.felt }}
                onClick={() => setTableColour(option.id)}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Everyone in the game sees this colour.</p>
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
          <RadioGroup value={choice} onValueChange={setChoice}>
            <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
              <RadioGroupItem value={directChoice} />
              Players pay each other
            </Label>
            {players.map((player) => (
              <Label
                key={player.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary"
              >
                <RadioGroupItem value={player.id} />
                {player.name} collects and pays out
              </Label>
            ))}
            <Label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
              <RadioGroupItem value={externalChoice} />
              Someone else collects and pays out
            </Label>
          </RadioGroup>
          {choice === externalChoice && (
            <div className="grid gap-1.5">
              <Label htmlFor="settings-holder-name">Who collects</Label>
              <Input
                id="settings-holder-name"
                value={externalName}
                maxLength={80}
                onChange={(event) => setExternalName(event.target.value)}
              />
            </div>
          )}
        </fieldset>

        <FormError message={formError ?? save.error?.message} />
        <Button type="submit" size="lg" disabled={save.isPending || !canChangeColour}>
          Save settings
        </Button>
      </form>

      <section className="grid gap-2 border-t pt-4" aria-labelledby="links-title">
        <h3 id="links-title" className="text-sm font-medium">
          Links
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyLink("join")}>
            {copied === "join" ? "Copied" : "Copy join link"}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copyLink("host")}>
            {copied === "host" ? "Copied" : "Copy host link"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Send the join link to the table. Players open it, tap a free seat, and enter their buy-in.
          The host link lets the person who opens it make every change, so share it only with a
          co-host.
        </p>
      </section>
    </BottomSheet>
  );
}
