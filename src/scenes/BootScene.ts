import Phaser from 'phaser';
import fontUrl from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url';
import { assetUrl, BOOT_ASSETS } from '../assets/manifest';
import { FONT_FAMILY } from '../config/constants';
import { initServices } from '../services/services';

/** Loads the font, the save data and the preloader's own images. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const key of BOOT_ASSETS) this.load.image(key, assetUrl(key));
  }

  async create(): Promise<void> {
    await Promise.all([loadFont(), initServices()]);
    this.scene.start('Preload');
  }
}

async function loadFont(): Promise<void> {
  try {
    const face = new FontFace(FONT_FAMILY, `url(${fontUrl})`);
    await face.load();
    document.fonts.add(face);
  } catch (err) {
    console.warn('Font failed to load, falling back to system font', err);
  }
}
