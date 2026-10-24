import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { useSession } from './store/session';
import { router } from './ui/router';
import './ui/theme/tokens.css';

void useSession.getState().restore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
