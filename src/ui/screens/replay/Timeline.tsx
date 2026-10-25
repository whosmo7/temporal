import { Button } from '../../kit';
import { PACE_LABEL, PACES, shortName, type Pace } from './words';

/**
 * Under the generation view (06): one dot per generation with its player's name, the current one
 * marked, click to jump; previous and next beside it; Play/Pause, the pace, and ghosts on or off
 * (decision 038).
 */
export function Timeline({
  turn,
  generations,
  nameOf,
  onJump,
  onStep,
  playing,
  onPlaying,
  pace,
  onPace,
  ghosts,
  onGhosts,
}: {
  turn: number;
  generations: number;
  nameOf: (turn: number) => string;
  onJump: (turn: number) => void;
  onStep: (by: 1 | -1) => void;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
  pace: Pace;
  onPace: (pace: Pace) => void;
  ghosts: boolean;
  onGhosts: (on: boolean) => void;
}) {
  const turns = Array.from({ length: generations }, (_, i) => i + 1);
  return (
    <nav className="replay__timeline" aria-label="Generations">
      <Button icon="left" iconOnly onClick={() => onStep(-1)}>
        {turn === 1 ? 'Title' : `Generation ${turn - 1}`}
      </Button>
      <ol className="replay__dots">
        {turns.map((t) => (
          <li key={t}>
            <button
              type="button"
              className={
                t === turn
                  ? 'replay__dot replay__dot--on'
                  : t < turn
                    ? 'replay__dot replay__dot--past'
                    : 'replay__dot'
              }
              aria-current={t === turn ? 'step' : undefined}
              title={`Generation ${t} · ${nameOf(t)}`}
              onClick={() => onJump(t)}
            >
              <span className="replay__pip" aria-hidden />
              <span className="replay__dot-name">{shortName(nameOf(t))}</span>
              <span className="visually-hidden">Generation {t}</span>
            </button>
          </li>
        ))}
      </ol>
      <Button icon="right" iconOnly onClick={() => onStep(1)}>
        {turn === generations ? 'The end' : `Generation ${turn + 1}`}
      </Button>
      <div className="replay__play">
        <Button
          icon={playing ? 'pause' : 'play'}
          onClick={() => onPlaying(!playing)}
          aria-pressed={playing}
        >
          {playing ? 'Pause' : 'Play'}
        </Button>
        <div className="replay__paces" role="radiogroup" aria-label="Pace">
          {PACES.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === pace ? 'primary' : 'quiet'}
              role="radio"
              aria-checked={p === pace}
              onClick={() => onPace(p)}
            >
              {PACE_LABEL[p]}
            </Button>
          ))}
        </div>
        <Button size="sm" variant={ghosts ? 'primary' : 'quiet'} onClick={() => onGhosts(!ghosts)} aria-pressed={ghosts}>
          Ghosts
        </Button>
      </div>
    </nav>
  );
}
