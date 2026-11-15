import { ASSET, assetInfo } from '../assets/manifest';
import { GAME_WIDTH } from '../config/constants';
import { LAYOUTS, slotCell, slotCount, type LayoutId } from '../engine/layouts';
import { Hud } from '../ui/Hud';

/** Where a cup stands: (x, y) is the point where the cup touches the floor. */
export interface SlotGeom {
  x: number;
  y: number;
  /** Perspective scale: back rows are smaller. */
  scale: number;
  row: number;
  col: number;
}

interface LayoutLook {
  /** Cup width (visible content) in the front row. */
  cupW: number;
  /** Horizontal distance between cup centres in the front row. */
  spacingX: number;
  /** Cup floor y per row, as a fraction of the floor rect (0 = floor top, 1 = floor front edge). */
  rowsY: number[];
  /** Scale of the back row (front row is 1). */
  backScale: number;
}

const LOOK: Record<LayoutId, LayoutLook> = {
  row3: { cupW: 196, spacingX: 222, rowsY: [0.6], backScale: 1 },
  row4: { cupW: 150, spacingX: 168, rowsY: [0.6], backScale: 1 },
  row5: { cupW: 120, spacingX: 134, rowsY: [0.6], backScale: 1 },
  grid2x3: { cupW: 156, spacingX: 205, rowsY: [0.42, 0.88], backScale: 0.86 },
  grid3x3: { cupW: 138, spacingX: 192, rowsY: [0.31, 0.62, 0.93], backScale: 0.8 },
};

// Floor of ui_29_bg_stage in source pixels (1024x1536): wooden floor from the back
// wall line to just above the gold front edge.
const BG_FLOOR_TOP = 925;
const BG_FLOOR_FRONT = 1455;

/**
 * Screen geometry for a given game height. The background covers the screen and is
 * anchored to the bottom, so the floor stays at the bottom on every phone; the HUD
 * is anchored to the top; the magician zone stretches in between.
 */
export class StageLayout {
  readonly width = GAME_WIDTH;
  readonly bgScale: number;
  readonly floorTop: number;
  readonly floorFront: number;
  /** Reserved for the Phase 2 magician. */
  readonly magicianZone: { top: number; bottom: number };

  constructor(readonly height: number) {
    const bg = assetInfo(ASSET.bgStage);
    this.bgScale = Math.max(GAME_WIDTH / bg.w, height / bg.h);
    this.floorTop = height - (bg.h - BG_FLOOR_TOP) * this.bgScale;
    this.floorFront = height - (bg.h - BG_FLOOR_FRONT) * this.bgScale;
    this.magicianZone = { top: Hud.bottom + 10, bottom: this.floorTop - 40 };
  }

  get floorHeight(): number {
    return this.floorFront - this.floorTop;
  }

  cupWidth(layout: LayoutId): number {
    return LOOK[layout].cupW;
  }

  slots(layout: LayoutId): SlotGeom[] {
    const look = LOOK[layout];
    const { rows, cols } = LAYOUTS[layout];
    const cx = this.width / 2;
    return Array.from({ length: slotCount(layout) }, (_, slot) => {
      const { row, col } = slotCell(layout, slot);
      const depthT = rows > 1 ? row / (rows - 1) : 1;
      const scale = look.backScale + (1 - look.backScale) * depthT;
      return {
        x: cx + (col - (cols - 1) / 2) * look.spacingX * scale,
        y: this.floorTop + this.floorHeight * look.rowsY[row],
        scale,
        row,
        col,
      };
    });
  }

  /** Where the countdown and big messages appear: just above the cups. */
  get messageY(): number {
    return this.floorTop - 70;
  }
}
