import Phaser from 'phaser';
import { ASSET, assetUrl, BOOT_ASSETS, phase1Assets } from '../assets/manifest';
import { addCoverBackground, addText } from '../ui/display';
import { ProgressBar } from '../ui/ProgressBar';
import { debugStartLevel } from '../debug/params';

/** Loads every Phase 1 asset with a progress bar. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    const { width, height } = this.scale;
    addCoverBackground(this, ASSET.bgMenu);
    this.add.rectangle(0, 0, width, height, 0x12041c, 0.45).setOrigin(0);
    addText(this, width / 2, height * 0.42, 'MAGIC CUPS', 84, { color: '#ffd84a' });
    const bar = new ProgressBar(this, width / 2, height * 0.56, 520);
    const label = addText(this, width / 2, height * 0.56 + 70, 'LOADING...', 32);

    this.load.on('progress', (v: number) => {
      bar.setProgress(v);
      label.setText(`LOADING... ${Math.round(v * 100)}%`);
    });

    const already = new Set<string>(BOOT_ASSETS);
    for (const key of phase1Assets()) {
      if (!already.has(key)) this.load.image(key, assetUrl(key));
    }
  }

  create(): void {
    const level = debugStartLevel();
    if (level !== null) this.scene.start('Game', { level });
    else this.scene.start('Title');
  }
}
