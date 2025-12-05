
const MEMORY_KEY = 'submaster_translation_memory_v1';

/**
 * Normalizes text for storage key (trims and lowercase for better hit rate, 
 * though case-sensitivity might be desired, we'll keep it case-sensitive for accuracy).
 */
const normalizeKey = (text: string): string => {
  return text.trim();
};

export const loadTranslationMemory = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem(MEMORY_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Failed to load translation memory", e);
    return {};
  }
};

export const saveTranslationMemory = (memory: Record<string, string>) => {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch (e) {
    // LocalStorage might be full
    console.warn("Failed to save translation memory", e);
  }
};

export const getFromMemory = (sourceText: string): string | undefined => {
  const memory = loadTranslationMemory();
  return memory[normalizeKey(sourceText)];
};

export const addToMemory = (sourceText: string, translatedText: string) => {
  if (!sourceText || !translatedText) return;
  const memory = loadTranslationMemory();
  memory[normalizeKey(sourceText)] = translatedText.trim();
  saveTranslationMemory(memory);
};

export const clearMemory = () => {
  localStorage.removeItem(MEMORY_KEY);
};

export const getMemorySize = (): number => {
    return Object.keys(loadTranslationMemory()).length;
};
