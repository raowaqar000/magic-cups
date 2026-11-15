import Phaser from 'phaser';
import { ASSET, CONFETTI, type AssetKey } from '../assets/manifest';
import { COLORS, DEPTH } from '../config/constants';
import { addImage, addText } from '../ui/display';

/** Visual effects built from the fx_* images with plain tweens (no particle config needed). */
export class Fx {
  constructor(private readonly scene: Phaser.Scene) {}

  private img(x: number, y: number, key: AssetKey, size: number): Phaser.GameObjects.Image {
    return addImage(this.scene, x, y, key, size, size).setDepth(DEPTH.fx);
  }

  /** Looping twinkle around a point (e.g. the ball). Returns a stop function. */
  sparkleLoop(x: number, y: number, radius: number): () => void {
    const keys: AssetKey[] = [ASSET.sparkleMedium, ASSET.twinkle, ASSET.glintSmall];
    const objs = keys.map((k, i) => {
      const a = (i / keys.length) * Math.PI * 2 - Math.PI / 2;
      const s = this.img(x + Math.cos(a) * radius, y + Math.sin(a) * radius * 0.7, k, 46 - i * 6);
      const base = s.scale;
      s.setScale(0);
      this.scene.tweens.add({
        targets: s,
        scale: { from: 0, to: base },
        angle: { from: -20, to: 25 },
        duration: 420,
        delay: i * 170,
        yoyo: true,
        repeat: -1,
        repeatDelay: 120,
        ease: 'Sine.easeInOut',
      });
      return s;
    });
    return () => objs.forEach((o) => o.destroy());
  }

  /** One-shot pop of sparkles and glints around a point. */
  sparkleBurst(x: number, y: number, count = 6, spread = 90): void {
    const keys: AssetKey[] = [ASSET.sparkleLarge, ASSET.sparkleMedium, ASSET.starSmall, ASSET.twinkle, ASSET.glintLarge];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const d = spread * (0.5 + Math.random() * 0.5);
      const s = this.img(x, y, keys[i % keys.length], 30 + Math.random() * 34);
      const base = s.scale;
      s.setScale(0);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d * 0.8,
        scale: { from: base * 0.3, to: base },
        angle: Math.random() * 90 - 45,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () =>
          this.scene.tweens.add({ targets: s, alpha: 0, scale: 0, duration: 280, delay: 120, onComplete: () => s.destroy() }),
      });
    }
  }

  lightBurst(x: number, y: number, size = 330): void {
    const b = this.img(x, y, ASSET.lightBurst, size).setDepth(DEPTH.fx - 1).setBlendMode(Phaser.BlendModes.ADD);
    const base = b.scale;
    b.setScale(0.1);
    this.scene.tweens.add({ targets: b, scale: base, angle: 40, duration: 450, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: b, alpha: 0, duration: 500, delay: 550, onComplete: () => b.destroy() });
  }

  /** Confetti pieces shot upward that fall back down with gravity and spin. */
  confetti(x: number, y: number, count = 30): void {
    const gravity = 1500;
    for (let i = 0; i < count; i++) {
      const piece = this.img(x, y, CONFETTI[i % CONFETTI.length], 30 + Math.random() * 18);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 520 + Math.random() * 480;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const spin = (Math.random() - 0.5) * 900;
      const life = 1300 + Math.random() * 500;
      this.scene.tweens.addCounter({
        from: 0,
        to: life / 1000,
        duration: life,
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          piece.x = x + vx * t;
          piece.y = y + vy * t + 0.5 * gravity * t * t;
          piece.angle = spin * t;
          piece.scaleX = piece.scaleY * Math.cos(t * 9 + i); // flutter
          if (t > life / 1000 - 0.35) piece.alpha = Math.max(0, (life / 1000 - t) / 0.35);
        },
        onComplete: () => piece.destroy(),
      });
    }
  }

  smokePuff(x: number, y: number, size = 150): void {
    const keys: AssetKey[] = [ASSET.smokeLarge, ASSET.smokeMedium, ASSET.smokeSmall, ASSET.smokeMedium];
    keys.forEach((k, i) => {
      const ox = (i - 1.5) * size * 0.28;
      const s = this.img(x + ox, y - Math.random() * 20, k, size * (i === 0 ? 1 : 0.6));
      const base = s.scale;
      s.setScale(base * 0.2).setAlpha(0.95);
      this.scene.tweens.add({
        targets: s,
        scale: base,
        x: s.x + ox * 0.8,
        y: s.y - size * 0.5,
        duration: 520,
        delay: i * 60,
        ease: 'Quad.easeOut',
      });
      this.scene.tweens.add({ targets: s, alpha: 0, duration: 450, delay: 450 + i * 60, onComplete: () => s.destroy() });
    });
  }

  floatText(x: number, y: number, text: string, color: string = COLORS.gold): void {
    const t = addText(this.scene, x, y, text, 52, { color }).setDepth(DEPTH.fx + 1);
    t.setScale(0.3);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t,
      y: y - 110,
      alpha: 0,
      duration: 700,
      delay: 650,
      ease: 'Quad.easeIn',
      onComplete: () => t.destroy(),
    });
  }

  /** Coins fly from a point to the HUD counter. */
  flyCoins(fromX: number, fromY: number, toX: number, toY: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const c = this.img(fromX, fromY, ASSET.coin, 40).setDepth(DEPTH.hud + 1);
      const midX = (fromX + toX) / 2 + (Math.random() - 0.5) * 200;
      const midY = Math.min(fromY, toY) - 60 - Math.random() * 80;
      const curve = new Phaser.Curves.QuadraticBezier(
        new Phaser.Math.Vector2(fromX, fromY),
        new Phaser.Math.Vector2(midX, midY),
        new Phaser.Math.Vector2(toX, toY),
      );
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 650,
        delay: i * 70,
        ease: 'Quad.easeIn',
        onUpdate: (tw) => {
          const p = curve.getPoint(tw.getValue() ?? 0);
          c.setPosition(p.x, p.y);
        },
        onComplete: () => c.destroy(),
      });
    }
  }
}
