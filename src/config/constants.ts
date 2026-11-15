/** Fixed design width. Height varies per device between MIN_HEIGHT and MAX_HEIGHT. */
export const GAME_WIDTH = 720;
export const MIN_HEIGHT = 1280;
export const MAX_HEIGHT = 1600;

export const FONT_FAMILY = 'Lilita One';

export const COLORS = {
  text: '#ffffff',
  stroke: '#3a0f52',
  gold: '#ffd84a',
  goldDeep: '#ff9d1a',
  red: '#ff5a5a',
  pageBg: 0x2a0d3d,
  overlay: 0x12041c,
} as const;

/** Render order. Cups use DEPTH.cups + their y so lower (closer) cups draw on top. */
export const DEPTH = {
  bg: 0,
  magician: 10,
  cups: 100,
  fx: 4000,
  countdown: 4500,
  hud: 5000,
  popup: 8000,
  debug: 9500,
} as const;

/** HUD is anchored to the top of the screen. */
export const HUD_LAYOUT = {
  top: 18,
  height: 112,
} as const;

/** Animation timings in ms (shuffle timings come from level data). */
export const TIMING = {
  cupsAppearStagger: 70,
  cupsAppear: 380,
  lift: 360,
  drop: 300,
  revealHold: 1300,
  countdownStep: 560,
  afterResultHold: 950,
  popupIn: 420,
} as const;

/**
 * Look of the swap arcs. Values are Bezier control-point offsets; the path's actual peak
 * offset is half of that.
 */
export const SWAP_FX = {
  /** Row swaps: vertical bulge = distance * factor, clamped. Front cup dips, back cup rises. */
  bulgeFactor: 0.4,
  bulgeMin: 60,
  bulgeMax: 190,
  /**
   * Same-column swaps (grids) curve sideways in opposite directions. Offset = cup width * factor,
   * so at mid-swap the two cups are about one cup-width apart and never overlap.
   */
  sideBulgeCupFactor: 1.15,
  /** Front cup grows, back cup shrinks, by this fraction at mid-swap. */
  depthScale: 0.1,
} as const;
