import { ChipStackList } from "@/components/ChipStackList.tsx";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { caseContents, seatShare, stackValue } from "@/core/chipCase.ts";
import { approximateMinorUnits } from "@/core/chips.ts";
import type { Game } from "@/core/game.ts";
import { formatMoney } from "@/core/money.ts";
import { cn } from "@/lib/utils";
import { chipSwatchColour } from "@/ui/chipColours.ts";

/** What is left in the host's chip case, and what one seat's fair share of the whole case is. */
export function ChipCaseSection({ game }: { game: Game }) {
  const contents = caseContents(game);
  const share = seatShare(game);
  const money = (chipUnits: number) => formatMoney(approximateMinorUnits(chipUnits, game.rate));
  const denominations = game.denominations.toSorted((a, b) => a.chipValue - b.chipValue);

  return (
    <div className="grid gap-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chip</TableHead>
            <TableHead className="text-right">In the case</TableHead>
            <TableHead className="text-right">You own</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {denominations.map((denomination) => {
            const left = contents[denomination.id] ?? 0;
            return (
              <TableRow key={denomination.id}>
                <TableCell>
                  <span className="flex items-center gap-2.5">
                    <ChipSwatch
                      hex={chipSwatchColour(denomination.colour)}
                      className="size-6 border-[3px]"
                    />
                    {denomination.colour}{" "}
                    <span className="text-muted-foreground">({money(denomination.chipValue)})</span>
                  </span>
                </TableCell>
                <TableCell className={cn("text-right font-semibold", left === 0 && "text-loss")}>
                  {left}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {denomination.quantity ?? 0}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p>
        The case holds{" "}
        <span className="font-semibold">{money(stackValue(contents, game.denominations))}</span> in
        chips now.
      </p>

      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          Split evenly over {game.seatCount} seats, each seat can take up to{" "}
          {money(stackValue(share, game.denominations))}:
        </p>
        <ChipStackList stack={share} denominations={game.denominations} rate={game.rate} />
      </div>
    </div>
  );
}
