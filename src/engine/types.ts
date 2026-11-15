import type { LayoutId } from './layouts';

/**
 * Which pairs of slots may swap:
 * - 'adjacent': direct neighbours in the same row or column
 * - 'line':     any two slots in the same row or the same column
 * - 'any':      any two slots (only allowed for single-row layouts)
 */
export type SwapRule = 'adjacent' | 'line' | 'any';

export type ItemRole = 'target' | 'decoy';

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
  /** Duration of one swap group; eased linearly from start to end across the round. */
  speed: { startMs: number; endMs: number };
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
