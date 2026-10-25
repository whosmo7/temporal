import { useEffect, useState } from 'react';
import { snapshot } from '../../render/snapshot';
import { TILE } from '../../render/constants';
import { InteractPrompt } from '../hud/InteractPrompt';
import { Button, Dialog } from '../kit';
import { HOW_TO_PLAY } from './copy';
import { SHOT_TILES, tutorialMap, tutorialScenes, type Scene } from './scenes';
import './how-to-play.css';

/** Art pixels per tile in the pictures: whole pixels, scaled up by the page. */
const SHOT_ZOOM = 3;
const SHOT_SIZE = { w: SHOT_TILES.w * TILE * SHOT_ZOOM, h: SHOT_TILES.h * TILE * SHOT_ZOOM };

// Drawn once per page load, one at a time, the first time the pop-up opens.
let shots: Promise<{ scenes: Scene[]; images: string[] }> | null = null;
function loadShots() {
  shots ??= (async () => {
    const map = tutorialMap();
    const scenes = tutorialScenes(map);
    const images: string[] = [];
    for (const s of scenes) images.push(await snapshot(map, s.look, s.still, SHOT_SIZE));
    return { scenes, images };
  })().catch((e: unknown) => {
    shots = null; // try again next time it opens
    throw e;
  });
  return shots;
}

/**
 * "How to play" (08): four pictures from a fixed tutorial world, each with the prompt you'd see
 * there and a line on what to do. Sow and water, fill the can, harvest, eat.
 */
export function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [scenes] = useState(() => tutorialScenes());
  const [images, setImages] = useState<string[] | null>(null);
  useEffect(() => {
    if (!open || images) return;
    let live = true;
    loadShots().then(
      (r) => live && setImages(r.images),
      () => {}, // the pictures stay blank; the words still say what to do
    );
    return () => {
      live = false;
    };
  }, [open, images]);

  return (
    <Dialog
      open={open}
      title={HOW_TO_PLAY.title}
      onClose={onClose}
      actions={
        <>
          <p className="how-to-play__move">{HOW_TO_PLAY.move}</p>
          <Button variant="primary" onClick={onClose} autoFocus>
            {HOW_TO_PLAY.close}
          </Button>
        </>
      }
    >
      <div className="how-to-play">
        <ol className="how-to-play__grid">
          {scenes.map((s, i) => (
            <li key={s.key} className="how-to-play__card">
              <div className="how-to-play__shot" style={{ aspectRatio: `${SHOT_SIZE.w} / ${SHOT_SIZE.h}` }}>
                {images?.[i] && <img src={images[i]} alt="" width={SHOT_SIZE.w} height={SHOT_SIZE.h} />}
                <div className="how-to-play__prompt" aria-hidden>
                  <InteractPrompt rows={[s.prompt]} />
                </div>
              </div>
              <h3 className="how-to-play__title">
                {i + 1}. {s.title}
              </h3>
              <p className="how-to-play__text">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </Dialog>
  );
}
