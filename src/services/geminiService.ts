
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BatchRequest, BatchResponse, AppSettings, UserAPIKey } from "../types";
import { APP_CONFIG, getSystemInstruction } from "../constants";

// Strict Schema to enforce the 1-to-1 mapping and ID preservation
const responseSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER, description: "The exact ID from the input block" },
      translatedText: { type: Type.STRING, description: "The Persian translation text" }
    },
    required: ["id", "translatedText"]
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates a specific API Key by making a lightweight call
 */
export const validateAPIConnection = async (apiKey: string): Promise<boolean> => {
  if (!apiKey) return false;

  try {
     const ai = new GoogleGenAI({ apiKey: apiKey });
     // Lightweight check to verify API key validity
     await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'test',
     });
     return true;
  } catch (e) {
     console.error("API Connection Validation Failed for provided key ending in ...", apiKey.slice(-4), e);
     return false;
  }
};

/**
 * Manages rotation and fallback of API Keys
 */
class APIKeyManager {
  private keys: { key: string; isRateLimited: boolean; source: 'USER' }[] = [];
  private currentIndex = 0;

  constructor(userKeys: UserAPIKey[]) {
    // 1. Add Valid User Keys
    userKeys.forEach(k => {
      if (k.isValid) {
        this.keys.push({ key: k.key, isRateLimited: false, source: 'USER' });
      }
    });

    // Note: System Key (process.env.API_KEY) support has been removed.
    // The application relies strictly on user-provided keys.
  }

  public getActiveKey(): string {
    if (this.keys.length === 0) {
      throw new Error("No valid API Keys available. Please add a valid API Key in settings.");
    }

    // Find the first key that is NOT rate limited
    // We try starting from currentIndex to rotate load, but if that's limited, we search others
    for (let i = 0; i < this.keys.length; i++) {
      const ptr = (this.currentIndex + i) % this.keys.length;
      if (!this.keys[ptr].isRateLimited) {
        this.currentIndex = ptr;
        return this.keys[ptr].key;
      }
    }

    // If all are rate limited, return the current one and hope for the best (or we could wait)
    console.warn("All API keys are marked as Rate Limited. Retrying with current key...");
    return this.keys[this.currentIndex].key;
  }

  public markCurrentAsRateLimited() {
    if (this.keys.length > 0) {
      console.warn(`Key ending in ...${this.keys[this.currentIndex].key.slice(-4)} marked as Rate Limited. Switching...`);
      this.keys[this.currentIndex].isRateLimited = true;
      // Move to next
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
  }

  public hasAvailableKeys(): boolean {
    return this.keys.some(k => !k.isRateLimited);
  }

  public resetRateLimits() {
    this.keys.forEach(k => k.isRateLimited = false);
  }
}

/**
 * Core translation function with Anti-Lazy protection, Advanced Prompts, and Key Rotation
 */
export const translateBatch = async (
  targetBatch: BatchRequest[],
  contextPre: BatchRequest[],
  contextPost: BatchRequest[],
  settings: AppSettings
): Promise<BatchResponse[]> => {
  let attempt = 0;
  const { maxRetries, baseDelay } = APP_CONFIG.retryConfig;
  
  const modelName = settings.model === 'professional' 
    ? APP_CONFIG.geminiModels.professional 
    : APP_CONFIG.geminiModels.standard;

  // Initialize Key Manager for this batch process session
  const keyManager = new APIKeyManager(settings.apiKeys);

  while (attempt < maxRetries * 2) { // Allow more attempts because of key switching
    try {
      const currentApiKey = keyManager.getActiveKey();
      const ai = new GoogleGenAI({ apiKey: currentApiKey });

      // Construct User Prompt with JSON Data
      let userPrompt = "Input Data:\n";
      
      if (contextPre.length > 0) {
        userPrompt += "\n--- PREVIOUS CONTEXT (Do NOT translate) ---\n";
        userPrompt += JSON.stringify(contextPre, null, 2);
      }

      userPrompt += "\n\n--- TARGET BLOCKS (Translate these) ---\n";
      userPrompt += JSON.stringify(targetBatch, null, 2);

      if (contextPost.length > 0) {
        userPrompt += "\n\n--- FOLLOWING CONTEXT (Do NOT translate) ---\n";
        userPrompt += JSON.stringify(contextPost, null, 2);
      }
      
      userPrompt += "\n\nTask: Translate the TARGET BLOCKS to Persian following the system instructions. Return ONLY the JSON array.";

      const systemInstruction = getSystemInstruction(settings.tone, settings.topic, settings.customPrompt);

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: (settings.tone === 'formal' || settings.tone === 'news') ? 0.3 : 0.7,
        },
      });

      if (!response.text) {
        throw new Error("Empty response from Gemini");
      }

      let parsedData: BatchResponse[];
      try {
        parsedData = JSON.parse(response.text) as BatchResponse[];
      } catch (e) {
        console.error("JSON Parse Error:", response.text);
        throw new Error("Failed to parse Gemini JSON response");
      }

      // --- ANTI-LAZY ALGORITHM VALIDATION ---
      if (parsedData.length !== targetBatch.length) {
        throw new Error(`Anti-Lazy Count mismatch: ${parsedData.length}/${targetBatch.length}`);
      }

      const inputIds = new Set(targetBatch.map(b => b.id));
      const allIdsValid = parsedData.every(b => inputIds.has(b.id));
      if (!allIdsValid) {
         throw new Error("Anti-Lazy: ID mismatch detected.");
      }

      return parsedData;

    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      const isRateLimit = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("Too Many Requests");
      
      if (isRateLimit) {
        console.warn(`Rate Limit hit on attempt ${attempt + 1}. Switching keys...`);
        keyManager.markCurrentAsRateLimited();
        // Do NOT increment 'attempt' significantly if we just switched keys, 
        // give the new key a fair chance.
      } else {
        console.warn(`Translation Attempt ${attempt + 1} failed (Non-RateLimit):`, error);
        attempt++;
      }

      if (attempt >= maxRetries * 2) { // Hard stop
        throw error;
      }

      // Exponential Backoff
      const waitTime = baseDelay * Math.pow(1.5, attempt); // Slower backoff
      await delay(waitTime);
    }
  }

  throw new Error("Failed to process batch after retries and key rotation.");
};
