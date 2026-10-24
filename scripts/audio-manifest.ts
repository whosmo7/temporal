/**
 * Which pack sound becomes which game sound (`09` › Music, SFX list). Picked by name and length
 * from Ninja Adventure (CC0) without listening, so swap freely: each is one line, then run
 * `npm run audio`. SFX keys are the action IDs from ids.md where one exists, plus the UI and
 * journal sounds the plan lists.
 */
import { PACK } from './atlas-manifest.ts';

const SOUNDS = `${PACK}/Audio/Sounds`;
const MUSICS = `${PACK}/Audio/Musics`;

/** Day loop, dusk (crossfade as time runs out), and the reflective theme (journal, graveyard, replay). */
export const MUSIC = {
  day: `${MUSICS}/5 - Peaceful.ogg`,
  dusk: `${MUSICS}/9 - Quiet.ogg`,
  reflective: `${MUSICS}/16 - Melancholia.ogg`,
} as const;

export interface SfxSpec {
  src: string;
  /** Gain after loudness normalising, 0–1. Footsteps and the pen sit well under everything else. */
  gain?: number;
}

export const SFX: Record<string, SfxSpec> = {
  // Actions (ids.md). Fishing and hunting share an action, so it has a sound per biome.
  harvest: { src: `${SOUNDS}/Jump & Bounce/Bounce.wav` },
  plantCrops: { src: `${SOUNDS}/Hit & Impact/Impact4.wav` },
  plantOrchard: { src: `${SOUNDS}/Hit & Impact/Impact2.wav` },
  digWell: { src: `${SOUNDS}/Hit & Impact/Impact.wav` },
  repairReservoir: { src: `${SOUNDS}/Hit & Impact/Hit1.wav` },
  maintain: { src: `${SOUNDS}/Elemental/Water2.wav`, gain: 0.8 },
  'fishHunt-island': { src: `${SOUNDS}/Elemental/Water1.wav` },
  'fishHunt-forest': { src: `${SOUNDS}/Whoosh & Slash/Whoosh.wav` },
  fastTrack: { src: `${SOUNDS}/Magic & Skill/Heal.wav` },
  // Feedback and the clock.
  deny: { src: `${SOUNDS}/Menu/Cancel2.wav`, gain: 0.8 },
  'ui-click': { src: `${SOUNDS}/Menu/Move1.wav`, gain: 0.6 },
  tick: { src: `${SOUNDS}/Menu/Move2.wav`, gain: 0.6 },
  bell: { src: `${SOUNDS}/Alert/Alert.wav` },
  // Journal and graveyard.
  page: { src: `${SOUNDS}/Whoosh & Slash/Whoosh2.wav`, gain: 0.5 },
  pen: { src: `${SOUNDS}/Elemental/Grass.wav`, gain: 0.3 },
  seal: { src: `${SOUNDS}/Hit & Impact/Impact3.wav` },
  stone: { src: `${SOUNDS}/Hit & Impact/Impact5.wav` },
  // Walking.
  'footstep-1': { src: `${SOUNDS}/Elemental/Grass.wav`, gain: 0.25 },
  'footstep-2': { src: `${SOUNDS}/Elemental/Grass2.wav`, gain: 0.25 },
};
