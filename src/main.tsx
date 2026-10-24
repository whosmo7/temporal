import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider} from 'react-router-dom';
import { PlayScreen } from './ui/screens/PlayScreen';
import { SpriteSheet } from './ui/screens/dev/SpriteSheet';

const router = createHashRouter([
    { path: '/', element: <h1>Inheritance</h1>},
    { path: '/play', element: <PlayScreen /> },
    { path: '/dev/sprites', element: <SpriteSheet /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

