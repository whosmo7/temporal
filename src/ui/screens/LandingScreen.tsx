import { ButtonLink } from '../kit';
import { Logo } from '../shell/Logo';

/**
 * Stand-in so `/` uses the shell and kit. The landing task (`08`) replaces it with the floating
 * island and the day-to-night loop from `docs/design/app-shell-brief.md`.
 */
export function LandingScreen() {
  return (
    <div className="landing">
      <h1 className="landing__wordmark">
        <Logo size="landing" />
      </h1>
      <p className="landing__premise">You inherit a world. You leave it to a stranger.</p>
      <div className="landing__actions">
        <ButtonLink to="/play" variant="primary">
          Play
        </ButtonLink>
        <ButtonLink to="/gallery">Gallery</ButtonLink>
      </div>
      {/* Kyrise's icons are CC BY 4.0, so the credit has to be visible in the game (ASSETS.md). */}
      <p className="landing__credits">
        Icons by Kyrise (CC BY 4.0). Art, music and sound from Ninja Adventure by Pixel-Boy &amp; AAA (CC0).
      </p>
    </div>
  );
}
