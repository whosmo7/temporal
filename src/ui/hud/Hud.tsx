import type { ReactNode } from 'react';
import { CONFIG } from '../../engine';
import { useGameStore } from '../../store/game';
import { Panel, PixelBitmap, PixelIcon } from '../kit';
import { palette } from '../theme/palette';
import { landOf, type Land } from './land';

/** A bowl, for hunger (the UI atlas has no hunger icon yet). */
const BOWL = [
  '..........',
  '.f..f..f..',
  '..f..f..f.',
  'bbbbbbbbbb',
  'bbbbbbbbbb',
  '.bbbbbbbb.',
  '..bbbbbb..',
  '...bbbb...',
];

/** A sprout, for the land's health (13). */
const SPROUT = [
  '..ll..ll..',
  '.llll.lll.',
  '..lllsll..',
  '.....s....',
  '.....s....',
  '.ddddddd..',
  'ddddddddd.',
];

/**
 * Top-left HUD (04 › HUD): food, the watering can's pours, the stamina and hunger bars, the land's
 * health and level once the engine has them (13, decision 023) and the generation. Stored water and
 * the nightfall line are gone: nights take food only (decision 027). Health is a bar, never a number.
 */
export function Hud() {
  const food = useGameStore((s) => s.view?.resources.food ?? 0);
  const can = useGameStore((s) => s.view?.resources.can ?? 0);
  const stamina = useGameStore((s) => s.view?.resources.stamina ?? 0);
  const hunger = useGameStore((s) => s.view?.resources.hunger ?? 0);
  const turn = useGameStore((s) => s.view?.turn ?? 1);
  const gens = useGameStore((s) => s.world?.generationCount ?? CONFIG.generationCount);
  const land = useGameStore((s) => landOf(s.view));
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', fontFamily: 'var(--font-ui)', fontSize: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Count icon="ui/icon-food" value={food} label="Food" />
        <Count icon="ui/icon-water" value={can} of={CONFIG.canCapacity} label="Watering can" />
      </div>
      <Bar label="Stamina" value={stamina} max={CONFIG.baseStamina} colour={palette.stamina}>
        <PixelIcon name="ui/icon-stamina" scale={1} />
      </Bar>
      <Bar label="Hunger" value={hunger} max={CONFIG.hungerMax} colour={palette.food}>
        <PixelBitmap rows={BOWL} inks={{ b: palette.clay, f: palette.paper }} scale={2} />
      </Bar>
      {land && <LandMeter land={land} />}
      <div style={{ fontSize: 14, color: 'var(--muted)' }}>
        Generation {turn} of {gens}
      </div>
    </Panel>
  );
}

/** The land: a health bar with no number, and the level's name (13, decision 023). */
export function LandMeter({ land }: { land: Land }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Bar label="The land" value={land.health} max={1} colour={palette.grassShade} hideValue>
        <PixelBitmap rows={SPROUT} inks={{ l: palette.grass, s: palette.grassShade, d: palette.dirt }} scale={2} />
      </Bar>
      <span style={{ fontSize: 14, color: 'var(--paper)' }}>{land.name}</span>
    </div>
  );
}

function Count({ icon, value, of, label }: { icon: 'ui/icon-food' | 'ui/icon-water'; value: number; of?: number; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} aria-label={`${label} ${value}${of ? ` of ${of}` : ''}`}>
      <PixelIcon name={icon} scale={2} />
      <span style={{ fontSize: 20, minWidth: '2ch' }}>
        {value}
        {of !== undefined && <span style={{ fontSize: 14, color: 'var(--muted)' }}>/{of}</span>}
      </span>
    </span>
  );
}

function Bar({
  label,
  value,
  max,
  colour,
  hideValue = false,
  children,
}: {
  label: string;
  value: number;
  max: number;
  colour: string;
  /** No number for screen readers either: the land's health is never given as a number (13). */
  hideValue?: boolean;
  children: ReactNode;
}) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  const meter = hideValue
    ? { role: 'img' }
    : { role: 'meter', 'aria-valuenow': value, 'aria-valuemin': 0, 'aria-valuemax': max };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label={label} {...meter}>
      <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{children}</span>
      <div style={{ width: 128, height: 10, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--panel-edge)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width 200ms steps(8)' }} />
      </div>
    </div>
  );
}
