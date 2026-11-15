import { describe, expect, it } from 'vitest';
import meta from '../src/assets/assetMeta.json';
import { slotCount } from '../src/engine/layouts';
import { generateShuffle, validateShuffleConfig } from '../src/engine/shuffle';
import { LEVELS } from '../src/levels/levels';

const assetKeys = new Set(Object.keys(meta));

describe('levels', () => {
  it('has 20 levels with sequential ids and unique seeds', () => {
    expect(LEVELS).toHaveLength(20);
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
    expect(new Set(LEVELS.map((l) => l.seed)).size).toBe(LEVELS.length);
  });

  it('every level config is valid and generates a shuffle', () => {
    for (const level of LEVELS) {
      expect(() => validateShuffleConfig(level)).not.toThrow();
      const script = generateShuffle(level, level.seed);
      expect(script.steps.filter((s) => s.kind === 'swapGroup')).toHaveLength(level.moves);
    }
  });

  it('references assets that exist', () => {
    for (const level of LEVELS) {
      expect(assetKeys.has(level.cup), `level ${level.id} cup ${level.cup}`).toBe(true);
      expect(level.cup.startsWith('cup_')).toBe(true);
      for (const item of level.items) expect(assetKeys.has(item.asset), item.asset).toBe(true);
    }
  });

  it('difficulty does not drop much from one level to the next', () => {
    // Rough difficulty score: cups x moves x pairs / speed. Layout jumps may reset it a bit.
    const score = (l: (typeof LEVELS)[number]) =>
      (slotCount(l.layout) * l.moves * l.simultaneousPairs) / ((l.speed.startMs + l.speed.endMs) / 2);
    const scores = LEVELS.map(score);
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1] * 0.5);
    expect(scores[19]).toBeGreaterThan(scores[0] * 10);
  });

  it('uses several cup types and introduces simultaneous swaps late', () => {
    expect(new Set(LEVELS.map((l) => l.cup)).size).toBeGreaterThanOrEqual(5);
    const firstMulti = LEVELS.findIndex((l) => l.simultaneousPairs > 1);
    expect(firstMulti).toBeGreaterThanOrEqual(15);
  });
});
