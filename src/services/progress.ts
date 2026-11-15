import { coinsForWin, type Stars } from '../engine/round';
import type { KeyValueStore } from './storage';

export const SAVE_KEY = 'save';

export interface Settings {
  sound: boolean;
  music: boolean;
}

export interface SaveData {
  version: 1;
  currentLevel: number;
  highestUnlocked: number;
  stars: Record<string, Stars>;
  coins: number;
  settings: Settings;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    currentLevel: 1,
    highestUnlocked: 1,
    stars: {},
    coins: 0,
    settings: { sound: true, music: true },
  };
}

const clampInt = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;

/** Parses saved JSON defensively: anything missing or corrupt falls back to defaults. */
export function parseSave(raw: string | null, levelCount: number): SaveData {
  const d = defaultSave();
  if (!raw) return d;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return d;
  }
  if (!obj || typeof obj !== 'object') return d;
  const o = obj as Record<string, unknown>;
  const stars: Record<string, Stars> = {};
  if (o.stars && typeof o.stars === 'object') {
    for (const [k, v] of Object.entries(o.stars as Record<string, unknown>)) {
      const id = Number(k);
      if (Number.isInteger(id) && id >= 1 && id <= levelCount) stars[k] = clampInt(v, 0, 3, 0) as Stars;
    }
  }
  const settings = (o.settings && typeof o.settings === 'object' ? o.settings : {}) as Record<string, unknown>;
  const highestUnlocked = clampInt(o.highestUnlocked, 1, levelCount, 1);
  return {
    version: 1,
    highestUnlocked,
    currentLevel: clampInt(o.currentLevel, 1, levelCount, 1),
    stars,
    coins: clampInt(o.coins, 0, Number.MAX_SAFE_INTEGER, 0),
    settings: {
      sound: typeof settings.sound === 'boolean' ? settings.sound : true,
      music: typeof settings.music === 'boolean' ? settings.music : true,
    },
  };
}

export interface WinRecord {
  coinsEarned: number;
  previousStars: Stars;
  newBest: boolean;
  /** True when the player just finished the last level. */
  finishedAll: boolean;
}

/** In-memory save data with write-through to a KeyValueStore. */
export class Progress {
  private constructor(
    private readonly store: KeyValueStore,
    readonly levelCount: number,
    public data: SaveData,
  ) {}

  static async load(store: KeyValueStore, levelCount: number): Promise<Progress> {
    return new Progress(store, levelCount, parseSave(await store.get(SAVE_KEY), levelCount));
  }

  save(): Promise<void> {
    return this.store.set(SAVE_KEY, JSON.stringify(this.data));
  }

  starsFor(levelId: number): Stars {
    return this.data.stars[String(levelId)] ?? 0;
  }

  isUnlocked(levelId: number): boolean {
    return levelId >= 1 && levelId <= this.data.highestUnlocked;
  }

  recordWin(levelId: number, stars: Stars): WinRecord {
    const previousStars = this.starsFor(levelId);
    const coinsEarned = coinsForWin(stars, previousStars);
    if (stars > previousStars) this.data.stars[String(levelId)] = stars;
    this.data.coins += coinsEarned;
    const finishedAll = levelId >= this.levelCount;
    this.data.highestUnlocked = Math.min(this.levelCount, Math.max(this.data.highestUnlocked, levelId + 1));
    // After the last level, loop back to level 1.
    this.data.currentLevel = finishedAll ? 1 : levelId + 1;
    void this.save();
    return { coinsEarned, previousStars, newBest: stars > previousStars, finishedAll };
  }

  setCurrentLevel(levelId: number): void {
    this.data.currentLevel = Math.min(this.levelCount, Math.max(1, levelId));
    void this.save();
  }

  setSetting(key: keyof Settings, value: boolean): void {
    this.data.settings[key] = value;
    void this.save();
  }
}
