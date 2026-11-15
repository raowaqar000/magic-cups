import Phaser from 'phaser';
import { DEPTH } from '../config/constants';
import type { GameScene } from '../scenes/GameScene';

/**
 * Dev-only tools. Loaded through a dynamic import guarded by import.meta.env.DEV,
 * so production builds do not contain this file at all.
 *
 *   ?level=N  start at level N (see debug/params.ts)
 *   D         toggle a marker over the cup that holds the ball
 *   S         show/hide seed + level config (and the reserved magician zone)
 *   N         skip to the next level
 *   [ / ]     shuffle playback slower / faster (x0.25 to x4, playback only; seeds unchanged)
 */

const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export function attachDebugTools(scene: GameScene): void {
  const kb = scene.input.keyboard;
  if (!kb) return;

  let info: Phaser.GameObjects.Container | null = null;

  const showInfo = () => {
    info?.destroy();
    const d = scene.debugInfo();
    const { level } = d;
    const lines = [
      `LEVEL ${level.id}  seed: ${d.seed}  phase: ${d.phase}`,
      `layout: ${level.layout}  cup: ${level.cup}`,
      `moves: ${level.moves}  speed: ${level.speed.startMs}->${level.speed.endMs}ms (${level.rampCurve ?? 'easeIn'})`,
      `playback: x${d.speed}`,
      `pairs: ${level.simultaneousPairs}  pause: ${level.pauseBetweenGroupsMs}ms`,
      `rule: ${level.swapRule}  targetBias: ${level.targetBias}`,
      `hearts: ${d.hearts}  attempt: ${d.attempt}`,
      `[D] ball  [S] panel  [N] next  [ ] speed`,
    ];
    const text = scene.add.text(12, 0, lines.join('\n'), {
      fontFamily: 'monospace',
      fontSize: '19px',
      color: '#aaffcc',
      backgroundColor: 'rgba(0,0,0,0.72)',
      padding: { x: 10, y: 8 },
    });
    const zone = scene.magicianZone;
    const g = scene.add.graphics();
    g.lineStyle(3, 0x66ffaa, 0.8).strokeRect(8, zone.top, scene.scale.width - 16, zone.bottom - zone.top);
    const label = scene.add.text(16, zone.bottom - 28, 'MAGICIAN ZONE (Phase 2)', { fontFamily: 'monospace', fontSize: '16px', color: '#66ffaa' });
    text.setY(zone.top + 8);
    info = scene.add.container(0, 0, [g, label, text]).setDepth(DEPTH.debug);
  };

  kb.on('keydown-D', () => {
    scene.debugShowBall = !scene.debugShowBall;
    scene.applyDebugMarkers();
  });
  kb.on('keydown-S', () => {
    if (info) {
      info.destroy();
      info = null;
    } else showInfo();
  });
  kb.on('keydown-N', () => scene.gotoLevel(scene.levelId + 1));

  // [ and ]: change shuffle playback speed. Takes effect from the next swap.
  let toast: Phaser.GameObjects.Text | null = null;
  const changeSpeed = (dir: -1 | 1) => {
    const i = SPEED_STEPS.findIndex((s) => s >= scene.debugSpeed);
    const next = SPEED_STEPS[Phaser.Math.Clamp((i < 0 ? SPEED_STEPS.length - 1 : i) + dir, 0, SPEED_STEPS.length - 1)];
    scene.debugSpeed = next;
    toast?.destroy();
    toast = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 40, `SPEED x${next}`, {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#aaffcc',
        backgroundColor: 'rgba(0,0,0,0.72)',
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.debug);
    const t = toast;
    scene.time.delayedCall(1200, () => t.destroy());
    if (info) showInfo();
  };
  // Phaser has no named key event for brackets, so match on the raw key.
  kb.on('keydown', (e: KeyboardEvent) => {
    if (e.key === '[') changeSpeed(-1);
    else if (e.key === ']') changeSpeed(1);
  });

  // Keep the info panel current when a new round starts (new seed).
  scene.events.on('round-start', () => {
    if (info) scene.time.delayedCall(0, showInfo);
  });

  console.info('[debug] D = ball marker, S = seed/config, N = next level, [ ] = speed, ?level=N to jump');
}
