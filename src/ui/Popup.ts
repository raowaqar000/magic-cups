import Phaser from 'phaser';
import { ASSET, type AssetKey } from '../assets/manifest';
import { COLORS, DEPTH, TIMING } from '../config/constants';
import { MAX_HEARTS } from '../engine/round';
import { Button } from './Button';
import { addImage, addText, tweenAsync } from './display';

export type ButtonStyle = 'green' | 'orange' | 'ad';

export interface PopupButton {
  label: string;
  style: ButtonStyle;
  onClick: () => void;
}

export interface PopupOpts {
  title: string;
  /** Small line under the ribbon, e.g. "LEVEL 3". */
  subtitle?: string;
  /** Number of earned stars to show (0-3). Omit to hide the star row. */
  stars?: number;
  /** Shows a row of full/empty hearts. */
  hearts?: number;
  lines?: string[];
  /** Shows a "+N" coin row. */
  coins?: number;
  buttons: PopupButton[];
}

/** Wide button art and the width that gives each a similar on-screen height. */
const BUTTON_ART: Record<ButtonStyle, { key: AssetKey; width: number }> = {
  green: { key: ASSET.btnWideGreen, width: 400 },
  orange: { key: ASSET.btnWideOrange, width: 300 },
  ad: { key: ASSET.btnWideAd, width: 330 },
};

const PANEL_W = 480;
const BUTTON_GAP = 104;

/**
 * Modal popup: dim overlay that swallows input, panel, ribbon title, then a content
 * block (subtitle, stars, hearts, text, coins) centred above a stack of wide buttons.
 * Animates in with a scale bounce.
 */
export class Popup extends Phaser.GameObjects.Container {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly box: Phaser.GameObjects.Container;
  private readonly buttons: Button[] = [];
  private closing = false;

  constructor(scene: Phaser.Scene, opts: PopupOpts) {
    super(scene, 0, 0);
    const { width, height } = scene.scale;

    this.overlay = scene.add
      .rectangle(0, 0, width, height, COLORS.overlay, 0.62)
      .setOrigin(0)
      .setInteractive(); // blocks taps on anything underneath
    this.add(this.overlay);

    this.box = scene.add.container(width / 2, height / 2);
    this.add(this.box);

    const panel = addImage(scene, 0, 0, ASSET.panelPopup, PANEL_W);
    const panelH = panel.displayHeight;
    const top = -panelH / 2;
    this.box.add(panel);

    const ribbon = addImage(scene, 0, top + 30, ASSET.bannerRibbon, PANEL_W + 90);
    const title = addText(scene, 0, top + 18, opts.title, opts.title.length > 11 ? 40 : 48);
    this.box.add([ribbon, title]);

    // Buttons stack upwards from the bottom of the panel.
    const bottom = panelH / 2 - 88;
    let buttonsTop = bottom;
    opts.buttons
      .slice()
      .reverse()
      .forEach((b, i) => {
        const by = bottom - i * BUTTON_GAP;
        buttonsTop = by - 50;
        const art = BUTTON_ART[b.style];
        const isAd = b.style === 'ad';
        const btn = new Button(scene, 0, by, art.key, {
          width: art.width,
          label: b.label,
          fontSize: isAd ? 32 : 38,
          labelOffsetX: isAd ? 0.12 : 0,
          onClick: () => {
            if (this.closing) return;
            b.onClick();
          },
        });
        this.buttons.push(btn);
        this.box.add(btn);
      });

    // Content block, centred in the space between the ribbon and the buttons.
    const content = this.buildContent(opts);
    const areaTop = top + 120;
    const areaMid = (areaTop + buttonsTop) / 2;
    content.container.setY(areaMid - content.height / 2);
    this.box.add(content.container);

    this.setDepth(DEPTH.popup);
    scene.add.existing(this);

    this.overlay.setAlpha(0);
    scene.tweens.add({ targets: this.overlay, alpha: 1, duration: 200 });
    this.box.setScale(0.3);
    scene.tweens.add({ targets: this.box, scale: 1, duration: TIMING.popupIn, ease: 'Back.easeOut' });
  }

  private buildContent(opts: PopupOpts): { container: Phaser.GameObjects.Container; height: number } {
    const scene = this.scene;
    const c = scene.add.container(0, 0);
    let y = 0;
    const gap = 22;

    if (opts.subtitle) {
      c.add(addText(scene, 0, y + 20, opts.subtitle, 34, { color: COLORS.gold }));
      y += 40 + gap;
    }

    if (opts.stars !== undefined) {
      const earned = opts.stars;
      const row = [
        { x: -128, dy: 76, size: 112 },
        { x: 0, dy: 62, size: 140 },
        { x: 128, dy: 76, size: 112 },
      ];
      row.forEach((p, i) => {
        c.add(addImage(scene, p.x, y + p.dy, ASSET.starEmpty, p.size));
        if (i < earned) {
          const full = addImage(scene, p.x, y + p.dy, ASSET.starFull, p.size);
          const s = full.scale;
          full.setScale(0);
          c.add(full);
          scene.tweens.add({ targets: full, scale: s, delay: TIMING.popupIn + i * 260, duration: 340, ease: 'Back.easeOut' });
        }
      });
      y += 140 + gap;
    }

    if (opts.hearts !== undefined) {
      for (let i = 0; i < MAX_HEARTS; i++) {
        const key = i < opts.hearts ? ASSET.heartFull : ASSET.heartEmpty;
        c.add(addImage(scene, (i - 1) * 92, y + 42, key, 80, 80));
      }
      y += 84 + gap;
    }

    for (const line of opts.lines ?? []) {
      const t = addText(scene, 0, 0, line, 34, { wrapWidth: PANEL_W - 100 });
      t.setY(y + t.height / 2);
      c.add(t);
      y += t.height + 6;
    }
    if (opts.lines?.length) y += gap - 6;

    if (opts.coins !== undefined && opts.coins > 0) {
      const label = addText(scene, 26, y + 32, `+${opts.coins}`, 50, { color: COLORS.gold });
      const icon = addImage(scene, -label.width / 2 - 6, y + 32, ASSET.coin, 60, 60);
      c.add([icon, label]);
      y += 64 + gap;
    }

    return { container: c, height: Math.max(0, y - gap) };
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    this.buttons.forEach((b) => b.setEnabled(false));
    this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: 180 });
    await tweenAsync(this.scene, { targets: this.box, scale: 0.4, alpha: 0, duration: 180, ease: 'Back.easeIn' });
    this.destroy();
  }
}
