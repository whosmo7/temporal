// The world this player last committed on this device (decision 016). claim_world gets it as a
// hint to avoid, so a player isn't handed back the world they just finished. Client-side only:
// another device, or cleared storage, forgets it, which is fine (repeat play is allowed).

const key = (userId: string) => `inheritance.lastWorld.${userId}`;

export function getLastWorld(userId: string): string | null {
  try {
    return localStorage.getItem(key(userId));
  } catch {
    return null;
  }
}

export function setLastWorld(userId: string, worldId: string): void {
  try {
    localStorage.setItem(key(userId), worldId);
  } catch {
    // Storage blocked: the hint is optional.
  }
}
