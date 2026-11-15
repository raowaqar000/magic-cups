import type { LevelConfig, RampCurve, SwapRule } from '../engine/types';
import type { LayoutId } from '../engine/layouts';

/**
 * Phase 1 levels. Pure data: tweak numbers here, no code changes needed.
 *
 * Difficulty goal: levels 1-10 are winnable on the first or second try by most players,
 * the real challenge starts around 15, and level 20 is hard but fair.
 *
 * speed = duration of one swap in ms (lower = faster), from the first swap to the last.
 *         The ramp follows `rampCurve` ('easeIn' = slow early swaps, faster finish).
 * moves = number of swap groups. With pairs > 1 a group can move several pairs at once.
 * rule  = 'adjacent': neighbours only (in grids: same row or column neighbours)
 *         'row':      any two cups in the same row (arcs over/under the cups between)
 */

const BALL = [{ asset: 'fx_ball_gold', role: 'target' as const }];

type Rule = 'adjacent' | 'row';

/** Level-table rule names -> engine swap rules. */
const RULE: Record<Rule, SwapRule> = {
  adjacent: 'adjacent',
  row: 'line',
};

const DEFAULT_RAMP: RampCurve = 'easeIn';
const DEFAULT_TARGET_BIAS = 0.5;

interface Row {
  layout: LayoutId;
  cup: string;
  moves: number;
  start: number;
  end: number;
  pairs: number;
  pause: number;
  rule: Rule;
}

// prettier-ignore
const ROWS: Row[] = [
  /*  1 */ { layout: 'row3',    cup: 'cup_01_hat_red',     moves: 5,  start: 800, end: 500, pairs: 1, pause: 80,  rule: 'adjacent' },
  /*  2 */ { layout: 'row3',    cup: 'cup_01_hat_red',     moves: 6,  start: 750, end: 460, pairs: 1, pause: 70,  rule: 'adjacent' },
  /*  3 */ { layout: 'row3',    cup: 'cup_02_cup_teal',    moves: 7,  start: 700, end: 420, pairs: 1, pause: 60,  rule: 'row' },
  /*  4 */ { layout: 'row3',    cup: 'cup_01_hat_red',     moves: 8,  start: 680, end: 400, pairs: 1, pause: 60,  rule: 'row' },
  /*  5 */ { layout: 'row4',    cup: 'cup_01_hat_red',     moves: 7,  start: 720, end: 450, pairs: 1, pause: 70,  rule: 'adjacent' },
  /*  6 */ { layout: 'row4',    cup: 'cup_03_chest',       moves: 8,  start: 680, end: 420, pairs: 1, pause: 60,  rule: 'row' },
  /*  7 */ { layout: 'row4',    cup: 'cup_01_hat_red',     moves: 9,  start: 650, end: 390, pairs: 1, pause: 50,  rule: 'row' },
  /*  8 */ { layout: 'row5',    cup: 'cup_01_hat_red',     moves: 8,  start: 700, end: 430, pairs: 1, pause: 60,  rule: 'adjacent' },
  /*  9 */ { layout: 'row5',    cup: 'cup_04_giftbox',     moves: 9,  start: 660, end: 400, pairs: 1, pause: 50,  rule: 'row' },
  /* 10 */ { layout: 'row5',    cup: 'cup_01_hat_red',     moves: 10, start: 620, end: 370, pairs: 1, pause: 50,  rule: 'row' },
  /* 11 */ { layout: 'grid2x3', cup: 'cup_01_hat_red',     moves: 9,  start: 680, end: 420, pairs: 1, pause: 60,  rule: 'adjacent' },
  /* 12 */ { layout: 'grid2x3', cup: 'cup_07_mug',         moves: 10, start: 640, end: 390, pairs: 1, pause: 50,  rule: 'adjacent' },
  /* 13 */ { layout: 'grid2x3', cup: 'cup_01_hat_red',     moves: 11, start: 600, end: 360, pairs: 1, pause: 50,  rule: 'adjacent' },
  /* 14 */ { layout: 'grid3x3', cup: 'cup_01_hat_red',     moves: 9,  start: 680, end: 420, pairs: 1, pause: 60,  rule: 'adjacent' },
  /* 15 */ { layout: 'grid3x3', cup: 'cup_09_bell',        moves: 10, start: 640, end: 390, pairs: 1, pause: 50,  rule: 'adjacent' },
  /* 16 */ { layout: 'grid3x3', cup: 'cup_01_hat_red',     moves: 11, start: 600, end: 360, pairs: 1, pause: 50,  rule: 'adjacent' },
  /* 17 */ { layout: 'row4',    cup: 'cup_10_cloche',      moves: 10, start: 620, end: 380, pairs: 2, pause: 220, rule: 'row' },
  /* 18 */ { layout: 'row5',    cup: 'cup_01_hat_red',     moves: 11, start: 600, end: 360, pairs: 2, pause: 200, rule: 'row' },
  /* 19 */ { layout: 'grid2x3', cup: 'cup_08_flowerpot',   moves: 11, start: 580, end: 350, pairs: 2, pause: 200, rule: 'adjacent' },
  /* 20 */ { layout: 'grid3x3', cup: 'cup_05_mystery_box', moves: 12, start: 560, end: 340, pairs: 3, pause: 200, rule: 'adjacent' },
];

export const LEVELS: readonly LevelConfig[] = ROWS.map((r, i) => ({
  id: i + 1,
  layout: r.layout,
  cup: r.cup,
  items: BALL,
  moves: r.moves,
  speed: { startMs: r.start, endMs: r.end },
  rampCurve: DEFAULT_RAMP,
  simultaneousPairs: r.pairs,
  pauseBetweenGroupsMs: r.pause,
  swapRule: RULE[r.rule],
  targetBias: DEFAULT_TARGET_BIAS,
  seed: `L${String(i + 1).padStart(3, '0')}`,
}));

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): LevelConfig {
  const level = LEVELS[id - 1];
  if (!level) throw new Error(`No level ${id}`);
  return level;
}
