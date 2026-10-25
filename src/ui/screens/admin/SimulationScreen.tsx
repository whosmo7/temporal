import { ButtonLink, Panel } from '../../kit';
import { ReplayViewer } from '../ReplayScreen';
import { getWatching } from './simReplay';

/**
 * `/admin/simulation` (decision 040): a simulated run in the replay viewer, rebuilt from its seed and
 * action log. Admin-only, in memory only, and marked as simulated so it's never mistaken for a game.
 */
export function SimulationScreen() {
  const replay = getWatching();
  if (!replay) {
    return (
      <Panel title="Nothing to watch" className="gallery-empty">
        <p>Run a simulation or open a trace file on the admin page first. A refresh clears what was loaded.</p>
        <ButtonLink to="/admin" icon="left">
          Admin
        </ButtonLink>
      </Panel>
    );
  }
  return (
    <div className="sim-watch">
      <p className="sim-watch__note" role="note">
        Simulated players (Gemini). Not a real game, and not saved. <ButtonLink to="/admin" size="sm" variant="quiet">Back to admin</ButtonLink>
      </p>
      <ReplayViewer replay={replay} />
    </div>
  );
}
