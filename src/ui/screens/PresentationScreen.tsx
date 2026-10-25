import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import PerspectiveTunnelHero from '../../components/ui/perspective-tunnel-hero';
import { CONFIG } from '../../engine';
import { Button } from '../kit';
import { scoreExample } from '../presentation/demoScore';
import { IslandScene } from '../shell/IslandScene';
import { Logo } from '../shell/Logo';
import { SkyBackdrop } from '../shell/SkyBackdrop';
import { LandingScreen } from './LandingScreen';
import '../shell/shell.css';
import '../presentation/presentation.css';

/*
 * THESIS: A live journey through inherited consequences, ending inside the game itself.
 * OWN-WORLD: Inheritance's pixel islands, cream ink, plum night, peach dusk and teal dawn.
 * STORY: Time exposes choices → stewardship → six lives → compete → leave → play.
 * FIRST VIEWPORT: Centred three-line pixel headline, four islands flying past its margins;
 * compact chapter rail above, a scroll invitation below. No timed slide advancement.
 * FORM: User-pinned perspective tunnel, followed by a native-scrolling six-chapter story.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
 * the verdict, DESIGN.md, and every shipping raster carrying its provenance
 */

const CHAPTERS = [
  { id: 'inheritance-time', name: 'Time' },
  { id: 'inheritance-evidence', name: 'The evidence' },
  { id: 'inheritance-balance', name: 'The balance' },
  { id: 'inheritance-world', name: 'Inheritance' },
  { id: 'inheritance-score', name: 'The temptation' },
  { id: 'inheritance-legacy', name: 'What remains' },
  { id: 'inheritance-home', name: 'Play' },
] as const;

function StoryIsland({ stones = 3, className = '' }: { stones?: number; className?: string }) {
  const light = useRef<HTMLDivElement>(null);
  return (
    <div className={`story-island ${className}`}>
      <IslandScene lightRef={light} hold={{ light: 0.42, stones }} />
    </div>
  );
}

function ScoreExperiment() {
  const [kept, setKept] = useState(0);
  const { score, foodLeft, shortfall } = scoreExample(kept);
  const baseline = scoreExample(0).score.total;
  const difference = Math.round((score.total - baseline) * 10) / 10;
  const format = (n: number) => n.toFixed(1).replace(/\.0$/, '');
  return (
    <div className="score-experiment">
      <div className="score-experiment__choice">
        <label htmlFor="food-kept">
          How much will you keep? <output htmlFor="food-kept">{kept} food</output>
        </label>
        <input
          id="food-kept"
          type="range"
          min="0"
          max="48"
          step="1"
          value={kept}
          onChange={(e) => setKept(Number(e.target.value))}
          aria-describedby="score-scenario"
        />
        <div className="score-experiment__presets">
          <button type="button" onClick={() => setKept(0)} aria-pressed={kept === 0}>
            Leave it all
          </button>
          <button type="button" onClick={() => setKept(12)} aria-pressed={kept === 12}>
            Keep the surplus
          </button>
          <button type="button" onClick={() => setKept(48)} aria-pressed={kept === 48}>
            Empty the store
          </button>
        </div>
        <p id="score-scenario" className="presentation-note">
          Illustrative world, real scoring engine. You inherited 24 food and gathered 24. Nightfall
          costs {CONFIG.upkeepFood}.
        </p>
        <div className="score-reserve">
          <span>Food the next player inherits</span>
          <strong>{foodLeft}</strong>
        </div>
        <meter min="0" max="48" value={foodLeft} aria-label="Food inherited by the next player" />
        <p className="score-consequence">
          {shortfall > 0
            ? 'Tonight’s needs go unmet. The next player wakes up weakened.'
            : foodLeft < CONFIG.upkeepFood
              ? 'Tonight is covered. The next player inherits less than one night’s food.'
              : foodLeft < 24
                ? 'The next player can cover a night, but has a smaller buffer.'
                : 'The next player inherits a reserve for at least two nights.'}
        </p>
      </div>
      <div className="score-ledger" aria-live="polite" aria-atomic="true">
        <h3>Your score at death</h3>
        <dl>
          <div>
            <dt>Productive earnings</dt>
            <dd>+{format(score.productive)}</dd>
          </div>
          <div>
            <dt>Extraction gains</dt>
            <dd>+{format(score.extraction)}</dd>
          </div>
          <div className="score-ledger__cost">
            <dt>Corruption</dt>
            <dd>−{format(score.corruption)}</dd>
          </div>
          <div>
            <dt>World you leave</dt>
            <dd>+{format(score.exitBonus)}</dd>
          </div>
          <div className="score-ledger__total">
            <dt>Total</dt>
            <dd>{format(score.total)}</dd>
          </div>
        </dl>
        <p>
          {difference > 0 ? '+' : ''}
          {format(difference)} points compared with keeping nothing.
        </p>
      </div>
    </div>
  );
}

