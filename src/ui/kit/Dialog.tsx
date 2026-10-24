import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Panel } from './Panel';

/**
 * A modal on the native `<dialog>`, which gives focus trapping, the top layer and inert content
 * behind it for free. Use it only when the player must answer before going on (sealing a page,
 * logging out mid-turn), never for information.
 */
export function Dialog({
  open,
  title,
  onClose,
  dismissable = true,
  tone = 'ink',
  actions,
  children,
}: {
  open: boolean;
  title: ReactNode;
  /** Called on Esc when `dismissable`. The parent owns `open`. */
  onClose?: () => void;
  /** False for questions that must be answered with one of the actions. */
  dismissable?: boolean;
  tone?: 'ink' | 'paper';
  actions: ReactNode;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current!;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="kit-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose?.();
      }}
    >
      <Panel tone={tone}>
        <h2 id={titleId} className="kit-panel__title">
          {title}
        </h2>
        {children}
        <div className="kit-dialog__actions">{actions}</div>
      </Panel>
    </dialog>
  );
}
