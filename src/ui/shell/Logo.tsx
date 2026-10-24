import { PixelBitmap } from '../kit';
import { SAPLING, SAPLING_INKS } from './sapling';

/**
 * The INHERITANCE wordmark: the pixel font in paper with an ink outline, and a sapling growing
 * out of the first letter. `size` picks the header or the landing scale.
 */
export function Logo({ size = 'header' }: { size?: 'header' | 'landing' }) {
  return (
    <span className={`logo logo--${size}`} aria-label="Inheritance" role="img">
      <span className="logo__first" aria-hidden>
        <PixelBitmap rows={SAPLING} inks={SAPLING_INKS} scale={size === 'landing' ? 6 : 3} className="logo__sapling" />I
      </span>
      <span aria-hidden>NHERITANCE</span>
    </span>
  );
}
