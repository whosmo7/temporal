import { Panel } from '../kit';

/**
 * The prompt that appears next to something you can use, e.g. `E  Read the journal`. Wording comes
 * from docs/content/flavour-text.md. Action prompts with costs join it with `applyAction` (02).
 */
export function InteractPrompt({ keyLabel, text }: { keyLabel: string; text: string }) {
  return (
    <Panel style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px' }} role="status">
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
        {keyLabel}
      </kbd>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16 }}>{text}</span>
    </Panel>
  );
}
