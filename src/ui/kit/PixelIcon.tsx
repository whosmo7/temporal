import atlas from './ui-atlas.json';

/** Frame names in the UI atlas (built by `npm run atlas`, `09`). */
export type PixelIconName = keyof typeof atlas.frames;

const SHEET = `${import.meta.env.BASE_URL}assets/atlas/ui.png`;
const SIZE = atlas.meta.size;

/**
 * A pack icon from the UI atlas: resources (`ui/icon-food`), actions by engine ID
 * (`ui/icon-plantOrchard`), the day/night dial. Drawn as a CSS sprite at a whole-number scale so
 * it stays on the pixel grid: 2× in the HUD, 3× in the hotbar (art direction › UI).
 */
export function PixelIcon({
  name,
  scale = 2,
  label,
  className,
}: {
  name: PixelIconName;
  /** Screen pixels per art pixel. Keep it an integer. */
  scale?: number;
  /** Accessible name. Leave it out when the icon sits next to visible text. */
  label?: string;
  className?: string;
}) {
  const f = atlas.frames[name].frame;
  return (
    <span
      className={['kit-pixel-icon', className].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        width: f.w * scale,
        height: f.h * scale,
        backgroundImage: `url(${SHEET})`,
        backgroundPosition: `${-f.x * scale}px ${-f.y * scale}px`,
        backgroundSize: `${SIZE.w * scale}px ${SIZE.h * scale}px`,
      }}
    />
  );
}
