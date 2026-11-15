/**
 * Rewarded-ad placeholder. Phase 5 replaces the body with AdMob (Capacitor plugin);
 * callers already await a boolean "reward granted".
 */
export const ads = {
  async showRewarded(): Promise<boolean> {
    return true;
  },
};
