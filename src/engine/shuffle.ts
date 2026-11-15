import { LAYOUTS, slotCell, slotCount, type LayoutId } from './layouts';
import { Rng } from './rng';
import type { RampCurve, RoundSnapshot, ShuffleConfig, ShuffleScript, ShuffleStep, SwapPair, SwapRule } from './types';

export const DEFAULT_RAMP_CURVE: RampCurve = 'easeIn';

const RAMP: Record<RampCurve, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeInStrong: (t) => t * t * t,
};

/** Duration of swap group `index` (0-based) out of `moves`, following the ramp curve. */
export function rampDuration(
  speed: { startMs: number; endMs: number },
  index: number,
  moves: number,
  curve: RampCurve = DEFAULT_RAMP_CURVE,
): number {
  const t = moves > 1 ? index / (moves - 1) : 0;
  return Math.round(speed.startMs + (speed.endMs - speed.startMs) * RAMP[curve](t));
}

type Pair = readonly [number, number];

interface Box {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

/** All slot pairs (a < b) allowed by the swap rule. */
export function candidatePairs(layout: LayoutId, rule: SwapRule): Pair[] {
  if (rule === 'any' && LAYOUTS[layout].rows > 1) {
    throw new Error(`swapRule 'any' is only allowed for single-row layouts (got ${layout})`);
  }
  const n = slotCount(layout);
  const out: Pair[] = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const ca = slotCell(layout, a);
      const cb = slotCell(layout, b);
      const dr = Math.abs(ca.row - cb.row);
      const dc = Math.abs(ca.col - cb.col);
      const sameLine = dr === 0 || dc === 0;
      if (rule === 'adjacent' && dr + dc === 1) out.push([a, b]);
      else if (rule === 'line' && sameLine) out.push([a, b]);
      else if (rule === 'any') out.push([a, b]);
    }
  }
  return out;
}

function rawBox(layout: LayoutId, [a, b]: Pair): Box {
  const ca = slotCell(layout, a);
  const cb = slotCell(layout, b);
  return {
    r0: Math.min(ca.row, cb.row),
    r1: Math.max(ca.row, cb.row),
    c0: Math.min(ca.col, cb.col),
    c1: Math.max(ca.col, cb.col),
  };
}

/**
 * The area a swap's arcs can sweep through: its cells, widened by one cell on
 * both sides perpendicular to the swap (the front cup bulges one way, the back
 * cup the other). Horizontal swaps bulge into neighbouring rows, vertical swaps
 * (same column) bulge sideways into neighbouring columns.
 */
function sweptBox(layout: LayoutId, pair: Pair): Box {
  const box = rawBox(layout, pair);
  const horizontal = box.r0 === box.r1;
  const vertical = box.c0 === box.c1;
  if (horizontal || !vertical) {
    box.r0 -= 1;
    box.r1 += 1;
  }
  if (vertical || !horizontal) {
    box.c0 -= 1;
    box.c1 += 1;
  }
  return box;
}

function overlaps(a: Box, b: Box): boolean {
  return a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
}

/**
 * Two pairs may swap at the same time only if neither one's swept area touches
 * the other's cells. In a single row this means their spans are disjoint, so
 * simultaneous arcs never cross.
 */
export function pairsCompatible(layout: LayoutId, p: Pair, q: Pair): boolean {
  if (p[0] === q[0] || p[0] === q[1] || p[1] === q[0] || p[1] === q[1]) return false;
  return (
    !overlaps(sweptBox(layout, p), rawBox(layout, q)) && !overlaps(sweptBox(layout, q), rawBox(layout, p))
  );
}

/** Applies one step to a cupAtSlot array in place. */
export function applyStep(cupAtSlot: number[], step: ShuffleStep): void {
  if (step.kind !== 'swapGroup') return;
  for (const { slotA, slotB } of step.pairs) {
    const t = cupAtSlot[slotA];
    cupAtSlot[slotA] = cupAtSlot[slotB];
    cupAtSlot[slotB] = t;
  }
}

export function slotOfCup(cupAtSlot: readonly number[], cup: number): number {
  const slot = cupAtSlot.indexOf(cup);
  if (slot < 0) throw new Error(`Cup ${cup} not found`);
  return slot;
}

