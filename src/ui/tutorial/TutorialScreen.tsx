import { useNavigate } from 'react-router-dom';
import { HowToPlay } from './HowToPlay';
import { seenHowToPlay } from './seen';

/** `/#/tutorial` (08): "How to play" on its own, over the sky. Closing it goes back home. */
export function TutorialScreen() {
  const navigate = useNavigate();
  return (
    <HowToPlay
      open
      onClose={() => {
        seenHowToPlay.set();
        void navigate('/');
      }}
    />
  );
}
