// Music and sound effects (`09`, `08` › mute toggle). One Howler audio sprite for every SFX, one
// streamed loop per music track. Browsers block sound until the player interacts, so music asked
// for before the first click or key waits for it. Mute lives in localStorage.
import { Howl, Howler } from 'howler';
import sprite from './sfx-sprite.json';

export type SfxName = keyof typeof sprite;
export type MusicName = 'day' | 'dusk' | 'reflective';

const BASE = `${import.meta.env.BASE_URL}assets/audio/`;
const MUSIC_VOLUME = 0.55;
const MUTE_KEY = 'inheritance:muted';

let sfx: Howl | null = null;
const tracks = new Map<MusicName, Howl>();
let current: { name: MusicName; id: number } | null = null;
let wanted: MusicName | null = null;
let unlocked = false;
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();
Howler.mute(muted);

function sprites(): Howl {
  sfx ??= new Howl({
    src: [`${BASE}sfx.webm`, `${BASE}sfx.mp3`],
    sprite: sprite as Record<SfxName, [number, number]>,
  });
  return sfx;
}

function track(name: MusicName): Howl {
  let h = tracks.get(name);
  if (!h) {
    h = new Howl({ src: [`${BASE}music/${name}.webm`, `${BASE}music/${name}.mp3`], loop: true, html5: true, volume: 0 });
    tracks.set(name, h);
  }
  return h;
}

function startWanted(fadeMs: number): void {
  if (!unlocked || !wanted || current?.name === wanted) return;
  if (current) {
    const old = tracks.get(current.name)!;
    const oldId = current.id;
    old.fade(old.volume(oldId) as number, 0, fadeMs, oldId);
    old.once('fade', () => old.stop(oldId), oldId);
  }
  const next = track(wanted);
  const id = next.play();
  next.fade(0, MUSIC_VOLUME, fadeMs, id);
  current = { name: wanted, id };
}

function unlock(): void {
  if (unlocked) return;
  unlocked = true;
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
  startWanted(800);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/** Plays a sound effect by name (`ids.md` action IDs, `ui-click`, `page`, `seal`, …). */
export function playSfx(name: SfxName): void {
  if (!unlocked) return; // nothing plays before the first interaction anyway
  sprites().play(name);
}

/** Crossfades to a music loop; before the first click it starts on that click. */
export function playMusic(name: MusicName, fadeMs = 2000): void {
  wanted = name;
  startWanted(fadeMs);
}

/** The loop that is playing or waiting for the first click, so an overlay can hand it back. */
export function currentMusic(): MusicName | null {
  return wanted;
}

export function stopMusic(fadeMs = 1200): void {
  wanted = null;
  if (!current) return;
  const h = tracks.get(current.name)!;
  const id = current.id;
  h.fade(h.volume(id) as number, 0, fadeMs, id);
  h.once('fade', () => h.stop(id), id);
  current = null;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  Howler.mute(next);
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // Private mode or blocked storage: the setting lasts this visit only.
  }
  for (const fn of listeners) fn();
}

/** For useSyncExternalStore. */
export function subscribeMuted(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
