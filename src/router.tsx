import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { GameScreen } from "@/routes/GameScreen.tsx";
import { GamesScreen } from "@/routes/GamesScreen.tsx";
import { HomeScreen } from "@/routes/HomeScreen.tsx";

const rootRoute = createRootRoute({
  component: () => (
    <div className="mx-auto max-w-2xl px-4 pt-5 pb-16">
      <Outlet />
    </div>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScreen,
});

const gamesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/games",
  component: GamesScreen,
});

export const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/games/$gameId",
  // A host link carries the host token, so the host can open the game on another device.
  validateSearch: (search: Record<string, unknown>): { host?: string } =>
    typeof search.host === "string" ? { host: search.host } : {},
  component: GameScreen,
});

const routeTree = rootRoute.addChildren([homeRoute, gamesRoute, gameRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
