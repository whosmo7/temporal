import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../store/session';
import { Button, ButtonLink } from '../kit';
import { Logo } from './Logo';
import { MuteToggle } from './MuteToggle';
import { SkyBackdrop } from './SkyBackdrop';
import './shell.css';

/**
 * Layout for every screen except the game itself: the sky, a small header, and the screen.
 * The landing page carries its own large wordmark, so the header's wordmark hides there.
 * The right side holds the username and log out once signed in, then the mute toggle.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, status, signOut } = useSession();
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
          {user && (
            <>
              <span className="shell__user">{user.username}</span>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => void signOut().then(() => navigate('/'))}
              >
                Log out
              </Button>
            </>
          )}
          {!user && status === 'ready' && pathname !== '/auth' && (
            <ButtonLink to="/auth" variant="quiet" size="sm">
              Log in
            </ButtonLink>
          )}
          <MuteToggle />
        </div>
      </header>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
