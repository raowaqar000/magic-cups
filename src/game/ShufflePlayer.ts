import Phaser from 'phaser';
import { SWAP_FX } from '../config/constants';
import { applyStep } from '../engine/shuffle';
import type { ShuffleScript, ShuffleStep, SwapPair } from '../engine/types';
import { delay } from '../ui/display';
import type { CupView } from './CupView';
import type { SlotGeom } from './StageLayout';

interface Move {
  cup: CupView;
  from: SlotGeom;
  to: SlotGeom;
  /** +1 = front cup (lower on screen / bigger), -1 = back cup (higher / smaller). */
  side: 1 | -1;
}

/**
 * Plays a ShuffleScript back as tweens. It never decides anything: the engine's
 * steps say who swaps with whom; this class only animates them.
 * All timing goes through scene tweens/timers so pausing the scene freezes it,
 * and a fixed-step recorder (Phase 4) can drive it frame by frame.
 */
export class ShufflePlayer {
  private readonly cupAtSlot: number[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly slots: SlotGeom[],
    private readonly cupsById: CupView[],
    script: ShuffleScript,
    /** Playback speed multiplier (dev tool; 1 = as authored, 2 = twice as fast). */
    private readonly speed: () => number = () => 1,
  ) {
    this.cupAtSlot = script.initial.cupAtSlot.slice();
  }

  async play(script: ShuffleScript, isAlive: () => boolean): Promise<void> {
    for (const step of script.steps) {
      if (!isAlive()) return;
      await this.playStep(step);
    }
  }

  private async playStep(step: ShuffleStep): Promise<void> {
    const ms = step.durationMs / Math.max(0.05, this.speed());
    if (step.kind === 'pause') {
      await delay(this.scene, ms);
      return;
    }
    if (step.kind === 'fakeout') {
      await Promise.all(this.movesFor(step.pair).map((m) => this.animate(m, ms, true)));
      return;
    }
    await Promise.all(step.pairs.flatMap((pair) => this.movesFor(pair)).map((m) => this.animate(m, ms, false)));
    applyStep(this.cupAtSlot, step);
  }

  private movesFor(pair: SwapPair): Move[] {
    const a = this.cupsById[this.cupAtSlot[pair.slotA]];
    const b = this.cupsById[this.cupAtSlot[pair.slotB]];
    const sa = this.slots[pair.slotA];
    const sb = this.slots[pair.slotB];
    return [
      { cup: a, from: sa, to: sb, side: pair.front === 'A' ? 1 : -1 },
      { cup: b, from: sb, to: sa, side: pair.front === 'B' ? 1 : -1 },
    ];
  }

  /**
   * Moves a cup along a quadratic Bezier arc. Swaps along a row bulge vertically
   * (front cup dips toward the viewer, back cup rises behind). Swaps within a column
   * bulge sideways in opposite directions so the two cups never overlap.
   * A fake-out goes 35% of the way and comes back.
   */
  private animate(m: Move, duration: number, fakeout: boolean): Promise<void> {
    const { cup, from, to, side } = m;
    const sameColumn = from.col === to.col && from.row !== to.row;
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    let cx = mx;
    let cy = my;
    if (sameColumn) {
      const avgScale = (from.scale + to.scale) / 2;
      cx += side * cup.cupWidth * avgScale * SWAP_FX.sideBulgeCupFactor;
    } else {
      const bulge = Phaser.Math.Clamp(dist * SWAP_FX.bulgeFactor, SWAP_FX.bulgeMin, SWAP_FX.bulgeMax);
      cy += side * bulge;
    }

    return new Promise((resolve) => {
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: fakeout ? 'Linear' : 'Sine.easeInOut',
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          const t = fakeout ? 0.35 * Math.sin(Math.PI * u) : u;
          const it = 1 - t;
          cup.x = it * it * from.x + 2 * it * t * cx + t * t * to.x;
          cup.y = it * it * from.y + 2 * it * t * cy + t * t * to.y;
          const persp = Phaser.Math.Linear(from.scale, to.scale, t);
          cup.setScale(persp * (1 + side * SWAP_FX.depthScale * Math.sin(Math.PI * t)));
          cup.updateDepth(side * 0.5);
        },
        onComplete: () => {
          const end = fakeout ? from : to;
          cup.setPosition(end.x, end.y);
          cup.baseScale = end.scale;
          cup.setScale(end.scale);
          cup.updateDepth();
          resolve();
        },
        onStop: () => resolve(),
      });
    });
  }
}
