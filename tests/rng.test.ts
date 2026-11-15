import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng('hello');
    const b = new Rng('hello');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs for different seeds', () => {
    const a = new Rng('a');
    const b = new Rng('b');
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it('stays in range and is roughly uniform', () => {
    const r = new Rng(42);
    const buckets = [0, 0, 0, 0, 0];
    for (let i = 0; i < 50000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      buckets[r.int(0, 4)]++;
    }
    for (const b of buckets) expect(b).toBeGreaterThan(9000);
  });

  it('shuffle returns a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = new Rng('s').shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });
});
