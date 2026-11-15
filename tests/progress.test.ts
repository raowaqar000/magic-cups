import { describe, expect, it } from 'vitest';
import { defaultSave, parseSave, Progress, SAVE_KEY } from '../src/services/progress';
import { MemoryStore } from '../src/services/storage';

describe('parseSave', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(parseSave(null, 20)).toEqual(defaultSave());
    expect(parseSave('{not json', 20)).toEqual(defaultSave());
    expect(parseSave('42', 20)).toEqual(defaultSave());
  });

  it('clamps out-of-range values', () => {
    const s = parseSave(
      JSON.stringify({ currentLevel: 99, highestUnlocked: -3, coins: -5, stars: { '1': 7, '50': 3, x: 2 } }),
      20,
    );
    expect(s.currentLevel).toBe(20);
    expect(s.highestUnlocked).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.stars).toEqual({ '1': 3 });
  });
});

describe('Progress', () => {
  it('records wins, unlocks next level, pays coins once per star', async () => {
    const store = new MemoryStore();
    const p = await Progress.load(store, 20);
    expect(p.recordWin(1, 2)).toMatchObject({ coinsEarned: 20, newBest: true });
    expect(p.data.highestUnlocked).toBe(2);
    expect(p.data.currentLevel).toBe(2);
    expect(p.recordWin(1, 3).coinsEarned).toBe(10);
    expect(p.recordWin(1, 1).coinsEarned).toBe(0);
    expect(p.starsFor(1)).toBe(3);
    expect(p.data.coins).toBe(30);
  });

  it('loops back to level 1 after the last level', async () => {
    const p = await Progress.load(new MemoryStore(), 20);
    const r = p.recordWin(20, 3);
    expect(r.finishedAll).toBe(true);
    expect(p.data.currentLevel).toBe(1);
    expect(p.data.highestUnlocked).toBe(20);
  });

  it('persists and reloads through the store', async () => {
    const store = new MemoryStore();
    const p = await Progress.load(store, 20);
    p.recordWin(1, 3);
    p.setSetting('music', false);
    await p.save();
    expect(store.data.has(SAVE_KEY)).toBe(true);
    const again = await Progress.load(store, 20);
    expect(again.data).toEqual(p.data);
    expect(again.data.settings.music).toBe(false);
  });
});
