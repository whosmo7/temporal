import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider} from 'react-router-dom';
import { PlayScreen } from './ui/screens/PlayScreen';

const router = createHashRouter([
    { path: '/', element: <h1>Inheritance</h1>},
    { path: '/play', element: <PlayScreen /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

