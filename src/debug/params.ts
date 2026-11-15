import { LEVEL_COUNT } from '../levels/levels';

/** Dev only: ?level=N jumps straight into level N. Always null in production builds. */
export function debugStartLevel(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('level');
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) {
    console.warn(`?level=${raw} ignored (valid: 1-${LEVEL_COUNT})`);
    return null;
  }
  return n;
}
