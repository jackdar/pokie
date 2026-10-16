/**
 * Letters and digits that people do not mix up when they read a code aloud or type it.
 * There is no 0 or O, no 1, I, or L, and no U or V.
 */
export const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ";

export const JOIN_CODE_LENGTH = 6;

/** Reads a code that a person typed. Returns undefined when it cannot be a join code. */
export function normalizeJoinCode(input: string): string | undefined {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== JOIN_CODE_LENGTH) return undefined;
  for (const character of code) {
    if (!JOIN_CODE_ALPHABET.includes(character)) return undefined;
  }
  return code;
}

/** Makes a code from random numbers. Each number must be a whole number from 0 up to the alphabet length. */
export function joinCodeFromRandom(randomIndexes: number[]): string {
  return randomIndexes
    .slice(0, JOIN_CODE_LENGTH)
    .map((index) => JOIN_CODE_ALPHABET[index] ?? "")
    .join("");
}
