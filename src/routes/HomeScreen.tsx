import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, type NewGame } from "@/api/client.ts";
import { rememberHostedGame } from "@/api/deviceGames.ts";
import { ChipColourPicker } from "@/components/ChipColourPicker.tsx";
import { ChipSwatch } from "@/components/ChipSwatch.tsx";
import { FormError } from "@/components/FormError.tsx";
import { HostedGames } from "@/components/HostedGames.tsx";
import { MoneyInput } from "@/components/MoneyInput.tsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseMoneyInput } from "@/core/money.ts";
import { DEFAULT_SEATS, MAX_SEATS, MIN_SEATS } from "@/core/table.ts";
import { unusedChipColours } from "@/ui/chipColours.ts";

type ChipRow = { key: number; colour: string; value: string };

const defaultChips: ChipRow[] = [
  { key: 1, colour: "White", value: "0.25" },
  { key: 2, colour: "Red", value: "1.00" },
  { key: 3, colour: "Green", value: "5.00" },
  { key: 4, colour: "Black", value: "25.00" },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [chips, setChips] = useState(defaultChips);
  const [seatCount, setSeatCount] = useState(DEFAULT_SEATS);
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

    const denominations = [];
    for (const chip of chips) {
      const chipValue = parseMoneyInput(chip.value);
      if (!chipValue) return `Enter a value for the ${chip.colour} chip, for example 1.00.`;
      denominations.push({ colour: chip.colour, chipValue });
    }

    if (settleMode === "escrow" && !holderName.trim()) {
      return "Enter the name of the person who collects and pays out.";
    }

    return {
      name: trimmedName,
      denominations,
      seatCount,
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
          <legend className="mb-1.5 text-sm font-medium">Chip values</legend>
          {chips.map((chip) => (
            <div key={chip.key} className="grid grid-cols-[auto_1fr_7rem_auto] items-center gap-3">
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
