import { Button, Panel } from '../kit';

/** A short line over the frozen world at the end of a turn ("The day is over."), with an optional button. */
export function EndCard({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 48, transform: 'translateX(-50%)' }}>
      <Panel style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px' }} role="status">
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 20 }}>{text}</span>
        {action && (
          <Button variant="primary" onClick={onAction} autoFocus>
            {action}
          </Button>
        )}
      </Panel>
    </div>
  );
}
