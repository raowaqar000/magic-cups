import Phaser from 'phaser';
import { ASSET } from '../assets/manifest';
import { COLORS } from '../config/constants';
import { getProgress } from '../services/services';
import { Button } from '../ui/Button';
import { addCoverBackground, addImage, addText } from '../ui/display';

/**
 * Minimal Phase 1 start screen (target of the HOME buttons).
 * Phase 3 replaces it with the full home screen and level map.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;
    const progress = getProgress();
    addCoverBackground(this, ASSET.bgMenu);

    const title = addText(this, width / 2, height * 0.3, 'MAGIC\nCUPS', 120, { color: COLORS.gold, strokeRatio: 0.14 });
    this.tweens.add({ targets: title, scale: 1.04, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const ballY = height * 0.47;
    const ball = addImage(this, width / 2, ballY, ASSET.ballGold, 150);
    this.tweens.add({ targets: ball, y: ballY - 18, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const play = new Button(this, width / 2, height * 0.64, ASSET.btnPlay, {
      width: 300,
      onClick: () => this.scene.start('Game', { level: progress.data.currentLevel }),
    });
    this.tweens.add({ targets: play, scale: 1.05, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    addText(this, width / 2, height * 0.64 + 150, `LEVEL ${progress.data.currentLevel}`, 44);

    const coinY = height * 0.64 + 215;
    const coins = addText(this, width / 2 + 24, coinY, String(progress.data.coins), 38, { color: COLORS.gold });
    addImage(this, width / 2 - coins.width / 2 - 10, coinY, ASSET.coin, 46, 46);
  }
}
