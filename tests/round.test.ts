import { describe, expect, it } from 'vitest';
import { coinsForWin, LevelSession, MAX_HEARTS, roundSeed, starsForAttempt } from '../src/engine/round';
import { finalItemSlot, generateShuffle } from '../src/engine/shuffle';
import { getLevel } from '../src/levels/levels';

describe('scoring', () => {
  it('stars: 3 first try, 2 second, 1 after', () => {
    expect([1, 2, 3, 4, 9].map(starsForAttempt)).toEqual([3, 2, 1, 1, 1]);
  });

  it('coins: 10 per star first time, only improvements on replay', () => {
    expect(coinsForWin(3, 0)).toBe(30);
    expect(coinsForWin(2, 0)).toBe(20);
    expect(coinsForWin(3, 2)).toBe(10);
    expect(coinsForWin(2, 3)).toBe(0);
    expect(coinsForWin(3, 3)).toBe(0);
  });

  it('round seeds differ per round but are deterministic', () => {
    expect(roundSeed('L001', 0)).toBe('L001#0');
    expect(roundSeed('L001', 1)).not.toBe(roundSeed('L001', 0));
  });
});

describe('LevelSession', () => {
  const level = getLevel(5);

  function play(session: LevelSession) {
    const script = generateShuffle(level, session.nextRoundSeed());
    return { script, target: finalItemSlot(script, 0) };
  }

  it('correct first pick gives 3 stars and keeps hearts', () => {
    const s = new LevelSession(level);
    const { script, target } = play(s);
    const r = s.resolvePick(target, script);
    expect(r.correct).toBe(true);
    expect(r.stars).toBe(3);
    expect(r.heartsLeft).toBe(MAX_HEARTS);
  });

  it('wrong picks cost hearts, lower stars, and end in game over', () => {
    const s = new LevelSession(level);
    for (let i = 1; i <= 3; i++) {
      const { script, target } = play(s);
      const wrong = (target + 1) % 4;
      const r = s.resolvePick(wrong, script);
      expect(r.correct).toBe(false);
      expect(r.targetSlot).toBe(target);
      expect(r.heartsLeft).toBe(MAX_HEARTS - i);
      expect(r.gameOver).toBe(i === 3);
    }
    s.addHeart();
    expect(s.hearts).toBe(1);
    const { script, target } = play(s);
    expect(s.resolvePick(target, script).stars).toBe(1);
  });

  it('second-try win gives 2 stars', () => {
    const s = new LevelSession(level);
    let { script, target } = play(s);
    s.resolvePick((target + 1) % 4, script);
    ({ script, target } = play(s));
    expect(s.resolvePick(target, script).stars).toBe(2);
  });

  it('restart refills hearts, resets attempts, but keeps new seeds coming', () => {
    const s = new LevelSession(level);
    const seed1 = s.nextRoundSeed();
    s.hearts = 0;
    s.attempt = 4;
    s.restart();
    expect(s.hearts).toBe(MAX_HEARTS);
    expect(s.attempt).toBe(1);
    expect(s.nextRoundSeed()).not.toBe(seed1);
  });

  it('addHeart never exceeds the max', () => {
    const s = new LevelSession(level);
    s.addHeart();
    expect(s.hearts).toBe(MAX_HEARTS);
  });
});
