import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../../store/session';

/** Sends a logged-out visitor to `/auth`, then back here once they're in. */
export function RequireUser({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const { pathname } = useLocation();
  if (status === 'loading') return null;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(pathname)}`} replace />;
  return children;
}
