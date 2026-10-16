import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { approximateMinorUnits } from "@/core/chips.ts";
import type { Game } from "@/core/game.ts";
import { ledgerEntries, type LedgerEntry } from "@/core/ledger.ts";
import { formatMoney } from "@/core/money.ts";

type LedgerProps = {
  game: Game;
  /** Leave it out to show the ledger without undo buttons. */
  onUndo?: (entry: LedgerEntry) => void;
  undoPending?: boolean;
};

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

function entryLabel(entry: LedgerEntry): string {
  if (entry.kind === "buyIn") return "Buy-in";
  return entry.leavesTable ? "Left table" : "Withdrawal";
}

export function Ledger({ game, onUndo, undoPending }: LedgerProps) {
  const [confirmingId, setConfirmingId] = useState<string>();
  const entries = ledgerEntries(game);
  const playerNames = new Map(game.players.map((player) => [player.id, player.name]));

  if (entries.length === 0) {
    return (
      <p className="border-y py-4 text-muted-foreground">
        No buy-ins yet. Tap a seat on the table to seat the first player.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>What</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          {onUndo && (
            <TableHead className="w-px">
              <span className="sr-only">Undo</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="text-muted-foreground">
              {timeFormat.format(new Date(entry.createdAt))}
            </TableCell>
            <TableCell className="max-w-[8rem] truncate">
              {playerNames.get(entry.playerId)}
            </TableCell>
            <TableCell>{entryLabel(entry)}</TableCell>
            <TableCell className="text-right">
              {entry.kind === "buyIn" ? (
                formatMoney(entry.amountMinor)
              ) : (
                <span className="text-loss">
                  −{formatMoney(approximateMinorUnits(entry.chipUnits, game.rate))}
                </span>
              )}
            </TableCell>
            {onUndo && (
              <TableCell className="text-right">
                {confirmingId === entry.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-loss"
                    disabled={undoPending}
                    onClick={() => {
                      onUndo(entry);
                      setConfirmingId(undefined);
                    }}
                  >
                    Confirm
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setConfirmingId(entry.id)}
                  >
                    Undo
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
