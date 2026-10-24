import { ButtonLink } from '../kit';

/**
 * Stand-in so `/` uses the shell and kit. The landing task (`08`) replaces it with the floating
 * island and the day-to-night loop from `docs/design/app-shell-brief.md`.
 */
export function LandingScreen() {
  return (
    <div className="landing">
      <h1 className="landing__wordmark">INHERITANCE</h1>
      <p className="landing__premise">You inherit a world. You leave it to a stranger.</p>
      <div className="landing__actions">
        <ButtonLink to="/play" variant="primary">
          Play
        </ButtonLink>
      </div>
    </div>
  );
}
