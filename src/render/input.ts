import type { Direction } from './movement';

const KEYS: Record<string, keyof typeof DIRS> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;

/** WASD / arrow key state. Ignores keys typed into form fields; releases everything on blur. */
export class KeyboardInput {
  private held = new Set<keyof typeof DIRS>();
  /** While true (an overlay is open), movement reads as no input. */
  paused = false;

  constructor(private target: Window = window) {
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.clear);
  }

  direction(): Direction {
    if (this.paused) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    for (const d of this.held) {
      x += DIRS[d][0];
      y += DIRS[d][1];
    }
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.clear);
  }

  private onDown = (e: KeyboardEvent) => {
    const dir = KEYS[e.code];
    if (!dir || isTyping(e.target)) return;
    e.preventDefault();
    this.held.add(dir);
  };

  private onUp = (e: KeyboardEvent) => {
    const dir = KEYS[e.code];
    if (dir) this.held.delete(dir);
  };

  private clear = () => this.held.clear();
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable);
}
