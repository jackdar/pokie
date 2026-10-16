import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/api/client.ts";
import { FormError } from "@/components/FormError.tsx";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, normalizeJoinCode } from "@/core/joinCode.ts";

/** Only the characters that codes use, in either case. The input refuses anything else as it is typed. */
const codePattern = `^[${JOIN_CODE_ALPHABET}${JOIN_CODE_ALPHABET.toLowerCase()}]+$`;

const slotClassName = "size-11 text-lg font-semibold";

/** Lets someone at the table type the game code that the host reads out. It joins on the last character. */
export function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const findGame = useMutation({
    mutationFn: api.findGameByCode,
    onSuccess: ({ gameId }) => void navigate({ to: "/games/$gameId", params: { gameId } }),
  });

  function join(typed: string) {
    const joinCode = normalizeJoinCode(typed);
    if (joinCode) findGame.mutate(joinCode);
  }

  return (
    <div className="grid gap-6">
      <h2 className="text-xl font-semibold">Join a game</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="join-code">Game code</Label>
        <InputOTP
          id="join-code"
          maxLength={JOIN_CODE_LENGTH}
          value={code}
          pattern={codePattern}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          disabled={findGame.isPending}
          pasteTransformer={(pasted) => pasted.toUpperCase().replace(/[\s-]/g, "")}
          onChange={(value) => {
            setCode(value.toUpperCase());
            findGame.reset();
          }}
          onComplete={join}
        >
          <InputOTPGroup>
            {[0, 1, 2].map((index) => (
              <InputOTPSlot key={index} index={index} className={slotClassName} />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator className="mx-1 text-muted-foreground" />
          <InputOTPGroup>
            {[3, 4, 5].map((index) => (
              <InputOTPSlot key={index} index={index} className={slotClassName} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      {findGame.isPending && (
        <p role="status" className="text-muted-foreground">
          Finding the game…
        </p>
      )}
      <FormError message={findGame.error?.message} />
    </div>
  );
}