function samePair(a: Pair, b: Pair): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function validateShuffleConfig(cfg: ShuffleConfig): void {
  const n = slotCount(cfg.layout);
  const fail = (msg: string) => {
    throw new Error(`Invalid shuffle config: ${msg}`);
  };
  if (cfg.items.length < 1) fail('needs at least one item');
  if (cfg.items.length > n) fail(`${cfg.items.length} items but only ${n} cups`);
  if (!cfg.items.some((i) => i.role === 'target')) fail('needs a target item');
  if (!Number.isInteger(cfg.moves) || cfg.moves < 1) fail('moves must be an integer >= 1');
  if (cfg.speed.startMs <= 0 || cfg.speed.endMs <= 0) fail('speed must be > 0');
  if (!Number.isInteger(cfg.simultaneousPairs) || cfg.simultaneousPairs < 1) fail('simultaneousPairs must be >= 1');
  if (cfg.simultaneousPairs > Math.floor(n / 2)) fail('simultaneousPairs too large for cup count');
  if (cfg.pauseBetweenGroupsMs < 0) fail('pauseBetweenGroupsMs must be >= 0');
  if (cfg.targetBias < 0 || cfg.targetBias > 1) fail('targetBias must be 0..1');
  if (cfg.rampCurve !== undefined && !['linear', 'easeIn', 'easeInStrong'].includes(cfg.rampCurve)) {
    fail(`unknown rampCurve '${cfg.rampCurve}'`);
  }
  const fc = cfg.fakeoutChance ?? 0;
  if (fc < 0 || fc > 1) fail('fakeoutChance must be 0..1');
  candidatePairs(cfg.layout, cfg.swapRule); // throws for invalid rule/layout combos
}

/**
 * Generates a deterministic shuffle: same config + same seed = same script.
 * Cup i starts at slot i. Items are hidden under random cups and travel with them.
 */
export function generateShuffle(cfg: ShuffleConfig, seed: string): ShuffleScript {
  validateShuffleConfig(cfg);
  const rng = new Rng(seed);
  const n = slotCount(cfg.layout);
  const all = candidatePairs(cfg.layout, cfg.swapRule);

  const cupAtSlot = Array.from({ length: n }, (_, i) => i);
  const itemCup = rng.shuffle(cupAtSlot).slice(0, cfg.items.length);
  const initial: RoundSnapshot = { cupAtSlot: cupAtSlot.slice(), itemCup: itemCup.slice() };
  const targetCup = itemCup[cfg.items.findIndex((i) => i.role === 'target')];

  const steps: ShuffleStep[] = [];
  let prevGroup: Pair[] = [];
  const fakeoutChance = cfg.fakeoutChance ?? 0;

  for (let g = 0; g < cfg.moves; g++) {
    const durationMs = rampDuration(cfg.speed, g, cfg.moves, cfg.rampCurve);

    // Never immediately undo a single swap.
    const notUndo = (p: Pair) => !(prevGroup.length === 1 && samePair(prevGroup[0], p));
    let pool = all.filter(notUndo);
    if (pool.length === 0) pool = all;

    const targetSlot = slotOfCup(cupAtSlot, targetCup);
    const involving = pool.filter((p) => p[0] === targetSlot || p[1] === targetSlot);
    const first = involving.length > 0 && rng.chance(cfg.targetBias) ? rng.pick(involving) : rng.pick(pool);

    const wanted =
      cfg.simultaneousPairs > 1
        ? rng.chance(0.65)
          ? cfg.simultaneousPairs
          : rng.int(1, cfg.simultaneousPairs)
        : 1;
    const group: Pair[] = [first];
    while (group.length < wanted) {
      const options = all.filter((p) => group.every((q) => pairsCompatible(cfg.layout, p, q)));
      if (options.length === 0) break;
      group.push(rng.pick(options));
    }

    if (fakeoutChance > 0 && rng.chance(fakeoutChance)) {
      const fp = rng.pick(all);
      steps.push({
        kind: 'fakeout',
        pair: { slotA: fp[0], slotB: fp[1], front: rng.chance(0.5) ? 'A' : 'B' },
        durationMs: Math.round(durationMs * 0.8),
      });
    }

    const pairs: SwapPair[] = group.map(([a, b]) => ({ slotA: a, slotB: b, front: rng.chance(0.5) ? 'A' : 'B' }));
    const step: ShuffleStep = { kind: 'swapGroup', pairs, durationMs };
    applyStep(cupAtSlot, step);
    steps.push(step);
    prevGroup = group;

    if (g < cfg.moves - 1 && cfg.pauseBetweenGroupsMs > 0) {
      steps.push({ kind: 'pause', durationMs: cfg.pauseBetweenGroupsMs });
    }
  }

  return {
    seed,
    layout: cfg.layout,
    initial,
    steps,
    final: { cupAtSlot: cupAtSlot.slice(), itemCup: itemCup.slice() },
    totalDurationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
  };
}

/** Slot where an item ends up after the whole shuffle. */
export function finalItemSlot(script: ShuffleScript, itemIndex: number): number {
  return slotOfCup(script.final.cupAtSlot, script.final.itemCup[itemIndex]);
}
