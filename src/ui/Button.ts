import Phaser from 'phaser';
import { assetInfo, type AssetKey } from '../assets/manifest';
import { addText, fitScale, setContentOrigin } from './display';

export interface ButtonOpts {
  /** Max width/height of the visible button art. */
  width: number;
  height?: number;
  label?: string;
  fontSize?: number;
  /** Horizontal offset of the label, as a fraction of the button width (e.g. to clear an icon). */
  labelOffsetX?: number;
  onClick: () => void;
}

/**
 * Image button with code-drawn text and a squash on press. The click fires on release
 * while the pointer is still over the button.
 */
export class Button extends Phaser.GameObjects.Container {
  readonly image: Phaser.GameObjects.Image;
  readonly label?: Phaser.GameObjects.Text;
  private enabled = true;
  private pressed = false;
  private readonly baseScale = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, key: AssetKey, private readonly opts: ButtonOpts) {
    super(scene, x, y);
    this.image = scene.add.image(0, 0, key);
    setContentOrigin(this.image, key, 'center');
    this.image.setScale(fitScale(key, opts.width, opts.height ?? Infinity));
    this.add(this.image);

    if (opts.label) {
      const c = assetInfo(key).content;
      const h = c.h * this.image.scaleY;
      const w = c.w * this.image.scaleX;
      this.label = addText(scene, w * (opts.labelOffsetX ?? 0), -h * 0.04, opts.label, opts.fontSize ?? Math.round(h * 0.42));
      this.add(this.label);
    }

    this.image.setInteractive({ useHandCursor: true });
    this.image.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      scene.tweens.add({ targets: this, scale: this.baseScale * 0.9, duration: 70, ease: 'Quad.easeOut' });
    });
    this.image.on('pointerup', () => {
      if (!this.pressed) return;
      this.release();
      if (this.enabled) this.opts.onClick();
    });
    this.image.on('pointerout', () => {
      if (this.pressed) this.release();
    });

    scene.add.existing(this);
  }

  private release(): void {
    this.pressed = false;
    this.scene.tweens.add({ targets: this, scale: this.baseScale, duration: 140, ease: 'Back.easeOut' });
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.setAlpha(on ? 1 : 0.55);
    return this;
  }

  setTexture(key: AssetKey): this {
    this.image.setTexture(key);
    setContentOrigin(this.image, key, 'center');
    return this;
  }
}
