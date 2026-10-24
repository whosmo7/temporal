import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../store/session';
import { NotFoundScreen } from '../screens/NotFoundScreen';

/**
 * `/admin` only for `profiles.is_admin`. Logged out goes to `/auth` and back; anyone else sees the
 * not-found page, so the route doesn't announce itself. The backend checks again on every call.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const { pathname } = useLocation();
  if (status === 'loading') return null;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(pathname)}`} replace />;
  if (!user.isAdmin) return <NotFoundScreen />;
  return children;
}
