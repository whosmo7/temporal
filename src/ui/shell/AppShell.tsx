import { Link, Outlet, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { MuteToggle } from './MuteToggle';
import { SkyBackdrop } from './SkyBackdrop';
import './shell.css';

/**
 * Layout for every screen except the game itself: the sky, a small header, and the screen.
 * The landing page carries its own large wordmark, so the header's wordmark hides there.
 * The right side holds the mute toggle; the username and log out join it with the auth task (`08`).
 */
export function AppShell() {
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  return (
    <div className="shell">
      <SkyBackdrop />
      <header className="shell__header">
        {!isLanding && (
          <Link to="/" className="shell__wordmark">
            <Logo />
          </Link>
        )}
        <div className="shell__controls">
          <MuteToggle />
        </div>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
