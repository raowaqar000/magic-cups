import type { LevelConfig, SwapRule } from '../engine/types';
import type { LayoutId } from '../engine/layouts';

/**
 * Phase 1 levels. Pure data: tweak numbers here, no code changes needed.
 *
 * speed = duration of one swap group in ms (lower = faster), eased start -> end across the round.
 * moves = number of swap groups. With simultaneousPairs > 1 a group can move several pairs at once.
 */

const BALL = [{ asset: 'fx_ball_gold', role: 'target' as const }];

interface Row {
  layout: LayoutId;
  cup: string;
  moves: number;
  start: number;
  end: number;
  pairs?: number;
  pause: number;
  rule: SwapRule;
  bias: number;
}

const ROWS: Row[] = [
  /*  1 */ { layout: 'row3', cup: 'cup_01_hat_red', moves: 3, start: 900, end: 900, pause: 150, rule: 'adjacent', bias: 0.7 },
  /*  2 */ { layout: 'row3', cup: 'cup_01_hat_red', moves: 4, start: 850, end: 750, pause: 120, rule: 'adjacent', bias: 0.6 },
  /*  3 */ { layout: 'row3', cup: 'cup_02_cup_teal', moves: 5, start: 750, end: 600, pause: 100, rule: 'any', bias: 0.6 },
  /*  4 */ { layout: 'row3', cup: 'cup_01_hat_red', moves: 6, start: 650, end: 500, pause: 80, rule: 'any', bias: 0.55 },
  /*  5 */ { layout: 'row4', cup: 'cup_01_hat_red', moves: 5, start: 750, end: 600, pause: 100, rule: 'adjacent', bias: 0.6 },
  /*  6 */ { layout: 'row4', cup: 'cup_03_chest', moves: 6, start: 650, end: 500, pause: 80, rule: 'any', bias: 0.55 },
  /*  7 */ { layout: 'row4', cup: 'cup_01_hat_red', moves: 8, start: 600, end: 420, pause: 60, rule: 'any', bias: 0.5 },
  /*  8 */ { layout: 'row5', cup: 'cup_01_hat_red', moves: 6, start: 650, end: 500, pause: 80, rule: 'adjacent', bias: 0.55 },
  /*  9 */ { layout: 'row5', cup: 'cup_04_giftbox', moves: 8, start: 550, end: 400, pause: 60, rule: 'any', bias: 0.5 },
  /* 10 */ { layout: 'row5', cup: 'cup_01_hat_red', moves: 10, start: 500, end: 350, pause: 50, rule: 'any', bias: 0.5 },
  /* 11 */ { layout: 'grid2x3', cup: 'cup_01_hat_red', moves: 7, start: 600, end: 450, pause: 80, rule: 'adjacent', bias: 0.55 },
  /* 12 */ { layout: 'grid2x3', cup: 'cup_07_mug', moves: 9, start: 520, end: 380, pause: 60, rule: 'adjacent', bias: 0.5 },
  /* 13 */ { layout: 'grid2x3', cup: 'cup_01_hat_red', moves: 11, start: 460, end: 330, pause: 50, rule: 'adjacent', bias: 0.5 },
  /* 14 */ { layout: 'grid3x3', cup: 'cup_01_hat_red', moves: 8, start: 560, end: 420, pause: 80, rule: 'adjacent', bias: 0.55 },
  /* 15 */ { layout: 'grid3x3', cup: 'cup_09_bell', moves: 10, start: 480, end: 350, pause: 60, rule: 'adjacent', bias: 0.5 },
  /* 16 */ { layout: 'grid3x3', cup: 'cup_01_hat_red', moves: 12, start: 420, end: 300, pause: 50, rule: 'adjacent', bias: 0.5 },
  /* 17 */ { layout: 'row4', cup: 'cup_10_cloche', moves: 9, start: 480, end: 360, pairs: 2, pause: 250, rule: 'adjacent', bias: 0.5 },
  /* 18 */ { layout: 'row5', cup: 'cup_01_hat_red', moves: 10, start: 420, end: 300, pairs: 2, pause: 220, rule: 'adjacent', bias: 0.5 },
  /* 19 */ { layout: 'grid2x3', cup: 'cup_08_flowerpot', moves: 11, start: 400, end: 280, pairs: 2, pause: 200, rule: 'adjacent', bias: 0.5 },
  /* 20 */ { layout: 'grid3x3', cup: 'cup_05_mystery_box', moves: 12, start: 380, end: 260, pairs: 3, pause: 200, rule: 'adjacent', bias: 0.5 },
];

export const LEVELS: readonly LevelConfig[] = ROWS.map((r, i) => ({
  id: i + 1,
  layout: r.layout,
  cup: r.cup,
  items: BALL,
  moves: r.moves,
  speed: { startMs: r.start, endMs: r.end },
  simultaneousPairs: r.pairs ?? 1,
  pauseBetweenGroupsMs: r.pause,
  swapRule: r.rule,
  targetBias: r.bias,
  seed: `L${String(i + 1).padStart(3, '0')}`,
}));

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id: number): LevelConfig {
  const level = LEVELS[id - 1];
  if (!level) throw new Error(`No level ${id}`);
  return level;
}
