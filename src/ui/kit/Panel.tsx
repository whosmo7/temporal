import type { HTMLAttributes, ReactNode } from 'react';

export function Panel({
  tone = 'ink',
  title,
  cast = true,
  className,
  children,
  ...rest
}: {
  tone?: 'ink' | 'paper';
  /** Rendered as the panel's heading. */
  title?: ReactNode;
  /** Drop the world-light shadow under the panel. */
  cast?: boolean;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const panel = (
    <section
      className={[
        'kit-panel',
        tone === 'paper' && 'kit-panel--paper on-paper',
        !cast && className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {title && <h2 className="kit-panel__title">{title}</h2>}
      {children}
    </section>
  );
  // clip-path cuts off box-shadows, so the shadow lives on a wrapper.
  return cast ? <div className={['kit-cast', className].filter(Boolean).join(' ')}>{panel}</div> : panel;
}
