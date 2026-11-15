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

  it('matches the balanced difficulty table', () => {
    // [layout, moves, startMs, endMs, pairs, pause, swapRule]
    const table: [string, number, number, number, number, number, string][] = [
      ['row3', 5, 800, 500, 1, 80, 'adjacent'],
      ['row3', 6, 750, 460, 1, 70, 'adjacent'],
      ['row3', 7, 700, 420, 1, 60, 'line'],
      ['row3', 8, 680, 400, 1, 60, 'line'],
      ['row4', 7, 720, 450, 1, 70, 'adjacent'],
      ['row4', 8, 680, 420, 1, 60, 'line'],
      ['row4', 9, 650, 390, 1, 50, 'line'],
      ['row5', 8, 700, 430, 1, 60, 'adjacent'],
      ['row5', 9, 660, 400, 1, 50, 'line'],
      ['row5', 10, 620, 370, 1, 50, 'line'],
      ['grid2x3', 9, 680, 420, 1, 60, 'adjacent'],
      ['grid2x3', 10, 640, 390, 1, 50, 'adjacent'],
      ['grid2x3', 11, 600, 360, 1, 50, 'adjacent'],
      ['grid3x3', 9, 680, 420, 1, 60, 'adjacent'],
      ['grid3x3', 10, 640, 390, 1, 50, 'adjacent'],
      ['grid3x3', 11, 600, 360, 1, 50, 'adjacent'],
      ['row4', 10, 620, 380, 2, 220, 'line'],
      ['row5', 11, 600, 360, 2, 200, 'line'],
      ['grid2x3', 11, 580, 350, 2, 200, 'adjacent'],
      ['grid3x3', 12, 560, 340, 3, 200, 'adjacent'],
    ];
    LEVELS.forEach((l, i) => {
      const [layout, moves, startMs, endMs, pairs, pause, rule] = table[i];
      expect([l.layout, l.moves, l.speed.startMs, l.speed.endMs, l.simultaneousPairs, l.pauseBetweenGroupsMs, l.swapRule]).toEqual([
        layout, moves, startMs, endMs, pairs, pause, rule,
      ]);
      expect(l.rampCurve).toBe('easeIn');
      expect(l.targetBias).toBe(0.5);
    });
  });

  it('every level speeds up during the round and stays within its start/end speed', () => {
    for (const level of LEVELS) {
      const d = generateShuffle(level, level.seed)
        .steps.filter((s) => s.kind === 'swapGroup')
        .map((s) => s.durationMs);
      expect(d[0]).toBe(level.speed.startMs);
      expect(d[d.length - 1]).toBe(level.speed.endMs);
      for (const x of d) {
        expect(x).toBeLessThanOrEqual(level.speed.startMs);
        expect(x).toBeGreaterThanOrEqual(level.speed.endMs);
      }
    }
  });

  it('uses several cup types and introduces simultaneous swaps late', () => {
    expect(new Set(LEVELS.map((l) => l.cup)).size).toBeGreaterThanOrEqual(5);
    const firstMulti = LEVELS.findIndex((l) => l.simultaneousPairs > 1);
    expect(firstMulti).toBeGreaterThanOrEqual(15);
  });
});
