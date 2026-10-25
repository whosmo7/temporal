import type { ReactNode } from 'react';
import { CONFIG } from '../../engine';
import { useGameStore } from '../../store/game';
import { Panel, PixelBitmap, PixelIcon } from '../kit';
import { palette } from '../theme/palette';

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

/**
 * Top-left HUD (04 › HUD): food, the watering can's pours, the stamina and hunger bars and the
 * generation. Stored water and the nightfall line are gone: nights take food only (decision 027).
 */
export function Hud() {
  const food = useGameStore((s) => s.view?.resources.food ?? 0);
  const can = useGameStore((s) => s.view?.resources.can ?? 0);
  const stamina = useGameStore((s) => s.view?.resources.stamina ?? 0);
  const hunger = useGameStore((s) => s.view?.resources.hunger ?? 0);
  const turn = useGameStore((s) => s.view?.turn ?? 1);
  const gens = useGameStore((s) => s.world?.generationCount ?? CONFIG.generationCount);
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
      <div style={{ fontSize: 14, color: 'var(--muted)' }}>
        Generation {turn} of {gens}
      </div>
    </Panel>
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

function Bar({ label, value, max, colour, children }: { label: string; value: number; max: number; colour: string; children: ReactNode }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{children}</span>
      <div style={{ width: 128, height: 10, background: 'var(--ink)', boxShadow: '0 0 0 2px var(--panel-edge)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width 200ms steps(8)' }} />
      </div>
    </div>
  );
}
