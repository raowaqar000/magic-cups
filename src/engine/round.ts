import { slotOfCup } from './shuffle';
import type { LevelConfig, ShuffleScript } from './types';

export const MAX_HEARTS = 3;
export const COINS_PER_STAR = 10;

export type Stars = 0 | 1 | 2 | 3;

/** 3 stars on the first try, 2 on the second, 1 on the third or later. */
export function starsForAttempt(attempt: number): 1 | 2 | 3 {
  if (attempt <= 1) return 3;
  if (attempt === 2) return 2;
  return 1;
}

/** First win pays 10 per star; replays only pay for stars above the previous best. */
export function coinsForWin(newStars: number, previousBest: number): number {
  return Math.max(0, newStars - previousBest) * COINS_PER_STAR;
}

/** Each round of a level gets its own deterministic seed so retries are not identical. */
export function roundSeed(levelSeed: string, roundIndex: number): string {
  return `${levelSeed}#${roundIndex}`;
}

export function targetItemIndex(level: Pick<LevelConfig, 'items'>): number {
  return level.items.findIndex((i) => i.role === 'target');
}

export interface PickResult {
  correct: boolean;
  pickedSlot: number;
  pickedCup: number;
  targetSlot: number;
  targetCup: number;
  /** Stars earned (only when correct). */
  stars: Stars;
  heartsLeft: number;
  gameOver: boolean;
}

/** Hearts, attempts and round seeds for one level being played. Pure logic, no rendering. */
export class LevelSession {
  hearts = MAX_HEARTS;
  /** 1-based attempt number for the current round. */
  attempt = 1;
  /** Counts every round started in this session (never reset, so retries get new seeds). */
  roundIndex = 0;

  constructor(readonly level: LevelConfig) {}

  nextRoundSeed(): string {
    return roundSeed(this.level.seed, this.roundIndex++);
  }

  resolvePick(slot: number, script: ShuffleScript): PickResult {
    const targetCup = script.final.itemCup[targetItemIndex(this.level)];
    const targetSlot = slotOfCup(script.final.cupAtSlot, targetCup);
    const pickedCup = script.final.cupAtSlot[slot];
    const correct = slot === targetSlot;
    let stars: Stars = 0;
    if (correct) {
      stars = starsForAttempt(this.attempt);
    } else {
      this.hearts = Math.max(0, this.hearts - 1);
      this.attempt++;
    }
    return {
      correct,
      pickedSlot: slot,
      pickedCup,
      targetSlot,
      targetCup,
      stars,
      heartsLeft: this.hearts,
      gameOver: this.hearts === 0,
    };
  }

  /** Rewarded-ad placeholder: +1 heart. */
  addHeart(): void {
    this.hearts = Math.min(MAX_HEARTS, this.hearts + 1);
  }

  /** "Try again" after game over or "Restart" from pause: full hearts, first attempt. */
  restart(): void {
    this.hearts = MAX_HEARTS;
    this.attempt = 1;
  }
}
