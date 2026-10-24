import type { ActionType, Biome } from '../../engine';
import { Panel, PixelIcon, type PixelIconName } from '../kit';
import type { ActionOption } from './actionOptions';
import { HOTBAR, hotbarLabel } from './copy';

/**
 * The eight actions along the bottom (04 › HUD), keys 1–8. Slots that can be used at the plot
 * you're standing by are lit; the rest are dimmed but still pressable (the engine says why not).
 */
export function Hotbar({ biome, options }: { biome: Biome; options: ActionOption[] }) {
  return (
    <Panel style={{ display: 'flex', gap: 4, padding: 6 }} aria-label="Actions">
      {HOTBAR.map((type, i) => {
        const here = options.filter((o) => o.request.type === type);
        const usable = here.some((o) => !o.error);
        return (
          <div
            key={type}
            title={hotbarLabel(type, biome)}
            style={{
              position: 'relative',
              width: 52,
              height: 52,
              display: 'grid',
              placeItems: 'center',
              background: usable ? 'var(--highlight)' : 'var(--ink)',
              boxShadow: `inset 0 0 0 2px ${here.length ? 'var(--paper)' : 'var(--panel-edge)'}`,
              opacity: usable || here.length ? 1 : 0.6,
            }}
          >
            <PixelIcon name={iconFor(type, biome)} scale={2} label={hotbarLabel(type, biome)} />
            <span
              style={{
                position: 'absolute',
                left: 3,
                top: 1,
                fontFamily: 'var(--font-ui)',
                fontSize: 12,
                color: usable ? 'var(--ink)' : 'var(--paper)',
              }}
            >
              {i + 1}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

function iconFor(type: ActionType, biome: Biome): PixelIconName {
  return type === 'fishHunt' ? `ui/icon-fishHunt-${biome}` : `ui/icon-${type}`;
}
