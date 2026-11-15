import Phaser from 'phaser';
import { ASSET } from '../assets/manifest';
import { COLORS, DEPTH } from '../config/constants';
import { getProgress } from '../services/services';
import { Button } from '../ui/Button';
import { addImage, addText } from '../ui/display';
import type { GameScene } from './GameScene';

/**
 * Pause overlay. GameScene is paused underneath, which freezes all its tweens and
 * timers (including a shuffle in progress).
 */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    const { width, height } = this.scale;
    const progress = getProgress();
    this.add.rectangle(0, 0, width, height, COLORS.overlay, 0.65).setOrigin(0).setInteractive();

    const box = this.add.container(width / 2, height / 2).setDepth(DEPTH.popup);
    const panel = addImage(this, 0, 0, ASSET.panelPopup, 480);
    const top = -panel.displayHeight / 2;
    box.add([
      panel,
      addImage(this, 0, top + 30, ASSET.bannerRibbon, 570),
      addText(this, 0, top + 18, 'PAUSED', 50),
    ]);

    const close = new Button(this, 205, top + 110, ASSET.btnClose, { width: 74, onClick: () => this.resumeGame() });
    box.add(close);

    // Sound + music toggles (stored only; audio arrives in Phase 3).
    const soundBtn = new Button(this, -80, top + 250, ASSET.btnSoundOn, {
      width: 116,
      onClick: () => {
        progress.setSetting('sound', !progress.data.settings.sound);
        refresh();
      },
    });
    const musicBtn = new Button(this, 80, top + 250, ASSET.btnMusic, {
      width: 116,
      onClick: () => {
        progress.setSetting('music', !progress.data.settings.music);
        refresh();
      },
    });
    const soundLabel = addText(this, -80, top + 335, '', 28);
    const musicLabel = addText(this, 80, top + 335, '', 28);
    const musicSlash = this.add.graphics();
    box.add([soundBtn, musicBtn, soundLabel, musicLabel, musicSlash]);

    const refresh = () => {
      const { sound, music } = progress.data.settings;
      soundBtn.setTexture(sound ? ASSET.btnSoundOn : ASSET.btnSoundOff);
      soundLabel.setText(sound ? 'SOUND ON' : 'SOUND OFF');
      musicLabel.setText(music ? 'MUSIC ON' : 'MUSIC OFF');
      musicBtn.image.setTint(music ? 0xffffff : 0x8a8a8a);
      musicSlash.clear();
      if (!music) {
        musicSlash.lineStyle(12, 0xe0302a, 1);
        musicSlash.lineBetween(80 - 36, top + 250 - 36, 80 + 36, top + 250 + 36);
      }
    };
    refresh();

    box.add(
      new Button(this, 0, top + 470, ASSET.btnWideGreen, {
        width: 400,
        label: 'RESUME',
        fontSize: 40,
        onClick: () => this.resumeGame(),
      }),
    );
    box.add(
      new Button(this, 0, top + 590, ASSET.btnWideOrange, {
        width: 300,
        label: 'RESTART',
        fontSize: 40,
        onClick: () => {
          this.resumeGame();
          (this.scene.get('Game') as GameScene).restartLevel();
        },
      }),
    );
    box.add(
      new Button(this, 0, top + 710, ASSET.btnWideOrange, {
        width: 300,
        label: 'HOME',
        fontSize: 40,
        onClick: () => {
          this.scene.stop('Game');
          this.scene.start('Title');
        },
      }),
    );

    box.setScale(0.3);
    this.tweens.add({ targets: box, scale: 1, duration: 380, ease: 'Back.easeOut' });

    this.input.keyboard?.on('keydown-ESC', () => this.resumeGame());
  }

  private resumeGame(): void {
    this.scene.resume('Game');
    this.scene.stop();
  }
}
