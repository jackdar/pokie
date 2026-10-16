import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type NewGame } from "@/api/client.ts";
import { rememberHostedGame } from "@/api/deviceGames.ts";
import { ChipColourPicker } from "@/components/ChipColourPicker.tsx";
import { ChipStackList } from "@/components/ChipStackList.tsx";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { FormError } from "@/components/FormError.tsx";
import { HostedGames } from "@/components/HostedGames.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fairShare, ownedChips, stackValue } from "@/core/chipCase.ts";
import type { ChipDenomination } from "@/core/chips.ts";
import { formatMoney, parseMoneyInput } from "@/core/money.ts";
import { DEFAULT_SEATS, MAX_SEATS, MIN_SEATS } from "@/core/table.ts";
import { unusedChipColours } from "@/ui/chipColours.ts";
import { parseQuantity } from "@/ui/chipQuantities.ts";

/** One chip in the form. "quantity" is how many the host has in the chip case. */
type ChipRow = { key: number; colour: string; value: string; quantity: string };

const defaultChips: ChipRow[] = [
  { key: 1, colour: "White", value: "0.25", quantity: "" },
  { key: 2, colour: "Red", value: "1.00", quantity: "" },
  { key: 3, colour: "Green", value: "5.00", quantity: "" },
  { key: 4, colour: "Black", value: "25.00", quantity: "" },
];

