import { cn } from "@/lib/utils";
import { approximateMinorUnits } from "@/core/chips.ts";
import type { Game, Player } from "@/core/game.ts";
import { playerTotals, poolSummary } from "@/core/ledger.ts";
import { formatMoney } from "@/core/money.ts";
import { playerAtSeat } from "@/core/table.ts";
import { seatPositions, type TableShape } from "@/ui/seatLayout.ts";

/** Keep in step with the aspect-ratio and border-radius of .poker-table in styles.css. */
const tableShape: TableShape = { width: 100, height: 140, cornerRadius: 28 };

type PokerTableProps = {
  game: Game;
  /** Seats that this device may tap. Other seats show as plain discs. */
  canSelectSeat: (seat: number, player: Player | undefined) => boolean;
  onSeatSelect: (seat: number) => void;
  /** The player who uses this device, if they joined the game. */
  ownPlayerId?: string | undefined;
};

/** Before counting, a seat shows what the player bought in. From counting on, it shows the count. */
function seatDetail(game: Game, playerId: string): { text: string; needsCount: boolean } {
  const totals = playerTotals(game, playerId);
  if (game.status === "open") {
    return { text: formatMoney(totals.paidInMinor), needsCount: false };
  }
  if (totals.countedChipUnits === undefined) {
    return { text: "Not counted", needsCount: totals.paidInMinor > 0 };
  }
  return {
    text: formatMoney(approximateMinorUnits(totals.countedChipUnits, game.rate)),
    needsCount: false,
  };
}

export function PokerTable({ game, canSelectSeat, onSeatSelect, ownPlayerId }: PokerTableProps) {
  const pool = poolSummary(game);
  const positions = seatPositions(game.seatCount, tableShape);
  const onTableMinor = approximateMinorUnits(pool.chipUnitsInPlay, game.rate);

  return (
    <div className="mx-auto max-w-[26rem] p-9">
      <div className="poker-table">
        <div className="felt grid place-content-center gap-1 p-4 text-center">
          <p className="text-[clamp(1.75rem,9vw,2.6rem)] leading-none font-bold tracking-wide text-foreground/85 [font-stretch:75%]">
            {formatMoney(pool.paidInMinor)}
          </p>
          <p className="text-[0.8125rem] text-foreground/60">bought in</p>
          {pool.withdrawnChipUnits > 0 && (
            <p className="text-[0.8125rem] text-foreground/60">
              {formatMoney(onTableMinor)} still on the table
            </p>
          )}
        </div>

        {positions.map((position, seat) => {
          const player = playerAtSeat(game, seat);
          const detail = player ? seatDetail(game, player.id) : undefined;
          const seatNumber = seat + 1;
          const isOwnSeat = player !== undefined && player.id === ownPlayerId;
          const className = cn(
            "seat grid size-[4.5rem] place-content-center rounded-full border-2 p-1.5 text-center leading-tight",
            player
              ? "border-rail bg-secondary"
              : "border-dashed border-rail-light bg-background/85",
            detail?.needsCount && "border-primary",
            isOwnSeat && "ring-3 ring-primary ring-offset-2 ring-offset-rail",
          );
          const style = { left: `${position.x}%`, top: `${position.y}%` };
          const content = player ? (
            <>
              <span className="max-w-[3.6rem] truncate text-[0.9375rem] font-semibold [font-stretch:75%]">
                {isOwnSeat ? "You" : player.name}
              </span>
              <span
                className={cn(
                  "text-xs",
                  detail?.needsCount ? "text-primary" : "text-muted-foreground",
                )}
              >
                {detail?.text}
              </span>
            </>
          ) : (
            <span className="text-[0.9375rem] text-muted-foreground [font-stretch:75%]">
              Seat {seatNumber}
            </span>
          );
          const label = player
            ? `Seat ${seatNumber}, ${isOwnSeat ? "you" : player.name}, ${detail?.text}`
            : `Seat ${seatNumber}, empty`;

          if (!canSelectSeat(seat, player)) {
            return (
              <div key={seat} className={className} style={style} aria-label={label}>
                {content}
              </div>
            );
          }
          return (
            <button
              key={seat}
              type="button"
              className={cn(
                className,
                "cursor-pointer transition-colors hover:border-primary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
              )}
              style={style}
              aria-label={player ? label : `${label}. Choose this seat`}
              onClick={() => onSeatSelect(seat)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
