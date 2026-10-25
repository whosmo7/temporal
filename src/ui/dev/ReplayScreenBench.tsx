import { useMemo } from 'react';
import { ReplayViewer } from '../screens/ReplayScreen';
import { scriptedReplay } from './ReplayBench';

const PAGES = [
  'Sowed the near rows and watered what I could. Started on the reservoir wall, it will want more.',
  'Dug a well behind the house. The tree by the east fence is still small.',
  '',
];

/** `#/dev/replay-screen` (dev builds only): the whole replay screen on B's scripted three-generation world. */
export function ReplayScreenBench() {
  const replay = useMemo(() => {
    const r = scriptedReplay();
    return { ...r, journal: r.journal.map((p, i) => ({ ...p, text: PAGES[i] ?? '' })) };
  }, []);
  return <ReplayViewer replay={replay} />;
}