/** The chips as denominations, or an error message. Quantities are all filled in or all empty. */
function denominationsFromRows(rows: ChipRow[]): Omit<ChipDenomination, "id">[] | string {
  const withQuantity = rows.filter((row) => row.quantity.trim() !== "");
  if (withQuantity.length > 0 && withQuantity.length < rows.length) {
    return "Enter how many you have of every chip, or leave them all empty.";
  }
  const denominations: Omit<ChipDenomination, "id">[] = [];
  for (const row of rows) {
    const chipValue = parseMoneyInput(row.value);
    if (!chipValue) return `Enter a value for the ${row.colour} chip, for example 1.00.`;
    if (withQuantity.length === 0) {
      denominations.push({ colour: row.colour, chipValue });
      continue;
    }
    const quantity = parseQuantity(row.quantity);
    if (quantity === undefined) {
      return `Enter how many ${row.colour} chips you have as a whole number.`;
    }
    denominations.push({ colour: row.colour, chipValue, quantity });
  }
  return denominations;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [chips, setChips] = useState(defaultChips);
  const [seatCount, setSeatCount] = useState(DEFAULT_SEATS);
  const [minBuyIn, setMinBuyIn] = useState("");
  const [maxBuyIn, setMaxBuyIn] = useState("");
  const [settleMode, setSettleMode] = useState<"direct" | "escrow">("direct");
  const [holderName, setHolderName] = useState("");
  const [formError, setFormError] = useState<string>();

  const createGame = useMutation({
    mutationFn: api.createGame,
    onSuccess: ({ game, hostToken }) => {
      rememberHostedGame({
        gameId: game.id,
        name: game.name,
        hostToken,
        createdAt: new Date().toISOString(),
      });
      void navigate({ to: "/games/$gameId", params: { gameId: game.id } });
    },
  });

  function buildGame(): NewGame | string {
    const trimmedName = name.trim();
    if (!trimmedName) return "Enter a name for the game.";

    const denominations = denominationsFromRows(chips);
    if (typeof denominations === "string") return denominations;

    const minBuyInMinor = minBuyIn.trim() === "" ? undefined : parseMoneyInput(minBuyIn);
    const maxBuyInMinor = maxBuyIn.trim() === "" ? undefined : parseMoneyInput(maxBuyIn);
    if (minBuyIn.trim() !== "" && !minBuyInMinor) {
      return "Enter the table minimum as an amount, for example 20.00, or leave it empty.";
    }
    if (maxBuyIn.trim() !== "" && !maxBuyInMinor) {
      return "Enter the table maximum as an amount, for example 50.00, or leave it empty.";
    }
    if (minBuyInMinor && maxBuyInMinor && minBuyInMinor > maxBuyInMinor) {
      return "The table minimum cannot be more than the table maximum.";
    }

    if (settleMode === "escrow" && !holderName.trim()) {
      return "Enter the name of the person who collects and pays out.";
    }

    return {
      name: trimmedName,
      denominations,
      seatCount,
      ...(minBuyInMinor ? { minBuyInMinor } : {}),
      ...(maxBuyInMinor ? { maxBuyInMinor } : {}),
      settlement:
        settleMode === "direct"
          ? { mode: "direct" }
          : { mode: "escrow", holder: { kind: "external", name: holderName.trim() } },
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const game = buildGame();
    if (typeof game === "string") return setFormError(game);
    setFormError(undefined);
    createGame.mutate(game);
  }

  function updateChip(key: number, change: Partial<ChipRow>) {
    setChips((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  const unusedColours = unusedChipColours(chips.map((chip) => chip.colour));
  const draftDenominations = denominationsFromRows(chips);
  const draftCase =
    typeof draftDenominations === "object" &&
    draftDenominations.every((d) => d.quantity !== undefined)
      ? draftDenominations.map((d, index) => ({ ...d, id: String(index) }))
      : undefined;

  return (
    <>
      <header className="mb-8 grid gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-4xl font-bold">Pokie</h1>
          <Link to="/games" className="text-primary underline-offset-4 hover:underline">
            Your games
          </Link>
        </div>
        <p className="text-muted-foreground">
          Track buy-ins at the table, then settle up at the end of the night.
        </p>
      </header>

      <form className="grid gap-6" onSubmit={submit} noValidate>
        <h2 className="text-xl font-semibold">New game</h2>

        <div className="grid gap-1.5">
          <Label htmlFor="game-name">Game name</Label>
          <Input
            id="game-name"
            value={name}
            maxLength={80}
            placeholder="Friday Pokie Night"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">Chip case</legend>
          <p className="text-sm text-muted-foreground">
            Give each chip a value. Enter how many of each you have, and the app splits the case
            between the seats and tells you which chips to hand out for each buy-in.
          </p>
          <div
            aria-hidden="true"
            className="grid grid-cols-[2.5rem_1fr_6rem_4.5rem_2.25rem] gap-2 text-xs text-muted-foreground"
          >
            <span />
            <span />
            <span>Value</span>
            <span>How many</span>
          </div>
          {chips.map((chip) => (
            <div
              key={chip.key}
              className="grid grid-cols-[2.5rem_1fr_6rem_4.5rem_2.25rem] items-center gap-2"
            >
              <ChipColourPicker
                colour={chip.colour}
                takenColours={chips.filter((row) => row.key !== chip.key).map((row) => row.colour)}
                onChange={(colour) => updateChip(chip.key, { colour })}
              />
              <span>{chip.colour}</span>
              <MoneyInput
                id={`chip-value-${chip.key}`}
                aria-label={`Value of ${chip.colour} chip`}
                value={chip.value}
                placeholder="0.00"
                onChange={(value) => updateChip(chip.key, { value })}
              />
              <Input
                aria-label={`How many ${chip.colour} chips you have`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="–"
                value={chip.quantity}
                onChange={(event) => updateChip(chip.key, { quantity: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${chip.colour} chip`}
                disabled={chips.length === 1}
                onClick={() => setChips((rows) => rows.filter((row) => row.key !== chip.key))}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          {unusedColours.length > 0 && (
            <div className="mt-2 grid gap-2">
              <p className="text-sm text-muted-foreground">Add a chip</p>
              <div className="flex flex-wrap gap-2">
                {unusedColours.map((colour) => (
                  <button
                    key={colour.name}
                    type="button"
                    aria-label={`Add ${colour.name} chip`}
                    title={colour.name}
                    className="flex aspect-square items-center justify-center rounded-full p-0.5 transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none motion-reduce:transition-none"
                    onClick={() =>
                      setChips((rows) => [
                        ...rows,
                        {
                          key: Math.max(0, ...rows.map((row) => row.key)) + 1,
                          colour: colour.name,
                          value: "",
                          quantity: "",
                        },
                      ])
                    }
                  >
                    <ChipSwatch hex={colour.hex} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {draftCase && (
            <div className="mt-2 grid gap-2 rounded-lg border p-3">
              <p className="text-sm">
                Split over {seatCount} seats, each seat can take up to{" "}
                <span className="font-semibold">
                  {formatMoney(
                    stackValue(fairShare(ownedChips(draftCase), draftCase, seatCount), draftCase),
                  )}
                </span>
                :
              </p>
              <ChipStackList
                stack={fairShare(ownedChips(draftCase), draftCase, seatCount)}
                denominations={draftCase}
                rate={{ minorUnits: 1, chipUnits: 1 }}
              />
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-2">
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
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">Table limits</legend>
          <p className="text-sm text-muted-foreground">
            After any buy-in, a player's stack must be between these amounts. Leave them empty for
            no limit.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="min-buy-in">Minimum</Label>
              <MoneyInput
                id="min-buy-in"
                value={minBuyIn}
                placeholder="No minimum"
                onChange={setMinBuyIn}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-buy-in">Maximum</Label>
              <MoneyInput
                id="max-buy-in"
                value={maxBuyIn}
                placeholder="No maximum"
                onChange={setMaxBuyIn}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium">Settle up</legend>
          <RadioGroup
            value={settleMode}
            onValueChange={(value) => setSettleMode(value === "escrow" ? "escrow" : "direct")}
          >
            <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
              <RadioGroupItem value="direct" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="font-medium">Players pay each other</span>
                <span className="text-muted-foreground">
                  The app lists the fewest payments that settle everyone.
                </span>
              </span>
            </Label>
            <Label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary">
              <RadioGroupItem value="escrow" className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="font-medium">One person collects and pays out</span>
                <span className="text-muted-foreground">
                  Losers pay this person. This person pays the winners.
                </span>
              </span>
            </Label>
          </RadioGroup>
          {settleMode === "escrow" && (
            <div className="grid gap-1.5">
              <Label htmlFor="holder-name">Who collects</Label>
              <Input
                id="holder-name"
                value={holderName}
                maxLength={80}
                onChange={(event) => setHolderName(event.target.value)}
              />
            </div>
          )}
        </fieldset>

        <FormError message={formError ?? createGame.error?.message} />
        <div>
          <Button type="submit" size="lg" disabled={createGame.isPending}>
            Start game
          </Button>
        </div>
      </form>

      <div className="mt-12">
        <HostedGames />
      </div>
    </>
  );
}