export function PresentationScreen() {
  const [active, setActive] = useState(0);
  const [generation, setGeneration] = useState(1);
  const reduce = useReducedMotion();
  const sections = useRef<(HTMLElement | null)[]>([]);
  const go = useCallback(
    (index: number) => {
      sections.current[Math.max(0, Math.min(CHAPTERS.length - 1, index))]?.scrollIntoView({
        behavior: reduce ? 'instant' : 'smooth',
        block: 'start',
      });
    },
    [reduce],
  );

  useEffect(() => {
    const previous = document.title;
    document.title = 'Inheritance — What will you leave?';
    const update = () => {
      const line = window.innerHeight * 0.45;
      let next = 0;
      sections.current.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= line) next = index;
      });
      setActive(next);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      document.title = previous;
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('input, textarea, select, button, a, [contenteditable="true"]') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        go(active + 1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        go(active - 1);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        go(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        go(CHAPTERS.length - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, go]);

  return (
    <div className="presentation">
      <a className="presentation-skip" href="#/">
        Skip to the game
      </a>
      <header className="presentation-header">
        <Link className="presentation-brand" to="/" aria-label="Inheritance home">
          INHERITANCE<span>A world on borrowed time</span>
        </Link>
        <nav className="presentation-chapters" aria-label="Presentation chapters">
          {CHAPTERS.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              aria-label={`Go to ${chapter.name}`}
              aria-current={active === index ? 'step' : undefined}
              onClick={() => go(index)}
            >
              <span className="chapter-dot" />
              <span className="chapter-name">{chapter.name}</span>
            </button>
          ))}
        </nav>
        <Link className="presentation-game-link" to="/">
          Enter game <span aria-hidden>↗</span>
        </Link>
      </header>
      <main>
        <section
          id={CHAPTERS[0].id}
          ref={(el) => {
            sections.current[0] = el;
          }}
          aria-labelledby="time-title"
        >
          <PerspectiveTunnelHero />
        </section>

        <section
          id={CHAPTERS[1].id}
          ref={(el) => {
            sections.current[1] = el;
          }}
          className="story-section story-evidence"
          aria-labelledby="evidence-title"
        >
          <div className="story-copy">
            <h2 id="evidence-title">
              The world you
              <br />
              open <em>was left.</em>
            </h2>
            <p>
              Tap water when you turn on the sink. Electricity when the lights come on.
              <br className="desktop-break" /> Soil that can still grow food.
            </p>
            <p>
              These are systems someone built, repaired, and passed on.
              <br className="desktop-break" /> You inherit their care — or the cost of its absence.
            </p>
          </div>
          <div className="evidence-scene">
            <StoryIsland stones={4} />
            <p className="journal-fragment">
              “The pump works again.
              <br />I hope it lasts.”<small>An imagined note left for the next person</small>
            </p>
          </div>
        </section>

        <section
          id={CHAPTERS[2].id}
          ref={(el) => {
            sections.current[2] = el;
          }}
          className="story-section story-balance"
          aria-labelledby="balance-title"
        >
          <h2 id="balance-title">
            We have to live.
            <br />
            So do they.
          </h2>
          <blockquote>
            <p>
              “Sustainability, ensuring the future of life on earth, is an infinite game, the
              endless expression of generosity on behalf of all.”
            </p>
            <footer>
              <a
                href="https://uk.sagepub.com/sites/default/files/upm-assets/52625_book_item.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Paul Hawken · <cite>Blessed Unrest</cite>, 2007, p. 187
              </a>
            </footer>
          </blockquote>
          <p>
            We need what the world gives us: food, water, energy, places to live.
            <br className="desktop-break" /> The question is how much we can use while leaving those
            systems working for whoever comes next.
          </p>
          <p className="story-turn">What if that balance became a game?</p>
        </section>

        <section
          id={CHAPTERS[3].id}
          ref={(el) => {
            sections.current[3] = el;
          }}
          className="story-section story-world"
          aria-labelledby="world-title"
        >
          <div className="story-copy">
            <h2 id="world-title">
              <Logo size="landing" />
            </h2>
            <p className="story-lead">
              We inherit. We give.
              <br />
              For a moment, we are the link.
            </p>
            <p>
              One shared world. Six generations.
              <br />
              You have {CONFIG.turnSeconds / 60} minutes to live in it, use it, and steward it.
              <br />
              Then your world becomes someone else’s starting point.
            </p>
            <p className="presentation-note">
              Generations run in order. A player can return to the same world later.
            </p>
          </div>
          <div className="generation-scene">
            <StoryIsland stones={generation} />
            <div className="generation-track" role="group" aria-label="Explore the six generations">
              {Array.from({ length: CONFIG.generationCount }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setGeneration(i + 1)}
                  aria-pressed={generation === i + 1}
                  aria-label={`Generation ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <p>
              Generation {generation} of {CONFIG.generationCount} · the world outlives you.
            </p>
          </div>
        </section>

        <section
          id={CHAPTERS[4].id}
          ref={(el) => {
            sections.current[4] = el;
          }}
          className="story-section story-score"
          aria-labelledby="score-title"
        >
          <div className="score-heading">
            <h2 id="score-title">
              Enough for you.
              <br />
              <em>What about them?</em>
            </h2>
            <p>
              You compete for the highest personal score. Growing and gathering earns points.
              Keeping resources can earn more. Taking too much raises corruption and reduces the
              world bonus you leave with.
            </p>
          </div>
          <ScoreExperiment />
          <details className="score-rules">
            <summary>Show the scoring rules</summary>
            <p>Score = productive earnings + extraction gains − corruption + exit-world bonus.</p>
            <p>
              Corruption = {CONFIG.playerScore.corruptionLinear} × units taken or overhunted +{' '}
              {CONFIG.playerScore.corruptionQuadratic} × units². Food gathered and then kept is
              moved out of productive credit to avoid double counting.
            </p>
            <p>
              The exit bonus values useful food and water reserves, working infrastructure,
              orchards, fields and wild stock. It is assessed after your own upkeep and locked when
              your generation ends. Later players cannot change it. These are the current
              experimental weights, not a claim that every strategy is balanced.
            </p>
          </details>
        </section>

        <section
          id={CHAPTERS[5].id}
          ref={(el) => {
            sections.current[5] = el;
          }}
          className="story-section story-legacy"
          aria-labelledby="legacy-title"
        >
          <div className="legacy-line" aria-hidden>
            <span>INHERIT</span>
            <i />
            <span>LIVE</span>
            <i />
            <span>LEAVE</span>
          </div>
          <h2 id="legacy-title">
            Your time ends.
            <br />
            <em>Your choices don’t.</em>
          </h2>
          <p>
            Your score is locked when you die, from the world you leave.
            <br className="desktop-break" /> Your journal passes to a stranger. Your consequences
            keep living.
          </p>
          <p>
            After the sixth generation, the replay reveals who caused what.
            <br className="desktop-break" /> Time tells the story nobody could see while living it.
          </p>
          <Button variant="primary" onClick={() => go(6)}>
            What will you leave?
          </Button>
        </section>

        <section
          id={CHAPTERS[6].id}
          ref={(el) => {
            sections.current[6] = el;
          }}
          className="presentation-home"
          aria-label="Inheritance game home"
        >
          <SkyBackdrop />
          {active === 6 && <LandingScreen showStory={false} />}
          <button className="presentation-restart" type="button" onClick={() => go(0)}>
            Replay the introduction
          </button>
        </section>
      </main>
      {active < 6 && (
        <footer className="presentation-controls">
          <span>
            {active + 1} / 6{' '}
            <span className="presentation-control-label"> · {CHAPTERS[active].name}</span>
          </span>
          <div>
            <button
              type="button"
              disabled={active === 0}
              onClick={() => go(active - 1)}
              aria-label="Previous chapter"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              aria-label={active === 5 ? 'Open game home' : 'Next chapter'}
            >
              →
            </button>
          </div>
          <span className="presentation-key-hint">Scroll or use ← →</span>
        </footer>
      )}
    </div>
  );
}
