import { useEffect, useRef } from 'react';
import { mountWorldgenDebug } from './worldgenDebug';

/** `#/dev/worldgen?seed=123&biome=island`: the worldgen debug page (03). Dev builds only. */
export function WorldgenScreen() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => mountWorldgenDebug(root.current!), []);
  return <div ref={root} />;
}
