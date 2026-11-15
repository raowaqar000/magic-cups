import Phaser from 'phaser';
import { ASSET, isAssetKey, type AssetKey } from '../assets/manifest';
import { COLORS, DEPTH, TIMING } from '../config/constants';
import { LAYOUTS } from '../engine/layouts';
import { LevelSession, MAX_HEARTS, targetItemIndex, type PickResult } from '../engine/round';
import { generateShuffle, slotOfCup } from '../engine/shuffle';
import type { LevelConfig, ShuffleScript } from '../engine/types';
import { CupView } from '../game/CupView';
import { Fx } from '../game/Fx';
import { ShufflePlayer } from '../game/ShufflePlayer';
import { StageLayout, type SlotGeom } from '../game/StageLayout';
import { getLevel, LEVEL_COUNT } from '../levels/levels';
import { ads } from '../services/ads';
import { getProgress } from '../services/services';
import { addCoverBackground, addText, delay, tweenAsync } from '../ui/display';
import { Hud } from '../ui/Hud';
import { Popup, type PopupOpts } from '../ui/Popup';

export type RoundPhase = 'intro' | 'reveal' | 'drop' | 'countdown' | 'shuffle' | 'pick' | 'result' | 'popup';

export interface GameSceneData {
  level?: number;
}

/** Events other systems (Phase 2 magician, Phase 4 recorder, sound) can listen to via scene.events. */
export const GAME_EVENTS = {
  roundStart: 'round-start',
  shuffleStart: 'shuffle-start',
  shuffleEnd: 'shuffle-end',
  pick: 'pick',
  win: 'win',
  lose: 'lose',
} as const;

export class GameScene extends Phaser.Scene {
  private level!: LevelConfig;
  private session!: LevelSession;
  private stage!: StageLayout;
  private hud!: Hud;
  private fx!: Fx;
  private cups: CupView[] = [];
  private slots: SlotGeom[] = [];
  private script: ShuffleScript | null = null;
  private seed = '';
  private phase: RoundPhase = 'intro';
  private popup: Popup | null = null;
  private prompt: Phaser.GameObjects.Text | null = null;
  private stopSparkle: (() => void) | null = null;
  /** Bumped whenever a round is abandoned, so pending async steps stop. */
  private roundToken = 0;
  /** Dev: show which cup holds the ball. */
  debugShowBall = false;

  constructor() {
    super('Game');
  }

  init(data: GameSceneData): void {
    const progress = getProgress();
    const id = Phaser.Math.Clamp(data.level ?? progress.data.currentLevel, 1, LEVEL_COUNT);
    this.level = getLevel(id);
    this.session = new LevelSession(this.level);
    this.cups = [];
    this.popup = null;
    this.prompt = null;
    this.stopSparkle = null;
    this.script = null;
    this.phase = 'intro';
    progress.setCurrentLevel(id);
  }

