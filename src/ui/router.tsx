import { createHashRouter, type RouteObject } from 'react-router-dom';
import { AdminScreen } from './screens/AdminScreen';
import { AuthScreen } from './screens/AuthScreen';
import { GalleryScreen } from './screens/GalleryScreen';
import { LandingScreen } from './screens/LandingScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { PlayScreen } from './screens/PlayScreen';
import { ReplayScreen } from './screens/ReplayScreen';
import { AppShell } from './shell/AppShell';
import { RequireAdmin } from './shell/RequireAdmin';
import { RequireUser } from './shell/RequireUser';

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
 * full-screen. Play needs a signed-in player; the gallery and replays are public (decision 017).
 * `/admin` needs an admin. Later screens slot in here: `tutorial`.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    // Lazy dev routes load after the first paint; the sky is enough to show meanwhile.
    HydrateFallback: () => null,
    children: [
      { index: true, element: <LandingScreen /> },
      { path: 'auth', element: <AuthScreen /> },
      { path: 'gallery', element: <GalleryScreen /> },
      { path: 'world/:id/replay', element: <ReplayScreen /> },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminScreen />
          </RequireAdmin>
        ),
      },
      ...devRoutes,
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
  {
    path: '/play',
    element: (
      <RequireUser>
        <PlayScreen />
      </RequireUser>
    ),
  },
  ...devFullscreenRoutes,
]);
