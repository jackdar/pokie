import { useState, type FormEvent } from "react";
import { api } from "@/api/client.ts";
import { useGameMutation } from "@/api/gameQueries.ts";
import { BottomSheet } from "@/components/BottomSheet.tsx";
import { ChipQuantityInputs } from "@/components/ChipQuantityInputs.tsx";
import { FormError } from "@/components/FormError.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  approximateMinorUnits,
  chipValueOfCount,
  minorUnitsToChipUnits,
  type ChipCount,
} from "@/core/chips.ts";
import type { Game, Player } from "@/core/game.ts";
import { formatMoney, formatMoneyInput, parseMoneyInput } from "@/core/money.ts";
import { stackFromInputs, type QuantityInputs } from "@/ui/chipQuantities.ts";

type CountSheetProps = {
  game: Game;
  player: Player;
  /** The host token, or the player token of the player who is counted. */
  token: string;
  onClose: () => void;
};

type CountMode = "byDenomination" | "total";

function initialQuantities(game: Game, saved: ChipCount | undefined): QuantityInputs {
  return Object.fromEntries(
    game.denominations.map((denomination) => {
      const quantity = saved?.kind === "byDenomination" ? saved.counts[denomination.id] : undefined;
      return [denomination.id, quantity === undefined ? "" : String(quantity)];
    }),
  );
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
    const counts = stackFromInputs(quantities, game.denominations);
    return typeof counts === "string" ? counts : { kind: "byDenomination", counts };
  }

  const draft = buildCount();
  const draftTotalMinor =
    typeof draft === "string"
      ? undefined
      : approximateMinorUnits(chipValueOfCount(draft, game.denominations), game.rate);

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
          <ChipQuantityInputs
            denominations={game.denominations}
            rate={game.rate}
            inputs={quantities}
            onChange={setQuantities}
          />
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
