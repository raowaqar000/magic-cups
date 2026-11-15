import Phaser from 'phaser';
import { assetInfo, type AssetKey } from '../assets/manifest';
import { COLORS, FONT_FAMILY } from '../config/constants';

export type Anchor = 'center' | 'bottom' | 'top' | 'left';

/** Scale factor so the visible content fits inside maxW x maxH. */
export function fitScale(key: AssetKey, maxW: number, maxH = Infinity): number {
  const c = assetInfo(key).content;
  return Math.min(maxW / c.w, maxH / c.h);
}

/** Sets origin relative to the visible content (not the padded canvas). */
export function setContentOrigin(img: Phaser.GameObjects.Image, key: AssetKey, anchor: Anchor): void {
  const { w, h, content: c } = assetInfo(key);
  const cx = (c.x + c.w / 2) / w;
  const cy = (c.y + c.h / 2) / h;
  if (anchor === 'center') img.setOrigin(cx, cy);
  else if (anchor === 'bottom') img.setOrigin(cx, (c.y + c.h) / h);
  else if (anchor === 'top') img.setOrigin(cx, c.y / h);
  else img.setOrigin(c.x / w, cy);
}

/** Adds an image sized by its visible content. */
export function addImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: AssetKey,
  maxW: number,
  maxH = Infinity,
  anchor: Anchor = 'center',
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, key);
  setContentOrigin(img, key, anchor);
  img.setScale(fitScale(key, maxW, maxH));
  return img;
}

/** Displayed size of the visible content of an image at its current scale. */
export function contentSize(img: Phaser.GameObjects.Image, key: AssetKey): { w: number; h: number } {
  const c = assetInfo(key).content;
  return { w: c.w * Math.abs(img.scaleX), h: c.h * Math.abs(img.scaleY) };
}

export interface TextOpts {
  color?: string;
  stroke?: string;
  strokeRatio?: number;
  align?: 'left' | 'center' | 'right';
  shadow?: boolean;
  wrapWidth?: number;
}

/** Chunky game text: Lilita One with a dark outline and drop shadow. */
export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  opts: TextOpts = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: `"${FONT_FAMILY}", Arial, sans-serif`,
    fontSize: `${size}px`,
    color: opts.color ?? COLORS.text,
    stroke: opts.stroke ?? COLORS.stroke,
    strokeThickness: Math.round(size * (opts.strokeRatio ?? 0.18)),
    align: opts.align ?? 'center',
    wordWrap: opts.wrapWidth ? { width: opts.wrapWidth } : undefined,
    padding: { x: 4, y: 4 },
  });
  if (opts.shadow !== false) t.setShadow(0, Math.max(2, size * 0.07), 'rgba(20,0,30,0.55)', 0, true, true);
  t.setOrigin(0.5);
  return t;
}

/** Background image that covers the full screen, anchored to the bottom (stage floor stays put). */
export function addCoverBackground(scene: Phaser.Scene, key: AssetKey): Phaser.GameObjects.Image {
  const { width, height } = scene.scale;
  const info = assetInfo(key);
  const s = Math.max(width / info.w, height / info.h);
  return scene.add.image(width / 2, height, key).setOrigin(0.5, 1).setScale(s);
}

/** Promise wrapper around a tween. Resolves immediately if the scene is gone. */
export function tweenAsync(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    const userComplete = config.onComplete;
    scene.tweens.add({
      ...config,
      onComplete: (...args: unknown[]) => {
        if (typeof userComplete === 'function') (userComplete as (...a: unknown[]) => void)(...args);
        resolve();
      },
      onStop: () => resolve(),
    });
  });
}

/** Promise wrapper around a scene timer (respects scene pause, unlike setTimeout). */
export function delay(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(ms, resolve);
  });
}
