import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  joinCodeFromRandom,
  normalizeJoinCode,
} from "../../src/core/joinCode.ts";

describe("normalizeJoinCode", () => {
  it("accepts lower case, spaces, and dashes", () => {
    expect(normalizeJoinCode(" k7q-m4p ")).toBe("K7QM4P");
  });

  it("rejects a code of the wrong length", () => {
    expect(normalizeJoinCode("K7QM4")).toBeUndefined();
  });

  it("rejects characters that codes never use", () => {
    expect(normalizeJoinCode("K7QM40")).toBeUndefined();
    expect(normalizeJoinCode("K7QM4I")).toBeUndefined();
  });
});

describe("JOIN_CODE_ALPHABET", () => {
  it("leaves out characters that people mix up", () => {
    for (const character of "01OILUV") {
      expect(JOIN_CODE_ALPHABET).not.toContain(character);
    }
  });
});

describe("joinCodeFromRandom", () => {
  it("turns random numbers into a six character code", () => {
    expect(joinCodeFromRandom([0, 1, 2, 3, 4, 5])).toBe("234567");
  });
});
