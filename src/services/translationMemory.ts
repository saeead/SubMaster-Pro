import * as idb from '../db/indexedDb';

const LEGACY_MEMORY_KEY = 'submaster_translation_memory_v1';
const MAX_MEMORY_ITEMS = 10000;

/** In-memory cache kept in sync with IndexedDB for sync read path during translation. */
let memoryCache: Record<string, string> | null = null;
let hydrationPromise: Promise<void> | null = null;

const normalizeKey = (text: string): string => text.trim();

async function hydrateCache(): Promise<void> {
  if (memoryCache !== null) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    try {
      if (idb.isIndexedDbAvailable()) {
        const flag = await idb.getMeta<string>('legacyTMMigratedAt');
        if (!flag && typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem(LEGACY_MEMORY_KEY);
          if (stored) {
            try {
              const legacy = JSON.parse(stored) as Record<string, string>;
              await idb.saveAllTM(legacy);
              localStorage.removeItem(LEGACY_MEMORY_KEY);
              console.info(`[TranslationMemory] Migrated ${Object.keys(legacy).length} entries to IndexedDB`);
            } catch { /* ignore parse errors */ }
          }
          await idb.setMeta('legacyTMMigratedAt', new Date().toISOString());
        }
        memoryCache = await idb.loadAllTM();
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LEGACY_MEMORY_KEY);
        memoryCache = stored ? JSON.parse(stored) : {};
      } else {
        memoryCache = {};
      }
    } catch (e) {
      console.error('Failed to hydrate translation memory', e);
      memoryCache = {};
    }
  })();

  return hydrationPromise;
}

/** Call once at app startup. */
export async function ensureTranslationMemoryReady(): Promise<void> {
  await hydrateCache();
}

export const loadTranslationMemory = (): Record<string, string> => {
  if (memoryCache === null) {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(LEGACY_MEMORY_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  }
  return memoryCache;
};

const persistCache = (): void => {
  if (memoryCache === null) return;
  const snapshot = { ...memoryCache };
  if (idb.isIndexedDbAvailable()) {
    void idb.saveAllTM(snapshot).then(async () => {
      if (Object.keys(snapshot).length > MAX_MEMORY_ITEMS) {
        await idb.pruneTM(MAX_MEMORY_ITEMS);
        memoryCache = await idb.loadAllTM();
      }
    }).catch((e) => console.warn('TM persist failed', e));
  } else if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LEGACY_MEMORY_KEY, JSON.stringify(snapshot));
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError' || String(e).includes('quota')) {
        const keys = Object.keys(snapshot);
        const remove = Math.max(1, Math.floor(keys.length * 0.2));
        for (let i = 0; i < remove; i++) delete snapshot[keys[i]];
        memoryCache = snapshot;
        try {
          localStorage.setItem(LEGACY_MEMORY_KEY, JSON.stringify(snapshot));
        } catch { /* give up */ }
      }
    }
  }
};

export const saveTranslationMemory = (memory: Record<string, string>): void => {
  memoryCache = memory;
  persistCache();
};

export const getFromMemory = (sourceText: string): string | undefined => {
  if (!sourceText) return undefined;
  const memory = loadTranslationMemory();
  return memory[normalizeKey(sourceText)];
};

export const addToMemory = (sourceText: string, translatedText: string): void => {
  if (!sourceText || !translatedText) return;
  const key = normalizeKey(sourceText);
  if (memoryCache === null) memoryCache = loadTranslationMemory();
  memoryCache[key] = translatedText.trim();

  const keys = Object.keys(memoryCache);
  if (keys.length > MAX_MEMORY_ITEMS) {
    delete memoryCache[keys[0]];
  }
  persistCache();
};

export const clearMemory = (): void => {
  memoryCache = {};
  if (idb.isIndexedDbAvailable()) {
    void idb.clearTM();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_MEMORY_KEY);
  }
};

export const getMemorySize = (): number => {
  return Object.keys(loadTranslationMemory()).length;
};
