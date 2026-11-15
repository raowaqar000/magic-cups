/**
 * Async key/value storage. The async API matches Capacitor Preferences, so swapping
 * LocalStorageStore for a CapacitorStore later needs no changes in game code.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly prefix = 'magiccups:') {}

  async get(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(this.prefix + key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      window.localStorage.setItem(this.prefix + key, value);
    } catch {
      // Storage full or blocked: the game keeps running with in-memory state.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(this.prefix + key);
    } catch {
      // ignore
    }
  }
}

export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}
