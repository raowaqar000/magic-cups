import Phaser from 'phaser';
import { ASSET } from '../assets/manifest';
import { DEPTH, GAME_WIDTH, HUD_LAYOUT } from '../config/constants';
import { MAX_HEARTS } from '../engine/round';
import { Button } from './Button';
import { addImage, addText } from './display';

/**
 * Top HUD, anchored to the top edge:
 * [ LEVEL badge | hearts | coins ] (pause)
 * The three items sit in the three slots of the HUD bar art.
 */
export class Hud extends Phaser.GameObjects.Container {
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly coinIcon: Phaser.GameObjects.Image;
  readonly pauseButton: Button;
  private coinValue = 0;
  private heartCount = MAX_HEARTS;

  /** Bottom edge of the HUD, used to place the magician zone below it. */
  static readonly bottom = HUD_LAYOUT.top + HUD_LAYOUT.height;

  constructor(scene: Phaser.Scene, onPause: () => void) {
    super(scene, 0, 0);
    const cy = HUD_LAYOUT.top + HUD_LAYOUT.height / 2;
    const barW = 590;
    const barX = 16 + barW / 2;

    const bar = addImage(scene, barX, cy, ASSET.barHudTop, barW);
    const slot = barW * 0.312; // distance between slot centres
    const slotY = cy - 3;
    this.add(bar);

    // Slot 1: level badge
    const badge = addImage(scene, barX - slot, slotY, ASSET.badgeLevel, 186);
    this.levelText = addText(scene, barX - slot + 20, slotY - 1, 'LEVEL 1', 25);
    this.add([badge, this.levelText]);

    // Slot 2: hearts
    for (let i = 0; i < MAX_HEARTS; i++) {
      const h = addImage(scene, barX + (i - 1) * 46, slotY, ASSET.heartFull, 42, 42);
      this.hearts.push(h);
      this.add(h);
    }

    // Slot 3: coins
    this.coinIcon = addImage(scene, barX + slot - 48, slotY, ASSET.coin, 40, 40);
    this.coinText = addText(scene, barX + slot - 22, slotY, '0', 28).setOrigin(0, 0.5);
    this.add([this.coinIcon, this.coinText]);

    this.pauseButton = new Button(scene, GAME_WIDTH - 60, cy, ASSET.btnPause, { width: 86, onClick: onPause });
    this.add(this.pauseButton);

    this.setDepth(DEPTH.hud);
    scene.add.existing(this);
  }

  setLevel(level: number): void {
    this.levelText.setText(`LEVEL ${level}`);
  }

  setHearts(count: number, animate = false): void {
    const prev = this.heartCount;
    this.heartCount = count;
    this.hearts.forEach((img, i) => {
      const full = i < count;
      const changed = animate && i >= count && i < prev;
      if (!changed) {
        img.setTexture(full ? ASSET.heartFull : ASSET.heartEmpty);
        return;
      }
      const s = img.scale;
      this.scene.tweens.add({
        targets: img,
        scale: s * 1.5,
        duration: 140,
        yoyo: true,
        ease: 'Quad.easeOut',
        onYoyo: () => img.setTexture(ASSET.heartEmpty),
      });
      this.scene.tweens.add({ targets: img, angle: { from: -14, to: 14 }, duration: 60, yoyo: true, repeat: 3, onComplete: () => img.setAngle(0) });
    });
    if (count > prev && animate) {
      for (let i = prev; i < count; i++) {
        const img = this.hearts[i];
        if (!img) continue;
        const s = img.scale;
        this.scene.tweens.add({ targets: img, scale: { from: s * 0.2, to: s }, duration: 380, ease: 'Back.easeOut' });
      }
    }
  }

  setCoins(value: number, animate = false): void {
    if (!animate) {
      this.coinValue = value;
      this.coinText.setText(String(value));
      return;
    }
    const counter = { v: this.coinValue };
    this.coinValue = value;
    this.scene.tweens.add({
      targets: counter,
      v: value,
      duration: 700,
      ease: 'Quad.easeOut',
      onUpdate: () => this.coinText.setText(String(Math.round(counter.v))),
    });
    const s = this.coinIcon.scale;
    this.scene.tweens.add({ targets: this.coinIcon, scale: s * 1.35, duration: 150, yoyo: true, repeat: 2 });
  }

  /** World position of the coin icon (target for flying coins). */
  coinPosition(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.coinIcon.x, this.coinIcon.y);
  }
}
