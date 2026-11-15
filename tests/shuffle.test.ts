import { describe, expect, it } from 'vitest';
import { LAYOUTS, slotCell, slotCount, type LayoutId } from '../src/engine/layouts';
import { candidatePairs, finalItemSlot, generateShuffle, pairsCompatible } from '../src/engine/shuffle';
import { Rng } from '../src/engine/rng';
import type { ShuffleConfig, ShuffleScript, SwapRule } from '../src/engine/types';

const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

function config(layout: LayoutId, over: Partial<ShuffleConfig> = {}): ShuffleConfig {
  const rows = LAYOUTS[layout].rows;
  return {
    layout,
    items: [{ asset: 'fx_ball_gold', role: 'target' }],
    moves: 10,
    speed: { startMs: 600, endMs: 300 },
    simultaneousPairs: 1,
    pauseBetweenGroupsMs: 100,
    swapRule: rows === 1 ? 'any' : 'adjacent',
    targetBias: 0.5,
    ...over,
  };
}

/**
 * Independent re-implementation: follows each item by tracking its *slot* directly
 * (not via cupAtSlot), so a bug in the engine's bookkeeping cannot hide itself.
 */
function trackItemSlots(script: ShuffleScript): number[] {
  const slots = script.initial.itemCup.map((cup) => script.initial.cupAtSlot.indexOf(cup));
  for (const step of script.steps) {
    if (step.kind !== 'swapGroup') continue;
    for (let i = 0; i < slots.length; i++) {
      for (const p of step.pairs) {
        if (slots[i] === p.slotA) {
          slots[i] = p.slotB;
          break;
        }
        if (slots[i] === p.slotB) {
          slots[i] = p.slotA;
          break;
        }
      }
    }
  }
  return slots;
}

function randomConfig(rng: Rng): ShuffleConfig {
  const layout = rng.pick(LAYOUT_IDS);
  const n = slotCount(layout);
  const rows = LAYOUTS[layout].rows;
  const rules: SwapRule[] = rows === 1 ? ['adjacent', 'line', 'any'] : ['adjacent', 'line'];
  const itemCount = rng.int(1, Math.min(3, n));
  const items = Array.from({ length: itemCount }, (_, i) => ({
    asset: `item_${i}`,
    role: i === 0 ? ('target' as const) : ('decoy' as const),
  }));
  return config(layout, {
    items,
    moves: rng.int(1, 25),
    speed: { startMs: rng.int(200, 900), endMs: rng.int(150, 900) },
    simultaneousPairs: rng.int(1, Math.floor(n / 2)),
    pauseBetweenGroupsMs: rng.int(0, 300),
    swapRule: rng.pick(rules),
    targetBias: rng.next(),
    fakeoutChance: rng.chance(0.3) ? rng.next() * 0.5 : 0,
  });
}

describe('shuffle engine: item tracking', () => {
  it('tracks every item correctly across 3000 random configs and seeds', () => {
    const meta = new Rng('meta');
    for (let i = 0; i < 3000; i++) {
      const cfg = randomConfig(meta);
      const script = generateShuffle(cfg, `seed-${i}`);
      const expected = trackItemSlots(script);
      cfg.items.forEach((_, itemIndex) => {
        expect(finalItemSlot(script, itemIndex)).toBe(expected[itemIndex]);
      });
    }
  });

  it('keeps cupAtSlot a permutation and every item under exactly one distinct cup', () => {
    const meta = new Rng('perm');
    for (let i = 0; i < 1000; i++) {
      const cfg = randomConfig(meta);
      const script = generateShuffle(cfg, `p-${i}`);
      const n = slotCount(cfg.layout);
      expect([...script.final.cupAtSlot].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, k) => k));
      expect(new Set(script.final.itemCup).size).toBe(cfg.items.length);
      expect(script.final.itemCup).toEqual(script.initial.itemCup);
    }
  });

  it('fake-out steps never change state', () => {
    const cfg = config('row5', { moves: 30, fakeoutChance: 1 });
    const script = generateShuffle(cfg, 'fakeouts');
    expect(script.steps.some((s) => s.kind === 'fakeout')).toBe(true);
    const withoutFakeouts = { ...script, steps: script.steps.filter((s) => s.kind !== 'fakeout') };
    expect(trackItemSlots(withoutFakeouts)).toEqual(trackItemSlots(script));
  });
});

describe('shuffle engine: determinism', () => {
  it('same seed + same config gives exactly the same script', () => {
    for (const layout of LAYOUT_IDS) {
      const cfg = config(layout, { simultaneousPairs: Math.floor(slotCount(layout) / 2) });
      expect(generateShuffle(cfg, 'abc')).toEqual(generateShuffle(cfg, 'abc'));
    }
  });

  it('different seeds give different scripts', () => {
    const cfg = config('grid3x3', { moves: 12 });
    const a = JSON.stringify(generateShuffle(cfg, 'one').steps);
    const b = JSON.stringify(generateShuffle(cfg, 'two').steps);
    expect(a).not.toBe(b);
  });

  it('matches a stored snapshot (guards against accidental engine changes)', () => {
    const script = generateShuffle(config('row3', { moves: 4 }), 'snapshot');
    expect({ initial: script.initial, steps: script.steps, final: script.final }).toMatchSnapshot();
  });
});

