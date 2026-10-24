import { Panel, PixelIcon } from '../kit';

export interface PromptRow {
  keyLabel: string;
  text: string;
  /** What it costs now. Never what it gives back, or when (inheritance-player-facing). */
  cost?: { stamina: number; water: number };
  /** Why it can't be done right now (the engine's words). The row is greyed out. */
  error?: string | null;
}

/**
 * The prompt next to something you can use, e.g. `E  Sow crops · 8⚡ 1💧`, one row per thing you
 * can do there. Wording comes from docs/content/flavour-text.md.
 */
export function InteractPrompt({ rows }: { rows: PromptRow[] }) {
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 12px' }} role="status">
      {rows.map((row) => (
        <div
          key={row.keyLabel + row.text}
          style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: row.error ? 0.55 : 1 }}
        >
          <Key label={row.keyLabel} />
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16 }}>{row.text}</span>
          {row.cost && <Cost cost={row.cost} />}
          {row.error && <span style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--peach)' }}>{row.error}</span>}
        </div>
      ))}
    </Panel>
  );
}

export function Key({ label }: { label: string }) {
  return (
    <kbd
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: 14,
        padding: '1px 6px',
        background: 'var(--paper)',
        color: 'var(--ink)',
        boxShadow: 'inset 0 -2px 0 var(--muted)',
      }}
    >
      {label}
    </kbd>
  );
}

/** `8⚡ 1💧` with the pack's icons; nothing for a free action. */
export function Cost({ cost }: { cost: { stamina: number; water: number } }) {
  if (cost.stamina <= 0 && cost.water <= 0) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: 16 }}>
      {cost.stamina > 0 && (
        <>
          {cost.stamina}
          <PixelIcon name="ui/icon-stamina" scale={1} label="stamina" />
        </>
      )}
      {cost.water > 0 && (
        <>
          {cost.water}
          <PixelIcon name="ui/icon-water" scale={1} label="water" />
        </>
      )}
    </span>
  );
}
