import { LEVEL_COUNT } from '../levels/levels';
import { Progress } from './progress';
import { LocalStorageStore, type KeyValueStore } from './storage';

/** App-wide services, initialised once by BootScene. */
let progress: Progress | null = null;

export async function initServices(store: KeyValueStore = new LocalStorageStore()): Promise<void> {
  progress = await Progress.load(store, LEVEL_COUNT);
}

export function getProgress(): Progress {
  if (!progress) throw new Error('Services not initialised (BootScene must run first)');
  return progress;
}
