import { ChipStackList } from "@/components/ChipStackList.tsx";
import { stacksStillNeeded, type BuyInKind, type StackPlan } from "@/core/chipCase.ts";
import type { Game } from "@/core/game.ts";
import { formatMoney, type MinorUnits } from "@/core/money.ts";

type CasePickupProps = {
  game: Game;
  amountMinor: MinorUnits | undefined;
  plan: StackPlan | undefined;
  kind: BuyInKind;
};

/** Tells the person at the case which chips to take out for a buy-in. */
export function CasePickup({ game, amountMinor, plan, kind }: CasePickupProps) {
  if (!amountMinor) return null;

  if (!plan) {
    return (
      <div role="status" className="grid gap-1 rounded-lg border border-loss/60 p-3 text-sm">
        <p className="text-loss">
          The chip case cannot make up {formatMoney(amountMinor)} exactly.
        </p>
        <p className="text-muted-foreground">
          Hand out the chips yourself. This buy-in will not change the case count.
        </p>
      </div>
    );
  }

  const needed = stacksStillNeeded(game, kind);
  return (
    <div role="status" className="grid gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Take from the case</p>
      <ChipStackList stack={plan.chips} denominations={game.denominations} rate={game.rate} />
      {plan.stacks < needed && (
        <p className="text-sm text-muted-foreground">
          The case has enough for {plan.stacks} buy-in{plan.stacks === 1 ? "" : "s"} like this, not{" "}
          {needed}.
        </p>
      )}
    </div>
  );
}
