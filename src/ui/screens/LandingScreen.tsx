import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonLink } from '../kit';
import { IslandScene } from '../shell/IslandScene';
import { CloudBank, DistantIslands } from '../shell/LandingScenery';
import { Logo } from '../shell/Logo';

/**
 * The landing (`08`, app-shell brief): the wordmark, the floating island living through a
 * generation, one premise line, then Play and Gallery. Enter is Play.
 */
export function LandingScreen() {
  const light = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Only from the page itself, so Enter on a focused button or link keeps its own meaning.
      if (e.key === 'Enter' && (e.target === document.body || e.target === document.documentElement)) {
        navigate('/play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="landing">
      <div ref={light} className="landing__light" aria-hidden />
      {/* Back to front: far islands, the island, the cloud bank, then the words. */}
      <DistantIslands />
      <h1 className="landing__wordmark">
        <Logo size="landing" />
      </h1>
      <IslandScene lightRef={light} />
      <CloudBank />
      <p className="landing__premise">You inherit a world. You leave it to a stranger.</p>
      <div className="landing__actions">
        <ButtonLink to="/play" variant="primary">
          Play
        </ButtonLink>
        <ButtonLink to="/gallery">Gallery</ButtonLink>
        <ButtonLink to="/tutorial" variant="quiet">
          How to play
        </ButtonLink>
      </div>
      {/* Kyrise's icons are CC BY 4.0, so the credit has to be visible in the game (ASSETS.md). */}
      <p className="landing__credits">
        Icons by Kyrise (CC BY 4.0). Art, music and sound from Ninja Adventure by Pixel-Boy &amp; AAA (CC0).
      </p>
    </div>
  );
}
