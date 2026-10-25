import type { ReactNode } from 'react';
import { Panel, PixelBitmap } from '../kit';
import { palette } from '../theme/palette';
import { TOOLS, TOOL_TIP, toolLabel, type Tool } from './copy';
import { canPips, toolAria, type ToolbarData } from './toolbarData';

// Code-drawn until the UI atlas has tool icons (09).
const HAND = [
  '..s.s.s...',
  '..s.s.s.s.',
  '..sssssss.',
  'sssssssss.',
  '.ssssssss.',
  '..ssssss..',
  '...ssss...',
];
const SEEDS = [
  '...bbbb...',
  '..bbbbbb..',
  '.bbsbbsbb.',
  '.bbbbbbbb.',
  '.bbsbbsbb.',
  '..bbbbbb..',
  '...bbbb...',
];
const CAN = [
  '......w...',
  '.mmmm.ww..',
  'mmmmmm.ww.',
  'mmmmmmmww.',
  'mmmmmmm...',
  'mmmmmmm...',
  '.mmmmm....',
];

const ART: Record<Tool, { rows: string[]; inks: Record<string, string> }> = {
  hands: { rows: HAND, inks: { s: palette.peach } },
  seeds: { rows: SEEDS, inks: { b: palette.clay, s: palette.paper } },
  can: { rows: CAN, inks: { m: palette.rock, w: palette.water } },
};

/**
 * Tool slots 1–3 (13 › Toolbar and controls): hands, seeds with their count, and the watering can
 * with one pip per pour. The held tool is lit. `children` are the structure-action slots 4–8.
 */
export function Toolbar({
  held,
  data,
  children,
}: {
  held: Tool;
  data: ToolbarData;
  children?: ReactNode;
}) {
  return (
    <Panel style={{ display: 'flex', gap: 4, padding: 6 }} aria-label="Tools">
      {TOOLS.map((tool, i) => {
        const on = tool === held;
        return (
          <div
            key={tool}
            title={`${toolLabel(tool, data.seeds ?? undefined)}: ${TOOL_TIP[tool]}`}
            aria-label={toolAria(tool, data)}
            aria-pressed={on}
            role="img"
            style={{
              position: 'relative',
              width: 52,
              height: 52,
              display: 'grid',
              placeItems: 'center',
              background: on ? 'var(--highlight)' : 'var(--ink)',
              boxShadow: `inset 0 0 0 2px ${on ? 'var(--paper)' : 'var(--panel-edge)'}`,
            }}
          >
            <PixelBitmap rows={ART[tool].rows} inks={ART[tool].inks} scale={3} />
            <Corner on={on} side="left">
              {i + 1}
            </Corner>
            {tool === 'seeds' && data.seeds !== null && (
              <Corner on={on} side="right">
                {data.seeds}
              </Corner>
            )}
            {tool === 'can' && data.can && (
              <div style={{ position: 'absolute', bottom: 3, display: 'flex', gap: 2 }}>
                {canPips(data.can).map((full, p) => (
                  <span
                    key={p}
                    style={{
                      width: 6,
                      height: 6,
                      background: full ? palette.water : 'transparent',
                      boxShadow: `0 0 0 1px ${on ? 'var(--ink)' : 'var(--paper)'}`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      {children}
    </Panel>
  );
}

function Corner({
  on,
  side,
  children,
}: {
  on: boolean;
  side: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span
      style={{
        position: 'absolute',
        [side]: 3,
        top: 1,
        fontFamily: 'var(--font-ui)',
        fontSize: 12,
        color: on ? 'var(--ink)' : 'var(--paper)',
      }}
    >
      {children}
    </span>
  );
}
