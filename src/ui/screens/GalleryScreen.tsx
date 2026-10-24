import { useEffect, useState } from 'react';
import { backend, type CompletedWorld } from '../../api';
import { ButtonLink, Panel } from '../kit';

const BIOME_NAME: Record<CompletedWorld['biome'], string> = { forest: 'Forest', island: 'Island' };

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; worlds: CompletedWorld[] };

/**
 * Completed worlds, newest first. Public: no login needed (decision 016). The floating-island
 * thumbnails come with the gallery grid task (`06`); until then each card is text only.
 */
export function GalleryScreen() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    backend
      .listCompletedWorlds()
      .then((worlds) => {
        const newest = [...worlds].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
        if (live) setLoad({ state: 'ready', worlds: newest });
      })
      .catch(() => live && setLoad({ state: 'error' }));
    return () => {
      live = false;
    };
  }, []);

  if (load.state === 'loading') return null;

  if (load.state === 'error') {
    return (
      <Panel title="Gallery" className="gallery-empty">
        <p>The gallery couldn’t be reached. Try again in a moment.</p>
      </Panel>
    );
  }

  if (load.worlds.length === 0) {
    return (
      <Panel title="Gallery" className="gallery-empty">
        <p>No world has reached its last generation yet.</p>
        <ButtonLink to="/play" variant="primary">
          Play
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <section className="gallery" aria-labelledby="gallery-title">
      <h1 id="gallery-title" className="gallery__title">
        Gallery
      </h1>
      <ul className="gallery__grid">
        {load.worlds.map((w) => (
          <li key={w.worldId}>
            <Panel tone="paper" className="gallery__card">
              <p className="gallery__meta">
                {BIOME_NAME[w.biome]} · {w.generationCount} generations
              </p>
              <p className="gallery__players">{w.players.join(', ')}</p>
              <ButtonLink to={`/world/${w.worldId}/replay`} size="sm">
                Watch
              </ButtonLink>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  );
}
