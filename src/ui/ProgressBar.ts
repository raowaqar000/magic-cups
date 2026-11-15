import Phaser from 'phaser';
import { ASSET, assetInfo } from '../assets/manifest';
import { fitScale, setContentOrigin } from './display';

/** Frame + striped fill. The fill is cropped from the left to show progress. */
export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly fill: Phaser.GameObjects.Image;
  private value = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);
    const frame = scene.add.image(0, 0, ASSET.progressFrame);
    setContentOrigin(frame, ASSET.progressFrame, 'center');
    const s = fitScale(ASSET.progressFrame, width);
    frame.setScale(s);

    // Frame and fill share one canvas; shrink the fill so it sits inside the frame's inner well.
    this.fill = scene.add.image(0, 0, ASSET.progressFill);
    setContentOrigin(this.fill, ASSET.progressFill, 'center');
    this.fill.setScale(s * 0.86, s * 0.8);

    this.add([frame, this.fill]);
    this.setProgress(0);
    scene.add.existing(this);
  }

  setProgress(v: number): void {
    this.value = Phaser.Math.Clamp(v, 0, 1);
    const { content: c, h } = assetInfo(ASSET.progressFill);
    const w = Math.max(1, Math.round(c.w * this.value));
    this.fill.setCrop(c.x, 0, w, h);
    this.fill.setVisible(this.value > 0.001);
  }

  get progress(): number {
    return this.value;
  }
}
