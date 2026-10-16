import { MinusIcon, PlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/api/client.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { BottomSheet } from "@/components/BottomSheet.tsx";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { FormError } from "@/components/FormError.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  approximateMinorUnits,
  chipValueOfCount,
  minorUnitsToChipUnits,
  type ChipCount,
} from "@/core/chips.ts";
import type { Game, Player } from "@/core/game.ts";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/core/money.ts";
import { chipSwatchColour } from "@/ui/chipColours.ts";

type CountSheetProps = {
  game: Game;
  player: Player;
  /** The host token, or the player token of the player who is counted. */
  token: string;
  onClose: () => void;
};

type CountMode = "byDenomination" | "total";

function initialQuantities(game: Game, saved: ChipCount | undefined): Record<string, string> {
  return Object.fromEntries(
    game.denominations.map((denomination) => {
      const quantity = saved?.kind === "byDenomination" ? saved.counts[denomination.id] : undefined;
      return [denomination.id, quantity === undefined ? "" : String(quantity)];
    }),
  );
}

function parseQuantity(text: string): number | undefined {
  const cleaned = text.trim();
  if (cleaned === "") return 0;
  if (!/^\d+$/.test(cleaned)) return undefined;
  const quantity = Number(cleaned);
  return Number.isSafeInteger(quantity) ? quantity : undefined;
}

export function CountSheet({ game, player, token, onClose }: CountSheetProps) {
  const saved = game.finalCounts.find((count) => count.playerId === player.id)?.count;
  const [mode, setMode] = useState<CountMode>(saved?.kind ?? "byDenomination");
  const [quantities, setQuantities] = useState(() => initialQuantities(game, saved));
  const [total, setTotal] = useState(() =>
    saved?.kind === "total"
      ? formatMoneyInput(approximateMinorUnits(saved.chipUnits, game.rate))
      : "",
  );
  const [formError, setFormError] = useState<string>();
  const saveCount = useGameMutation(game.id, (count: ChipCount) =>
    api.saveFinalCount(game.id, token, player.id, count),
  );

  function buildCount(): ChipCount | string {
    if (mode === "total") {
      const totalMinor = total.trim() === "" ? 0 : parseMoneyInput(total);
      if (totalMinor === undefined) return "Enter the total value, for example 42.50.";
      return { kind: "total", chipUnits: minorUnitsToChipUnits(totalMinor, game.rate) };
    }
    const counts: Record<string, number> = {};
    for (const denomination of game.denominations) {
      const quantity = parseQuantity(quantities[denomination.id] ?? "");
      if (quantity === undefined) {
        return `Enter the number of ${denomination.colour} chips as a whole number.`;
      }
      if (quantity > 0) counts[denomination.id] = quantity;
    }
    return { kind: "byDenomination", counts };
  }

  const draft = buildCount();
  const draftTotalMinor =
    typeof draft === "string"
      ? undefined
      : approximateMinorUnits(chipValueOfCount(draft, game.denominations), game.rate);

  function changeQuantity(denominationId: string, change: number) {
    setQuantities((current) => {
      const quantity = parseQuantity(current[denominationId] ?? "") ?? 0;
      return { ...current, [denominationId]: String(Math.max(0, quantity + change)) };
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (typeof draft === "string") return setFormError(draft);
    setFormError(undefined);
    saveCount.mutate(draft, { onSuccess: onClose });
  }

  return (
    <BottomSheet
      title={`Count ${player.name}'s chips`}
      description={`Seat ${player.seat + 1}`}
      onClose={onClose}
    >
      <form className="grid gap-4" onSubmit={submit} noValidate>
        {mode === "byDenomination" ? (
          <div className="grid gap-2">
            {game.denominations.map((denomination) => (
              <div
                key={denomination.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
              >
                <ChipSwatch hex={chipSwatchColour(denomination.colour)} />
                <span className="leading-tight">
                  {denomination.colour}
                  <span className="block text-sm text-muted-foreground">
                    {formatMoney(approximateMinorUnits(denomination.chipValue, game.rate))} each
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`One fewer ${denomination.colour} chip`}
                    onClick={() => changeQuantity(denomination.id, -1)}
                  >
                    <MinusIcon />
                  </Button>
                  <Input
                    aria-label={`Number of ${denomination.colour} chips`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    className="w-16 text-center"
                    value={quantities[denomination.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [denomination.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`One more ${denomination.colour} chip`}
                    onClick={() => changeQuantity(denomination.id, 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="count-total">Total value of the chips</Label>
            <MoneyInput id="count-total" value={total} placeholder="0.00" onChange={setTotal} />
          </div>
        )}

        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-muted-foreground">Total</span>
          <span className="text-2xl font-bold [font-stretch:75%]">
            {draftTotalMinor === undefined ? "–" : formatMoney(draftTotalMinor)}
          </span>
        </div>

        <FormError message={formError ?? saveCount.error?.message} />
        <Button type="submit" size="lg" disabled={saveCount.isPending}>
          Save count
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setFormError(undefined);
            setMode(mode === "total" ? "byDenomination" : "total");
          }}
        >
          {mode === "total" ? "Count chips by colour instead" : "Enter a total value instead"}
        </Button>
      </form>
    </BottomSheet>
  );
}
