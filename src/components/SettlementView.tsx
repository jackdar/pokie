import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Game } from "@/core/game.ts";
import { formatMoney } from "@/core/money.ts";
import type { SettlementResult, Transfer } from "@/core/settlement.ts";
import { cn } from "@/lib/utils";
import { escrowHolderName, partyName } from "@/ui/parties.ts";

type SettledResult = Extract<SettlementResult, { ok: true }>;

type SettlementViewProps = {
  game: Game;
  settlement: SettledResult;
};

function signedMoney(amount: number): string {
  if (amount > 0) return `+${formatMoney(amount)}`;
  if (amount < 0) return `−${formatMoney(-amount)}`;
  return formatMoney(0);
}

function PaymentList({ game, transfers }: { game: Game; transfers: Transfer[] }) {
  return (
    <ul className="divide-y border-y">
      {transfers.map((transfer) => (
        <li
          key={`${transfer.from}-${transfer.to}`}
          className="flex items-baseline justify-between gap-4 py-3"
        >
          <span>
            <span className="font-semibold">{partyName(game, transfer.from)}</span>
            <span className="text-muted-foreground"> pays </span>
            <span className="font-semibold">{partyName(game, transfer.to)}</span>
          </span>
          <span className="text-lg font-semibold [font-stretch:75%]">
            {formatMoney(transfer.amountMinor)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SettlementView({ game, settlement }: SettlementViewProps) {
  const playersWithResults = settlement.results.filter(
    (result) => result.paidInMinor > 0 || result.cashOutMinor > 0,
  );
  const holderName = escrowHolderName(game);

  return (
    <div className="grid gap-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Bought in</TableHead>
            <TableHead className="text-right">Cashed out</TableHead>
            <TableHead className="text-right">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {playersWithResults.map((result) => (
            <TableRow key={result.playerId}>
              <TableCell className="max-w-[8rem] truncate">
                {partyName(game, result.playerId)}
              </TableCell>
              <TableCell className="text-right">{formatMoney(result.paidInMinor)}</TableCell>
              <TableCell className="text-right">{formatMoney(result.cashOutMinor)}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold",
                  result.netMinor > 0 && "text-primary",
                  result.netMinor < 0 && "text-loss",
                )}
              >
                {signedMoney(result.netMinor)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {settlement.transfers.length === 0 && (
        <p className="text-muted-foreground">Everyone broke even. Nobody needs to pay.</p>
      )}

      {settlement.transfers.length > 0 && !settlement.escrow && (
        <section className="grid gap-2" aria-labelledby="payments-title">
          <h3 id="payments-title" className="text-lg font-semibold">
            Payments
          </h3>
          <PaymentList game={game} transfers={settlement.transfers} />
        </section>
      )}

      {settlement.escrow && settlement.transfers.length > 0 && (
        <>
          {settlement.escrow.collect.length > 0 && (
            <section className="grid gap-2" aria-labelledby="collect-title">
              <h3 id="collect-title" className="text-lg font-semibold">
                {holderName} collects
              </h3>
              <PaymentList game={game} transfers={settlement.escrow.collect} />
            </section>
          )}
          {settlement.escrow.payOut.length > 0 && (
            <section className="grid gap-2" aria-labelledby="pay-out-title">
              <h3 id="pay-out-title" className="text-lg font-semibold">
                {holderName} pays out
              </h3>
              <PaymentList game={game} transfers={settlement.escrow.payOut} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
