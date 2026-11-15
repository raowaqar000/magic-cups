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
 */
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
      `moves: ${level.moves}  speed: ${level.speed.startMs}->${level.speed.endMs}ms`,
      `pairs: ${level.simultaneousPairs}  pause: ${level.pauseBetweenGroupsMs}ms`,
      `rule: ${level.swapRule}  targetBias: ${level.targetBias}`,
      `hearts: ${d.hearts}  attempt: ${d.attempt}`,
      `[D] ball marker  [S] this panel  [N] next level`,
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

  // Keep the info panel current when a new round starts (new seed).
  scene.events.on('round-start', () => {
    if (info) scene.time.delayedCall(0, showInfo);
  });

  console.info('[debug] D = ball marker, S = seed/config, N = next level, ?level=N to jump');
}
