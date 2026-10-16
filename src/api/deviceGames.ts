/** Games this device hosts or plays in. The tokens in here are what give this device its rights. */

export type HostedGame = { gameId: string; name: string; hostToken: string; createdAt: string };

export type JoinedGame = { gameId: string; playerId: string; playerToken: string };

const hostedKey = "pokie.hostTokens";
const joinedKey = "pokie.playerTokens";

// Storage can be missing or blocked, for example in a private window. The app still works for the current page.
function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    console.warn("Cannot save the game token on this device. Keep the game link to come back.");
  }
}

export function hostedGames(): HostedGame[] {
  return readList<HostedGame>(hostedKey).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hostTokenFor(gameId: string): string | undefined {
  return readList<HostedGame>(hostedKey).find((game) => game.gameId === gameId)?.hostToken;
}

export function rememberHostedGame(game: HostedGame): void {
  const others = readList<HostedGame>(hostedKey).filter((g) => g.gameId !== game.gameId);
  writeList(hostedKey, [...others, game]);
}

export function joinedGameFor(gameId: string): JoinedGame | undefined {
  return readList<JoinedGame>(joinedKey).find((game) => game.gameId === gameId);
}

export function rememberJoinedGame(game: JoinedGame): void {
  const others = readList<JoinedGame>(joinedKey).filter((g) => g.gameId !== game.gameId);
  writeList(joinedKey, [...others, game]);
}
