import { useEffect, useState } from 'react';
import { backend, type CompletedWorld } from '../../api';
import { IslandThumb } from '../gallery/IslandThumb';
import { SORT_LABEL, sortWorlds, type GallerySort } from '../gallery/sortWorlds';
import { Button, ButtonLink, Panel } from '../kit';

const BIOME_NAME: Record<CompletedWorld['biome'], string> = { forest: 'Forest', island: 'Island' };

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; worlds: CompletedWorld[] };

/**
 * Completed worlds, newest first or by score (decision 037), each as a small floating island
 * showing its last generation with a stone for each player. Public: no login needed (decision 017).
 */
export function GalleryScreen() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [sort, setSort] = useState<GallerySort>('recent');

  useEffect(() => {
    let live = true;
    backend
      .listCompletedWorlds()
      .then((worlds) => live && setLoad({ state: 'ready', worlds }))
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
      <div className="gallery__head">
        <h1 id="gallery-title" className="gallery__title">
          Gallery
        </h1>
        <div className="gallery__sort" role="group" aria-label="Sort worlds">
          {(Object.keys(SORT_LABEL) as GallerySort[]).map((s) => (
            <Button key={s} size="sm" variant={s === sort ? 'primary' : 'quiet'} aria-pressed={s === sort} onClick={() => setSort(s)}>
              {SORT_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>
      <ul className="gallery__grid">
        {sortWorlds(load.worlds, sort).map((w) => (
          <li key={w.worldId} className="gallery__item">
            <IslandThumb input={thumbOf(w)} label={`${BIOME_NAME[w.biome]} world after ${w.generationCount} generations`} />
            <Panel tone="paper" className="gallery__card">
              <p className="gallery__meta">
                {BIOME_NAME[w.biome]} · {w.generationCount} generations
              </p>
              {w.score !== null && <p className="gallery__score">Score {w.score}</p>}
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

/** What the thumbnail draws. Memo-stable per world, so the canvas only redraws when the list changes. */
const thumbs = new WeakMap<CompletedWorld, Parameters<typeof IslandThumb>[0]['input']>();
function thumbOf(w: CompletedWorld) {
  let input = thumbs.get(w);
  if (!input) {
    input = {
      seed: w.seed,
      biome: w.biome,
      preset: w.preset,
      state: w.finalState,
      stones: w.players.map((username, i) => ({ turn: i + 1, username })),
    };
    thumbs.set(w, input);
  }
  return input;
}
