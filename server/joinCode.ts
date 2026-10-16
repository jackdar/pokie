import { randomInt } from "node:crypto";
import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, joinCodeFromRandom } from "../src/core/joinCode.ts";

export function createJoinCode(): string {
  return joinCodeFromRandom(
    Array.from({ length: JOIN_CODE_LENGTH }, () => randomInt(JOIN_CODE_ALPHABET.length)),
  );
}

/**
 * Makes a code that no game uses yet. Collisions are rare, so a few tries are always enough in
 * practice. The limit stops a loop that never ends if the check is broken.
 */
export function createUniqueJoinCode(isTaken: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = createJoinCode();
    if (!isTaken(code)) return code;
  }
  throw new Error("Cannot make a join code that no other game uses. Try again.");
}
