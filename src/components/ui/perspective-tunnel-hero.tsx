import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useRef } from 'react';
import { IslandScene } from '../../ui/shell/IslandScene';

// Adapted from the user's PerspectiveTunnelHero: the same staggered Z-space travel,
// driven by native document scrolling so touch, keyboard and page navigation still work.
const MEMORIES = [
  { title: 'Someone planted.', stones: 1, x: -1, y: -1 },
  { title: 'Someone inherited.', stones: 3, x: 1, y: -1 },
  { title: 'Someone took.', stones: 4, x: -1, y: 1 },
  { title: 'Someone remembered.', stones: 6, x: 1, y: 1 },
];

function Memory({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const memory = MEMORIES[index];
  const light = useRef<HTMLDivElement>(null);
  const z = useTransform(progress, [0, 1], [-900 - index * 180, 550 - index * 140]);
  const opacity = useTransform(progress, [0, 0.5, 1], [0.45, 0.85, 0.2]);
  return (
    <motion.figure
      className="time-memory"
      style={{ z, opacity, left: `${50 + memory.x * 65}%`, top: `${50 + memory.y * 43}%` }}
    >
      <IslandScene lightRef={light} hold={{ light: 0.42, stones: memory.stones }} />
      <figcaption>{memory.title}</figcaption>
    </motion.figure>
  );
}

export default function PerspectiveTunnelHero() {
  const container = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 80, damping: 30 });
  const scale = useTransform(progress, [0, 1], [1, 1.12]);
  return (
    <div className="time-tunnel" ref={container}>
      <div className="time-tunnel__stage">
        <div className="time-stars" aria-hidden />
        {!reduce && (
          <div className="time-tunnel__space" aria-hidden>
            {MEMORIES.map((m, i) => (
              <Memory key={m.title} index={i} progress={progress} />
            ))}
          </div>
        )}
        <motion.div className="time-tunnel__words" style={reduce ? undefined : { scale }}>
          <p className="time-opening">We are all victims of time.</p>
          <h1 id="time-title">
            Time
            <br />
            <em>snitches</em>
            <br />
            on us.
          </h1>
          <p>
            We can hide our intentions.
            <br />
            We cannot hide what we leave behind.
          </p>
        </motion.div>
        <a
          className="time-scroll"
          href="#/presentation"
          onClick={(e) => {
            e.preventDefault();
            document
              .getElementById('inheritance-evidence')
              ?.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth' });
          }}
        >
          Scroll to see what survives <span aria-hidden>↓</span>
        </a>
      </div>
    </div>
  );
}
