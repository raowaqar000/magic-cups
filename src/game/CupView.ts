import Phaser from 'phaser';
import { type AssetKey } from '../assets/manifest';
import { DEPTH } from '../config/constants';
import { contentSize, fitScale, setContentOrigin, tweenAsync } from '../ui/display';

/**
 * One cup on the stage. The container sits at the cup's floor contact point.
 * Children (back to front): shadow ellipse, hidden item, cup sprite, debug marker.
 * Lifting moves only the cup sprite, so the item stays on the floor and is revealed.
 */
export class CupView extends Phaser.GameObjects.Container {
  readonly cup: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private item?: Phaser.GameObjects.Image;
  private readonly marker: Phaser.GameObjects.Arc;
  private readonly cupH: number;
  private readonly cupW: number;
  lifted = false;
  /** Perspective scale for the slot the cup is standing on. */
  baseScale = 1;

  constructor(
    scene: Phaser.Scene,
    readonly cupId: number,
    cupKey: AssetKey,
    width: number,
  ) {
    super(scene, 0, 0);
    this.cup = scene.add.image(0, 0, cupKey);
    setContentOrigin(this.cup, cupKey, 'bottom');
    this.cup.setScale(fitScale(cupKey, width, width * 1.05));
    const size = contentSize(this.cup, cupKey);
    this.cupW = size.w;
    this.cupH = size.h;

    this.shadow = scene.add.ellipse(0, 2, this.cupW * 0.95, this.cupW * 0.22, 0x12001c, 0.38);

    this.marker = scene.add.circle(0, -this.cupH - 18, 12, 0x00ff88).setStrokeStyle(4, 0x003311).setVisible(false);

    this.add([this.shadow, this.cup, this.marker]);
    this.cup.setInteractive({ useHandCursor: true });
    scene.add.existing(this);
  }

  get cupWidth(): number {
    return this.cupW;
  }

  /** How high the cup rises to reveal what is underneath. */
  get liftHeight(): number {
    return Math.max(this.cupH * 0.62, this.cupW * 0.62);
  }

  /** Item rests on the floor under the cup. */
  setItem(key: AssetKey | null, size = this.cupW * 0.6): void {
    this.item?.destroy();
    this.item = undefined;
    if (!key) return;
    const img = this.scene.add.image(0, 0, key);
    setContentOrigin(img, key, 'bottom');
    img.setScale(fitScale(key, size, size));
    img.y = -2;
    img.setVisible(false);
    this.item = img;
    this.addAt(img, 1); // between shadow and cup
  }

  hasItem(): boolean {
    return !!this.item;
  }

  /** Top-centre of the item in world space (for sparkles). */
  itemWorldPos(): Phaser.Math.Vector2 {
    const h = this.item ? this.item.displayHeight * 0.5 : this.cupW * 0.2;
    return new Phaser.Math.Vector2(this.x, this.y - h * this.scaleY);
  }

  setMarkerVisible(on: boolean): void {
    this.marker.setVisible(on && this.hasItem());
  }

  /** Keeps lower (closer) cups on top. */
  updateDepth(bias = 0): void {
    this.setDepth(DEPTH.cups + this.y + bias);
  }

  setInputEnabled(on: boolean): void {
    if (this.cup.input) this.cup.input.enabled = on;
  }

  async lift(duration: number): Promise<void> {
    this.lifted = true;
    this.item?.setVisible(true);
    this.scene.tweens.add({ targets: this.shadow, scaleX: 0.75, scaleY: 0.75, alpha: 0.22, duration });
    await tweenAsync(this.scene, {
      targets: this.cup,
      y: -this.liftHeight,
      angle: -6,
      duration,
      ease: 'Back.easeOut',
    });
  }

  async drop(duration: number): Promise<void> {
    this.scene.tweens.add({ targets: this.shadow, scaleX: 1, scaleY: 1, alpha: 0.38, duration });
    await tweenAsync(this.scene, { targets: this.cup, y: 0, angle: 0, duration, ease: 'Quad.easeIn' });
    this.lifted = false;
    this.item?.setVisible(false);
    // Little landing squash.
    const sx = this.cup.scaleX;
    const sy = this.cup.scaleY;
    await tweenAsync(this.scene, {
      targets: this.cup,
      scaleX: sx * 1.06,
      scaleY: sy * 0.93,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.cup.setScale(sx, sy);
  }
}