  create(): void {
    this.stage = new StageLayout(this.scale.height);
    this.fx = new Fx(this);
    addCoverBackground(this, ASSET.bgStage).setDepth(DEPTH.bg);

    // Phase 2: the magician goes in this.stage.magicianZone (between HUD and floor).

    this.hud = new Hud(this, () => this.openPause());
    this.hud.setLevel(this.level.id);
    this.hud.setHearts(this.session.hearts);
    this.hud.setCoins(getProgress().data.coins);

    this.slots = this.stage.slots(this.level.layout);

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onAppHidden, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.roundToken++;
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onAppHidden, this);
    });

    if (import.meta.env.DEV) {
      void import('../debug/DebugTools').then((m) => m.attachDebugTools(this));
    }

    void this.startRound();
  }

  // ---------------------------------------------------------------- round flow

  private async startRound(): Promise<void> {
    const token = ++this.roundToken;
    const alive = () => token === this.roundToken && this.sys.isActive();
    this.clearRound();

    this.seed = this.session.nextRoundSeed();
    const script = generateShuffle(this.level, this.seed);
    this.script = script;
    this.events.emit(GAME_EVENTS.roundStart, { level: this.level, seed: this.seed, script });

    // Build cups: cup i starts in slot i.
    this.phase = 'intro';
    const cupKey = this.cupAsset();
    const width = this.stage.cupWidth(this.level.layout);
    this.cups = this.slots.map((slot, i) => {
      const cup = new CupView(this, i, cupKey, width);
      cup.setPosition(slot.x, slot.y);
      cup.baseScale = slot.scale;
      cup.updateDepth();
      cup.cup.on('pointerup', () => this.onCupTapped(cup));
      return cup;
    });
    script.initial.itemCup.forEach((cupId, itemIndex) => {
      const asset = this.level.items[itemIndex].asset;
      this.cups[cupId].setItem(isAssetKey(asset) ? asset : ASSET.ballGold);
    });
    this.applyDebugMarkers();

    // Cups pop in.
    await Promise.all(
      this.cups.map((cup, i) => {
        cup.setScale(0).setAlpha(0);
        return tweenAsync(this, {
          targets: cup,
          scale: cup.baseScale,
          alpha: 1,
          delay: i * TIMING.cupsAppearStagger,
          duration: TIMING.cupsAppear,
          ease: 'Back.easeOut',
        });
      }),
    );
    if (!alive()) return;

    // Reveal: in a single row every cup lifts; in grids only cups hiding items lift,
    // because a lifted front-row cup would cover the back row.
    this.phase = 'reveal';
    const singleRow = LAYOUTS[this.level.layout].rows === 1;
    const revealCups = this.cups.filter((c) => singleRow || c.hasItem());
    await Promise.all(revealCups.map((c) => c.lift(TIMING.lift)));
    if (!alive()) return;
    const target = this.cups[script.initial.itemCup[targetItemIndex(this.level)]];
    const p = target.itemWorldPos();
    this.fx.sparkleBurst(p.x, p.y, 5, 70);
    this.stopSparkle = this.fx.sparkleLoop(p.x, p.y - 10, target.cupWidth * 0.42);
    await delay(this, TIMING.revealHold);
    if (!alive()) return;
    this.stopSparkle?.();
    this.stopSparkle = null;

    this.phase = 'drop';
    await Promise.all(revealCups.map((c) => c.drop(TIMING.drop)));
    if (!alive()) return;

    this.phase = 'countdown';
    await this.countdown();
    if (!alive()) return;

    this.phase = 'shuffle';
    this.events.emit(GAME_EVENTS.shuffleStart, script);
    await new ShufflePlayer(this, this.slots, this.cups, script).play(script, alive);
    if (!alive()) return;
    this.events.emit(GAME_EVENTS.shuffleEnd, script);

    this.phase = 'pick';
    this.prompt = addText(this, this.scale.width / 2, this.stage.messageY, 'TAP THE CUP!', 52, { color: COLORS.gold }).setDepth(
      DEPTH.countdown,
    );
    this.prompt.setScale(0);
    this.tweens.add({ targets: this.prompt, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.prompt, scale: 1.08, duration: 520, yoyo: true, repeat: -1, delay: 300, ease: 'Sine.easeInOut' });
  }

  private async countdown(): Promise<void> {
    for (const n of ['3', '2', '1']) {
      const t = addText(this, this.scale.width / 2, this.stage.messageY - 40, n, 150, { color: COLORS.gold }).setDepth(
        DEPTH.countdown,
      );
      t.setScale(0.2).setAlpha(0);
      await tweenAsync(this, { targets: t, scale: 1, alpha: 1, duration: TIMING.countdownStep * 0.45, ease: 'Back.easeOut' });
      await tweenAsync(this, { targets: t, scale: 1.4, alpha: 0, duration: TIMING.countdownStep * 0.55, ease: 'Quad.easeIn' });
      t.destroy();
    }
  }

  private async onCupTapped(cup: CupView): Promise<void> {
    if (this.phase !== 'pick' || !this.script || this.popup) return;
    this.phase = 'result';
    const token = this.roundToken;
    const alive = () => token === this.roundToken && this.sys.isActive();

    this.prompt?.destroy();
    this.prompt = null;

    const slot = slotOfCup(this.script.final.cupAtSlot, cup.cupId);
    const result = this.session.resolvePick(slot, this.script);
    this.events.emit(GAME_EVENTS.pick, result);

    await cup.lift(TIMING.lift);
    if (!alive()) return;

    if (result.correct) await this.playWin(cup, result, alive);
    else await this.playLose(cup, result, alive);
  }

  private async playWin(cup: CupView, result: PickResult, alive: () => boolean): Promise<void> {
    const p = cup.itemWorldPos();
    this.fx.lightBurst(p.x, p.y);
    this.fx.confetti(p.x, p.y - 20);
    this.fx.sparkleBurst(p.x, p.y, 8, 120);

    const record = getProgress().recordWin(this.level.id, result.stars);
    this.events.emit(GAME_EVENTS.win, { result, record });
    if (record.coinsEarned > 0) {
      this.fx.floatText(p.x, p.y - 90, `+${record.coinsEarned}`);
      const coin = this.hud.coinPosition();
      this.time.delayedCall(450, () => {
        this.fx.flyCoins(p.x, p.y - 40, coin.x, coin.y);
        this.time.delayedCall(650, () => this.hud.setCoins(getProgress().data.coins, true));
      });
    }

    await delay(this, TIMING.afterResultHold + 400);
    if (!alive()) return;

    this.showPopup({
      title: 'WELL DONE!',
      subtitle: `LEVEL ${this.level.id} COMPLETE`,
      stars: result.stars,
      coins: record.coinsEarned,
      buttons: [
        {
          label: 'NEXT',
          style: 'green',
          onClick: () => {
            if (record.finishedAll) void this.showComingSoon();
            else this.gotoLevel(this.level.id + 1);
          },
        },
        { label: 'HOME', style: 'orange', onClick: () => this.goHome() },
      ],
    });
  }

  private async playLose(cup: CupView, result: PickResult, alive: () => boolean): Promise<void> {
    this.fx.smokePuff(cup.x, cup.y - cup.cupWidth * 0.3, cup.cupWidth * 1.1);
    this.hud.setHearts(result.heartsLeft, true);
    this.events.emit(GAME_EVENTS.lose, result);
    this.cameras.main.shake(180, 0.006);

    await delay(this, 650);
    if (!alive()) return;

    const target = this.cups[result.targetCup];
    await target.lift(TIMING.lift);
    if (!alive()) return;
    const p = target.itemWorldPos();
    this.fx.sparkleBurst(p.x, p.y, 6, 90);
    this.stopSparkle = this.fx.sparkleLoop(p.x, p.y - 10, target.cupWidth * 0.42);

    await delay(this, TIMING.afterResultHold);
    if (!alive()) return;

    if (result.gameOver) this.showGameOver();
    else
      this.showPopup({
        title: 'MISSED!',
        subtitle: `LEVEL ${this.level.id}`,
        hearts: result.heartsLeft,
        lines: ['Keep your eye on the ball!'],
        buttons: [
          { label: 'TRY AGAIN', style: 'orange', onClick: () => this.retry() },
          { label: 'HOME', style: 'green', onClick: () => this.goHome() },
        ],
      });
  }

  private showGameOver(): void {
    this.showPopup({
      title: 'GAME OVER',
      subtitle: `LEVEL ${this.level.id}`,
      hearts: 0,
      lines: ['Out of hearts!'],
      buttons: [
        {
          label: 'EXTRA LIFE',
          style: 'ad',
          onClick: async () => {
            const granted = await ads.showRewarded();
            if (!granted) return;
            this.session.addHeart();
            this.hud.setHearts(this.session.hearts, true);
            this.retry();
          },
        },
        {
          label: 'TRY AGAIN',
          style: 'orange',
          onClick: () => {
            this.session.restart();
            this.hud.setHearts(MAX_HEARTS, true);
            this.retry();
          },
        },
        { label: 'HOME', style: 'green', onClick: () => this.goHome() },
      ],
    });
  }

  private async showComingSoon(): Promise<void> {
    await this.popup?.close();
    this.popup = null;
    this.showPopup({
      title: 'AMAZING!',
      stars: 3,
      lines: ['You beat all 20 levels!', 'More levels coming soon!'],
      buttons: [
        { label: 'PLAY AGAIN', style: 'green', onClick: () => this.gotoLevel(1) },
        { label: 'HOME', style: 'orange', onClick: () => this.goHome() },
      ],
    });
  }

  // ---------------------------------------------------------------- navigation

  private showPopup(opts: PopupOpts): void {
    this.phase = 'popup';
    this.popup = new Popup(this, opts);
  }

  private async retry(): Promise<void> {
    const popup = this.popup;
    this.popup = null;
    await popup?.close();
    void this.startRound();
  }

  gotoLevel(id: number): void {
    this.roundToken++;
    this.scene.restart({ level: ((id - 1 + LEVEL_COUNT) % LEVEL_COUNT) + 1 } satisfies GameSceneData);
  }

  private goHome(): void {
    this.roundToken++;
    this.scene.start('Title');
  }

  /** Restart from the pause menu: full hearts, fresh round. */
  restartLevel(): void {
    this.session.restart();
    this.hud.setHearts(this.session.hearts);
    const popup = this.popup;
    this.popup = null;
    popup?.destroy();
    void this.startRound();
  }

  private openPause(): void {
    if (this.popup || !this.sys.isActive()) return;
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private onAppHidden(): void {
    if (this.phase !== 'popup') this.openPause();
  }

  private clearRound(): void {
    this.stopSparkle?.();
    this.stopSparkle = null;
    this.prompt?.destroy();
    this.prompt = null;
    this.cups.forEach((c) => {
      this.tweens.killTweensOf(c);
      this.tweens.killTweensOf(c.cup);
      c.destroy();
    });
    this.cups = [];
  }

  private cupAsset(): AssetKey {
    return isAssetKey(this.level.cup) ? this.level.cup : ASSET.ballGold;
  }

  // ---------------------------------------------------------------- debug hooks

  applyDebugMarkers(): void {
    this.cups.forEach((c) => c.setMarkerVisible(this.debugShowBall));
  }

  debugInfo(): { level: LevelConfig; seed: string; phase: RoundPhase; hearts: number; attempt: number } {
    return {
      level: this.level,
      seed: this.seed,
      phase: this.phase,
      hearts: this.session.hearts,
      attempt: this.session.attempt,
    };
  }

  get magicianZone(): { top: number; bottom: number } {
    return this.stage.magicianZone;
  }

  get levelId(): number {
    return this.level.id;
  }
}
