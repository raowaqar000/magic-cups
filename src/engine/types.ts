import type { LayoutId } from './layouts';

/**
 * Which pairs of slots may swap:
 * - 'adjacent': direct neighbours in the same row or column
 * - 'line':     any two slots in the same row or the same column
 * - 'any':      any two slots (only allowed for single-row layouts)
 */
export type SwapRule = 'adjacent' | 'line' | 'any';

export type ItemRole = 'target' | 'decoy';

/**
 * How swap duration moves from speed.startMs to speed.endMs across the round:
 * - 'linear':       even steps
 * - 'easeIn':       t^2, early swaps stay slow, speed-up comes at the end (default)
 * - 'easeInStrong': t^3, even longer slow start, sharper finish
 */
export type RampCurve = 'linear' | 'easeIn' | 'easeInStrong';

export interface ItemSpec {
  /** Asset key of the item image (e.g. 'fx_ball_gold'). */
  asset: string;
  role: ItemRole;
}

/** Everything the shuffle engine needs. A level is a superset of this. */
export interface ShuffleConfig {
  layout: LayoutId;
  items: ItemSpec[];
  /** Number of swap groups (a group = 1..simultaneousPairs swaps played at the same time). */
  moves: number;
  /** Duration of one swap group, from start to end of the round (lower = faster). */
  speed: { startMs: number; endMs: number };
  /** Shape of the speed ramp over the move index. Default 'easeIn'. */
  rampCurve?: RampCurve;
  /** Max pairs swapping at the same time. 1 = classic one-at-a-time. */
  simultaneousPairs: number;
  /** Pause inserted between groups (0 = none). */
  pauseBetweenGroupsMs: number;
  swapRule: SwapRule;
  /** 0..1: probability that a group's first pair involves the cup hiding the target. */
  targetBias: number;
  /** 0..1: probability of a fake-out move before a group (Phase 3). Default 0. */
  fakeoutChance?: number;
}

export interface LevelConfig extends ShuffleConfig {
  id: number;
  /** Asset key of the cup image. */
  cup: string;
  /** Base seed; each round derives its own seed from this (see roundSeed). */
  seed: string;
}

export interface SwapPair {
  slotA: number;
  slotB: number;
  /** Which of the two cups passes in front (lower on screen, bigger). */
  front: 'A' | 'B';
}

export type ShuffleStep =
  | { kind: 'swapGroup'; pairs: SwapPair[]; durationMs: number }
  | { kind: 'pause'; durationMs: number }
  /** Cups start to swap and return to where they were. Does not change state. */
  | { kind: 'fakeout'; pair: SwapPair; durationMs: number };

export interface RoundSnapshot {
  /** cupAtSlot[slot] = cup id. Cups are numbered 0..n-1 and start at slot = id. */
  cupAtSlot: number[];
  /** itemCup[itemIndex] = cup id hiding that item. Items never change cups. */
  itemCup: number[];
}

export interface ShuffleScript {
  seed: string;
  layout: LayoutId;
  initial: RoundSnapshot;
  steps: ShuffleStep[];
  final: RoundSnapshot;
  totalDurationMs: number;
}
