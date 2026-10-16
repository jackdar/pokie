import { approximateMinorUnits } from "@/core/chips.ts";
import type { Game } from "@/core/game.ts";
import { formatMoney } from "@/core/money.ts";
import type { Reconciliation } from "@/core/settlement.ts";
import { cn } from "@/lib/utils";
import { partyName } from "@/ui/parties.ts";

type CountSummaryProps = {
  game: Game;
  reconciliation: Reconciliation;
};

export function CountSummary({ game, reconciliation }: CountSummaryProps) {
  const money = (chipUnits: number) => formatMoney(approximateMinorUnits(chipUnits, game.rate));
  const expectedChipUnits = reconciliation.issuedChipUnits - reconciliation.withdrawnChipUnits;
  const { differenceChipUnits, playersMissingCount, isBalanced } = reconciliation;

  return (
    <div
      role="status"
      className={cn("grid gap-1 rounded-lg border p-4", isBalanced && "border-primary")}
    >
      <p className="text-lg font-semibold">
        Counted {money(reconciliation.countedChipUnits)} of {money(expectedChipUnits)}
      </p>
      {playersMissingCount.length > 0 && (
        <p className="text-muted-foreground">
          Still to count:{" "}
          {playersMissingCount.map((playerId) => partyName(game, playerId)).join(", ")}. Tap a seat
          to count it.
        </p>
      )}
      {playersMissingCount.length === 0 && differenceChipUnits < 0 && (
        <p className="text-loss">
          {money(-differenceChipUnits)} is missing. Count again, or check for chips off the table.
        </p>
      )}
      {playersMissingCount.length === 0 && differenceChipUnits > 0 && (
        <p className="text-loss">
          {money(differenceChipUnits)} more was counted than was bought. Check the counts and the
          buy-ins.
        </p>
      )}
      {isBalanced && <p className="text-primary">Every chip is counted. You can settle up.</p>}
    </div>
  );
}
