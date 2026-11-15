import Phaser from 'phaser';
import { COLORS, GAME_WIDTH, MAX_HEIGHT, MIN_HEIGHT } from './config/constants';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { TitleScene } from './scenes/TitleScene';

/** Fixed 720 width; height follows the screen's aspect ratio, clamped to 1280-1600. */
function computeGameHeight(): number {
  const w = window.innerWidth || GAME_WIDTH;
  const h = window.innerHeight || MIN_HEIGHT;
  return Phaser.Math.Clamp(Math.round((GAME_WIDTH * h) / w), MIN_HEIGHT, MAX_HEIGHT);
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.pageBg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: computeGameHeight(),
  },
  input: { activePointers: 2 },
  render: { antialias: true, roundPixels: false },
  scene: [BootScene, PreloadScene, TitleScene, GameScene, PauseScene],
});

// Phones don't change aspect at runtime (portrait-locked), but browsers and foldables can.
// When the height changes, resize the game and restart the visible scene so it re-lays out.
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const h = computeGameHeight();
    if (h === game.scale.height) return;
    game.scale.setGameSize(GAME_WIDTH, h);
    const sm = game.scene;
    if (sm.isActive('Pause') || sm.isPaused('Game')) {
      sm.stop('Pause');
      sm.getScene('Game').scene.restart();
    } else {
      for (const key of ['Title', 'Game', 'Preload']) {
        if (sm.isActive(key)) {
          if (key === 'Preload') return; // let loading finish; next scene uses the new size
          sm.getScene(key).scene.restart();
        }
      }
    }
  }, 250);
});

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
