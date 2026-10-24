import { Button, Panel } from '../kit';

export interface EndAction {
  label: string;
  onClick: () => void;
}

/** A short line over the frozen world at the end of a turn ("The day is over."), with optional buttons; the first is focused. */
export function EndCard({ text, actions = [] }: { text: string; actions?: EndAction[] }) {
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)' }}>
      <Panel style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px' }} role="status">
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 20 }}>{text}</span>
        {actions.map((a, i) => (
          <Button key={a.label} variant={i === 0 ? 'primary' : 'default'} onClick={a.onClick} autoFocus={i === 0}>
            {a.label}
          </Button>
        ))}
      </Panel>
    </div>
  );
}
