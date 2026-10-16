import { describe, expect, it } from "vitest";
import { bearerToken, createToken, hashToken, tokenMatchesHash } from "../../server/auth.ts";

describe("createToken", () => {
  it("makes a different URL-safe token each time", () => {
    const first = createToken();
    const second = createToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("tokenMatchesHash", () => {
  it("matches a token against its own hash", () => {
    const token = createToken();
    expect(tokenMatchesHash(token, hashToken(token))).toBe(true);
  });

  it("does not match a different token", () => {
    expect(tokenMatchesHash(createToken(), hashToken(createToken()))).toBe(false);
  });

  it("does not match a malformed hash", () => {
    expect(tokenMatchesHash(createToken(), "not-a-hash")).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads the token from a Bearer header", () => {
    expect(bearerToken("Bearer abc123")).toBe("abc123");
  });

  it("ignores other schemes and a missing header", () => {
    expect(bearerToken("Basic abc123")).toBeUndefined();
    expect(bearerToken(undefined)).toBeUndefined();
  });
});
