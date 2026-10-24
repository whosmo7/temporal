import { createHashRouter, type RouteObject } from 'react-router-dom';
import { LandingScreen } from './screens/LandingScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { PlayScreen } from './screens/PlayScreen';
import { AppShell } from './shell/AppShell';

// Component sheets for building and review. Left out of production builds.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/kit',
        lazy: () => import('./dev/KitScreen').then((m) => ({ Component: m.KitScreen })),
      },
      {
        path: 'dev/journal',
        lazy: () => import('./dev/JournalScreen').then((m) => ({ Component: m.JournalScreen })),
      },
    ]
  : [];

// Full-screen dev tools (B): the worldgen debug page and the sprite sheet. Also dev builds only.
const devFullscreenRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/dev/worldgen',
        lazy: () => import('./dev/WorldgenScreen').then((m) => ({ Component: m.WorldgenScreen })),
      },
      {
        path: '/dev/sprites',
        lazy: () => import('./dev/SpriteSheet').then((m) => ({ Component: m.SpriteSheet })),
      },
    ]
  : [];

/**
 * Hash routes (GitHub Pages). Everything but the game sits in the shell's sky; the game is
 * full-screen. Later screens slot in here: `auth`, `tutorial`, `gallery`, `world/:id/replay`, `admin`.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    // Lazy dev routes load after the first paint; the sky is enough to show meanwhile.
    HydrateFallback: () => null,
    children: [
      { index: true, element: <LandingScreen /> },
      ...devRoutes,
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
  { path: '/play', element: <PlayScreen /> },
  ...devFullscreenRoutes,
]);