describe('shuffle engine: step rules', () => {
  it('produces exactly `moves` swap groups with pauses between them', () => {
    const script = generateShuffle(config('row4', { moves: 7, pauseBetweenGroupsMs: 120 }), 's');
    const groups = script.steps.filter((s) => s.kind === 'swapGroup');
    const pauses = script.steps.filter((s) => s.kind === 'pause');
    expect(groups).toHaveLength(7);
    expect(pauses).toHaveLength(6);
    expect(pauses.every((p) => p.durationMs === 120)).toBe(true);
    expect(script.steps[script.steps.length - 1].kind).toBe('swapGroup');
  });

  it('ramps durations from start to end speed', () => {
    const script = generateShuffle(config('row3', { moves: 5, speed: { startMs: 900, endMs: 500 } }), 's');
    const durations = script.steps.filter((s) => s.kind === 'swapGroup').map((s) => s.durationMs);
    expect(durations).toEqual([900, 800, 700, 600, 500]);
  });

  it('totalDurationMs is the sum of all steps', () => {
    const script = generateShuffle(config('grid2x3'), 't');
    expect(script.totalDurationMs).toBe(script.steps.reduce((s, x) => s + x.durationMs, 0));
  });

  it('only uses pairs allowed by the swap rule', () => {
    const meta = new Rng('rules');
    for (let i = 0; i < 500; i++) {
      const cfg = randomConfig(meta);
      const allowed = new Set(candidatePairs(cfg.layout, cfg.swapRule).map(([a, b]) => `${a}-${b}`));
      for (const step of generateShuffle(cfg, `r-${i}`).steps) {
        if (step.kind !== 'swapGroup') continue;
        for (const p of step.pairs) {
          const key = `${Math.min(p.slotA, p.slotB)}-${Math.max(p.slotA, p.slotB)}`;
          expect(allowed.has(key)).toBe(true);
        }
      }
    }
  });

  it('simultaneous pairs never share a cup and never cross', () => {
    const meta = new Rng('simul');
    let multiGroups = 0;
    for (let i = 0; i < 1000; i++) {
      const cfg = randomConfig(meta);
      for (const step of generateShuffle(cfg, `s-${i}`).steps) {
        if (step.kind !== 'swapGroup') continue;
        expect(step.pairs.length).toBeLessThanOrEqual(cfg.simultaneousPairs);
        if (step.pairs.length > 1) multiGroups++;
        for (let a = 0; a < step.pairs.length; a++) {
          for (let b = a + 1; b < step.pairs.length; b++) {
            const p = step.pairs[a];
            const q = step.pairs[b];
            expect(pairsCompatible(cfg.layout, [p.slotA, p.slotB], [q.slotA, q.slotB])).toBe(true);
          }
        }
      }
    }
    expect(multiGroups).toBeGreaterThan(100);
  });

  it('in a single row, simultaneous pair spans are disjoint (no nesting or interleaving)', () => {
    expect(pairsCompatible('row5', [0, 1], [2, 3])).toBe(true);
    expect(pairsCompatible('row5', [0, 2], [1, 3])).toBe(false); // interleaved: would cross
    expect(pairsCompatible('row5', [0, 4], [1, 2])).toBe(false); // nested: would cross
    expect(pairsCompatible('row5', [0, 1], [1, 2])).toBe(false); // shared cup
  });

  it('in grids, neighbouring parallel swaps are not allowed at the same time', () => {
    // grid3x3 slots: row r, col c => r*3+c
    expect(pairsCompatible('grid3x3', [0, 3], [1, 4])).toBe(false); // vertical, adjacent columns
    expect(pairsCompatible('grid3x3', [0, 3], [2, 5])).toBe(true); // vertical, columns 0 and 2
    expect(pairsCompatible('grid3x3', [0, 1], [3, 4])).toBe(false); // horizontal, adjacent rows
    expect(pairsCompatible('grid3x3', [0, 1], [6, 7])).toBe(true); // horizontal, rows 0 and 2
  });

  it('never immediately repeats (undoes) a single swap', () => {
    const meta = new Rng('undo');
    for (let i = 0; i < 300; i++) {
      const cfg = { ...randomConfig(meta), simultaneousPairs: 1 };
      let prev = '';
      for (const step of generateShuffle(cfg, `u-${i}`).steps) {
        if (step.kind !== 'swapGroup') continue;
        const key = step.pairs.map((p) => `${p.slotA}-${p.slotB}`).join();
        expect(key).not.toBe(prev);
        prev = key;
      }
    }
  });

  it('grid adjacent pairs are horizontal or vertical neighbours only', () => {
    for (const [a, b] of candidatePairs('grid3x3', 'adjacent')) {
      const ca = slotCell('grid3x3', a);
      const cb = slotCell('grid3x3', b);
      expect(Math.abs(ca.row - cb.row) + Math.abs(ca.col - cb.col)).toBe(1);
    }
  });

  it('rejects invalid configs', () => {
    expect(() => generateShuffle(config('grid3x3', { swapRule: 'any' }), 'x')).toThrow();
    expect(() => generateShuffle(config('row3', { simultaneousPairs: 2 }), 'x')).toThrow();
    expect(() => generateShuffle(config('row3', { moves: 0 }), 'x')).toThrow();
    expect(() => generateShuffle(config('row3', { items: [] }), 'x')).toThrow();
  });
});
