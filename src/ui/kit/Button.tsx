import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

type Variant = 'default' | 'primary' | 'quiet';
type Size = 'md' | 'sm';

interface Look {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Show only the icon; `children` becomes the accessible name. */
  iconOnly?: boolean;
  children: ReactNode;
}

function classes({ variant = 'default', size = 'md', iconOnly }: Look, extra?: string) {
  return [
    'kit-button',
    variant !== 'default' && `kit-button--${variant}`,
    size === 'sm' && 'kit-button--sm',
    iconOnly && 'kit-button--icon',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

function Content({ icon, iconOnly, size, children }: Look) {
  if (iconOnly && icon) {
    return (
      <>
        <Icon name={icon} scale={size === 'sm' ? 2 : 3} />
        <span className="visually-hidden">{children}</span>
      </>
    );
  }
  return (
    <>
      {icon && <Icon name={icon} scale={2} />}
      <span>{children}</span>
    </>
  );
}

export function Button({
  variant,
  size,
  icon,
  iconOnly,
  children,
  className,
  type = 'button',
  ...rest
}: Look & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const look = { variant, size, icon, iconOnly, children };
  return (
    <button type={type} className={classes(look, className)} {...rest}>
      <Content {...look} />
    </button>
  );
}

/** A route change that looks like a button (Play, Gallery). */
export function ButtonLink({
  variant,
  size,
  icon,
  iconOnly,
  children,
  className,
  ...rest
}: Look & Omit<LinkProps, 'children'>) {
  const look = { variant, size, icon, iconOnly, children };
  return (
    <Link className={classes(look, className)} {...rest}>
      <Content {...look} />
    </Link>
  );
}
