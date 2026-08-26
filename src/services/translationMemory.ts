const MEMORY_KEY = 'submaster_translation_memory_v1';
const MAX_MEMORY_ITEMS = 10000;

const normalizeKey = (text: string): string => text.trim();

export const loadTranslationMemory = (): Record<string, string> => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const stored = localStorage.getItem(MEMORY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error('Failed to load translation memory', e);
    return {};
  }
};

export const saveTranslationMemory = (memory: Record<string, string>) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch (e: any) {
    if (
      e?.name === 'QuotaExceededError' ||
      e?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      String(e).includes('quota')
    ) {
      console.warn('Translation Memory Full! Cleaning up old entries...');
      const keys = Object.keys(memory);
      const itemsToRemove = Math.max(1, Math.floor(keys.length * 0.2));
      for (let i = 0; i < itemsToRemove; i++) {
        delete memory[keys[i]];
      }
      try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
      } catch (retryErr) {
        console.error('Failed to save even after cleanup', retryErr);
      }
    } else {
      console.warn('Failed to save translation memory', e);
    }
  }
};

export const getFromMemory = (sourceText: string): string | undefined => {
  if (!sourceText) return undefined;
  const memory = loadTranslationMemory();
  return memory[normalizeKey(sourceText)];
};

export const addToMemory = (sourceText: string, translatedText: string) => {
  if (!sourceText || !translatedText) return;
  const key = normalizeKey(sourceText);
  const memory = loadTranslationMemory();
  memory[key] = translatedText.trim();
  const keys = Object.keys(memory);
  if (keys.length > MAX_MEMORY_ITEMS) {
    delete memory[keys[0]];
  }
  saveTranslationMemory(memory);
};

export const clearMemory = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(MEMORY_KEY);
  }
};

export const getMemorySize = (): number => {
  return Object.keys(loadTranslationMemory()).length;
};

/** No-op until IndexedDB module is fully landed; keeps call sites stable. */
export async function ensureTranslationMemoryReady(): Promise<void> {
  // Intentionally empty — TM is sync via localStorage for now.
}
