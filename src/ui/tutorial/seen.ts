// Whether this browser has seen "How to play", so it opens by itself only on the first day.
// Storage can be missing or blocked; then it opens every time, which is the safe side.

const KEY = 'inheritance.howToPlaySeen';

export const seenHowToPlay = {
  get(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  },
  set(): void {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // nothing to remember it in
    }
  },
};
