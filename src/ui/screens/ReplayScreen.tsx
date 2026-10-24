import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { backend, type Replay } from '../../api';
import { ButtonLink, Panel } from '../kit';

type Load = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; replay: Replay };

/**
 * `/world/:id/replay`. Public (decision 017). Loads the replay and holds the route; the viewer
 * itself (snapshot, journal and causes panels, timeline) is B's replay layout task in `06`.
 */
export function ReplayScreen() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    backend
      .getReplay(id)
      .then((replay) => live && setLoad({ state: 'ready', replay }))
      .catch(() => live && setLoad({ state: 'missing' }));
    return () => {
      live = false;
    };
  }, [id]);

  if (load.state === 'loading') return null;

  if (load.state === 'missing') {
    return (
      <Panel title="Nothing here" className="lost">
        <p>This world hasn’t ended, or it doesn’t exist.</p>
        <ButtonLink to="/gallery" icon="left">
          Gallery
        </ButtonLink>
      </Panel>
    );
  }

  const { replay } = load;
  return (
    <Panel title="Everyone who lived here is gone." className="replay-stub">
      <p>
        {replay.journal.length} generations: {replay.journal.map((p) => p.authorUsername).join(', ')}.
      </p>
      <ButtonLink to="/gallery" icon="left">
        Gallery
      </ButtonLink>
    </Panel>
  );
}
