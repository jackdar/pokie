import type { ChipCount, ChipDenomination } from "../core/chips.ts";
import type {
  BuyIn,
  Game,
  GameStatus,
  Player,
  SettlementMode,
  TableColour,
  Withdrawal,
} from "../core/game.ts";
import type { MinorUnits } from "../core/money.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** The host token or a player token. */
  token?: string | undefined;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("Cannot reach the Pokie server. Check your connection.", 0, undefined);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `The server answered with status ${response.status}.`;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

export type NewGame = {
  name: string;
  denominations: Omit<ChipDenomination, "id">[];
  seatCount: number;
  settlement: SettlementMode;
};

export type GameUpdate = Partial<{
  name: string;
  seatCount: number;
  tableColour: TableColour;
  settlement: SettlementMode;
  status: GameStatus;
}>;

export const api = {
  createGame: (game: NewGame) =>
    request<{ game: Game; hostToken: string }>("/games", { method: "POST", body: game }),

  getGame: (gameId: string) => request<{ game: Game }>(`/games/${gameId}`),

  updateGame: (gameId: string, hostToken: string, update: GameUpdate) =>
    request<{ game: Game }>(`/games/${gameId}`, {
      method: "PATCH",
      token: hostToken,
      body: update,
    }),

  /** Without a host token the caller seats themselves and gets a player token back. */
  addPlayer: (
    gameId: string,
    hostToken: string | undefined,
    player: { name: string; seat: number; buyInMinor?: MinorUnits },
  ) =>
    request<{ game: Game; player: Player; playerToken?: string }>(`/games/${gameId}/players`, {
      method: "POST",
      token: hostToken,
      body: player,
    }),

  addBuyIn: (
    gameId: string,
    hostToken: string,
    buyIn: { playerId: string; amountMinor: MinorUnits },
  ) =>
    request<{ game: Game; buyIn: BuyIn }>(`/games/${gameId}/buy-ins`, {
      method: "POST",
      token: hostToken,
      body: buyIn,
    }),

  removeBuyIn: (gameId: string, hostToken: string, buyInId: string) =>
    request<{ game: Game }>(`/games/${gameId}/buy-ins/${buyInId}`, {
      method: "DELETE",
      token: hostToken,
    }),

  addWithdrawal: (
    gameId: string,
    hostToken: string,
    withdrawal: { playerId: string; chipUnits: number; leavesTable: boolean },
  ) =>
    request<{ game: Game; withdrawal: Withdrawal }>(`/games/${gameId}/withdrawals`, {
      method: "POST",
      token: hostToken,
      body: withdrawal,
    }),

  removeWithdrawal: (gameId: string, hostToken: string, withdrawalId: string) =>
    request<{ game: Game }>(`/games/${gameId}/withdrawals/${withdrawalId}`, {
      method: "DELETE",
      token: hostToken,
    }),

  /** The token is the host token, or the player token of the player who is counted. */
  saveFinalCount: (gameId: string, token: string, playerId: string, count: ChipCount) =>
    request<{ game: Game }>(`/games/${gameId}/counts/${playerId}`, {
      method: "PUT",
      token,
      body: { count },
    }),
};
