/**
 * Cup layouts as a logical grid of slots. Slot index = row * cols + col,
 * row 0 is the back row (furthest from the viewer). Pixel positions live in the
 * Phaser layer (src/game/StageLayout.ts); the engine only needs rows/cols.
 */

export type LayoutId = 'row3' | 'row4' | 'row5' | 'grid2x3' | 'grid3x3';

export interface LayoutSpec {
  readonly id: LayoutId;
  readonly rows: number;
  readonly cols: number;
}

export const LAYOUTS: Readonly<Record<LayoutId, LayoutSpec>> = {
  row3: { id: 'row3', rows: 1, cols: 3 },
  row4: { id: 'row4', rows: 1, cols: 4 },
  row5: { id: 'row5', rows: 1, cols: 5 },
  grid2x3: { id: 'grid2x3', rows: 2, cols: 3 },
  grid3x3: { id: 'grid3x3', rows: 3, cols: 3 },
};

export interface Cell {
  row: number;
  col: number;
}

export function slotCount(layout: LayoutId): number {
  const l = LAYOUTS[layout];
  return l.rows * l.cols;
}

export function slotCell(layout: LayoutId, slot: number): Cell {
  const { cols } = LAYOUTS[layout];
  return { row: Math.floor(slot / cols), col: slot % cols };
}

export function slotIndex(layout: LayoutId, row: number, col: number): number {
  return row * LAYOUTS[layout].cols + col;
}
