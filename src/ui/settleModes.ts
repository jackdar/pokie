import type { Game, SettlementMode } from "@/core/game.ts";
import { formatMoney, type MinorUnits } from "@/core/money.ts";
import { moneyHolderName } from "@/ui/parties.ts";

export type SettleModeId = SettlementMode["mode"];

/** The settle-up choices, in the order the forms show them. */
export const settleModeOptions: { id: SettleModeId; title: string; description: string }[] = [
  {
    id: "direct",
    title: "Players pay each other",
    description:
      "Buy-ins are paid at the end. The app lists the fewest payments that settle everyone.",
  },
  {
    id: "escrow",
    title: "One person collects and pays out",
    description:
      "Buy-ins are paid at the end. Losers pay this person, and this person pays the winners.",
  },
  {
    id: "cashBox",
    title: "Buy-ins are paid up front",
    description:
      "One person takes the money for every buy-in when it happens. At the end, they pay each player the value of their chips.",
  },
];

/** The label for the person who holds the money in a mode. */
export function holderLabel(mode: SettleModeId): string {
  return mode === "cashBox" ? "Who takes the money" : "Who collects";
}

/** In cash box mode, tells the person on this screen to collect a buy-in. Undefined in other modes. */
export function buyInMoneyNote(
  game: Game,
  amountMinor: MinorUnits,
  payer: { name: string } | "you",
): string | undefined {
  const holder = moneyHolderName(game);
  if (game.settlement.mode !== "cashBox" || !holder) return undefined;
  const amount = formatMoney(amountMinor);
  return payer === "you"
    ? `Pay ${amount} to ${holder} when you buy in.`
    : `Collect ${amount} from ${payer.name} for ${holder}.`;
}

/** In cash box mode, tells the host to pay out a withdrawal now. Undefined in other modes. */
export function withdrawalMoneyNote(
  game: Game,
  amountMinor: MinorUnits,
  playerName: string,
): string | undefined {
  const holder = moneyHolderName(game);
  if (game.settlement.mode !== "cashBox" || !holder || amountMinor <= 0) return undefined;
  return `${holder} pays ${playerName} ${formatMoney(amountMinor)} from the money now.`;
}
