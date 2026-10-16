import { Input } from "@/components/ui/input";
import { MONEY_SYMBOL } from "@/core/money.ts";

type MoneyInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
};

export function MoneyInput({ id, value, onChange, ...rest }: MoneyInputProps) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground"
      >
        {MONEY_SYMBOL}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="pl-7"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
    </div>
  );
}
