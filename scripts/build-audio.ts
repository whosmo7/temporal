/**
 * Builds the game's audio from the pack in art/source/ (`09`):
 *   npm run audio
 * - Music: each track in MUSIC → public/assets/audio/music/<name>.webm (Opus) + .mp3, loudness
 *   normalised a little under the SFX.
 * - SFX: every sound in SFX normalised, given its gain, and packed into one Howler audio sprite:
 *   public/assets/audio/sfx.webm + sfx.mp3 + src/audio/sfx-sprite.json ({ name: [startMs, ms] }).
 * Uses the ffmpeg binary from the ffmpeg-static dev dependency. Output is committed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { MUSIC, SFX } from './audio-manifest.ts';

const OUT = 'public/assets/audio';
const RATE = 44100;
const GAP_MS = 120; // silence between sprite clips, so a late stop never bleeds into the next one
/** Integrated loudness targets (LUFS): SFX sit clearly above the music. */
const MUSIC_LUFS = -20;
const SFX_LUFS = -16;

if (!ffmpegPath || !existsSync(ffmpegPath)) throw new Error('ffmpeg-static has no binary for this platform; run npm install.');
const ffmpeg = (args: string[]) => execFileSync(ffmpegPath as string, ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const need = (path: string) => {
  if (!existsSync(path)) throw new Error(`Can't read ${path}. Download the packs into art/source/ first (see ASSETS.md).`);
  return path;
};

mkdirSync(`${OUT}/music`, { recursive: true });
for (const [name, src] of Object.entries(MUSIC)) {
  const norm = `loudnorm=I=${MUSIC_LUFS}:TP=-2:LRA=11`;
  ffmpeg(['-i', need(src), '-af', norm, '-ar', '48000', '-ac', '2', '-c:a', 'libopus', '-b:a', '80k', `${OUT}/music/${name}.webm`]);
  ffmpeg(['-i', need(src), '-af', norm, '-ar', String(RATE), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '112k', `${OUT}/music/${name}.mp3`]);
  console.log(`music/${name} ← ${src.split('/').pop()}`);
}

// SFX: decode each clip to raw 16-bit stereo PCM, then lay them end to end with gaps.
const tmp = mkdtempSync(join(tmpdir(), 'inheritance-sfx-'));
try {
  const chunks: Buffer[] = [];
  const sprite: Record<string, [number, number]> = {};
  const bytesPerMs = (RATE * 2 * 2) / 1000;
  const gap = Buffer.alloc(Math.round(GAP_MS * bytesPerMs / 4) * 4);
  let cursor = 0;
  for (const [name, { src, gain = 1 }] of Object.entries(SFX)) {
    const raw = join(tmp, `${name}.pcm`);
    // Short clips are too brief for two-pass loudnorm to settle; one pass with a true-peak cap is fine.
    ffmpeg(['-i', need(src), '-af', `loudnorm=I=${SFX_LUFS}:TP=-1.5,volume=${gain}`, '-ar', String(RATE), '-ac', '2', '-f', 's16le', raw]);
    const pcm = readFileSync(raw);
    const ms = Math.round(pcm.length / bytesPerMs);
    sprite[name] = [Math.round(cursor / bytesPerMs), ms];
    chunks.push(pcm, gap);
    cursor += pcm.length + gap.length;
  }
  const all = join(tmp, 'sfx.pcm');
  writeFileSync(all, Buffer.concat(chunks));
  const input = ['-f', 's16le', '-ar', String(RATE), '-ac', '2', '-i', all];
  ffmpeg([...input, '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', `${OUT}/sfx.webm`]);
  ffmpeg([...input, '-c:a', 'libmp3lame', '-b:a', '96k', `${OUT}/sfx.mp3`]);
  mkdirSync('src/audio', { recursive: true });
  writeFileSync('src/audio/sfx-sprite.json', `${JSON.stringify(sprite, null, 1)}\n`);
  console.log(`sfx: ${Object.keys(sprite).length} sounds, ${(cursor / bytesPerMs / 1000).toFixed(1)} s`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
