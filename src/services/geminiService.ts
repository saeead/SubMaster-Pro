
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
 * Transforms raw API errors into user-friendly Persian messages with actionable advice.
 */
const getFriendlyErrorMessage = (error: any, modelName: string): string => {
  const msg = (error.message || error.toString()).toLowerCase();

  if (msg.includes('400') || msg.includes('invalid_argument')) {
    return 'خطای درخواست (400): اطلاعات ارسالی نامعتبر است.';
  }
  if (msg.includes('401') || msg.includes('unauthenticated') || msg.includes('api key not valid')) {
    return 'خطای احراز هویت (401): کلید API نامعتبر است.';
  }
  if (msg.includes('403') || msg.includes('permission_denied')) {
    return 'خطای دسترسی (403): کلید شما اجازه دسترسی به این مدل را ندارد (احتمالاً تحریم).';
  }
  if (msg.includes('404') || msg.includes('not_found')) {
    return `خطای مدل (404): مدل "${modelName}" یافت نشد.`;
  }
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota')) {
    return 'پایان اعتبار (429): سقف استفاده از کلید API پر شده است.';
  }
  if (msg.includes('500') || msg.includes('503') || msg.includes('internal') || msg.includes('unavailable')) {
    return 'خطای سرور گوگل (503): سرویس موقتاً در دسترس نیست.';
  }
  if (msg.includes('safety') || msg.includes('blocked')) {
    return 'خطای محتوا: ترجمه توسط فیلترهای ایمنی مسدود شد.';
  }
  if (msg.includes('fetch failed') || msg.includes('networkerror')) {
    return 'خطای شبکه: اتصال اینترنت یا فیلترشکن را بررسی کنید.';
  }

  return `خطای ناشناخته: ${msg.substring(0, 100)}...`;
};

/**
 * Validates a specific API Key.
 */
export const validateAPIConnection = async (apiKey: string, strictMode: boolean = false): Promise<boolean> => {
  if (!apiKey) return false;

  try {
     const ai = new GoogleGenAI({ apiKey: apiKey });
     await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Hi',
     });
     return true;
  } catch (e: any) {
     const errorMessage = (e.message || JSON.stringify(e)).toLowerCase();
     const isRateLimit = errorMessage.includes("429") || errorMessage.includes("resource_exhausted");

     if (strictMode && isRateLimit) return false;
     if (!strictMode && isRateLimit) return true; // Accept rate limited keys during setup

     return false;
  }
};

/**
 * Manages rotation and fallback of API Keys
 */
class APIKeyManager {
  private keys: { key: string; isRateLimited: boolean }[] = [];
  private currentIndex = 0;

  constructor(userKeys: UserAPIKey[]) {
    userKeys.forEach(k => {
      if (k.isValid) {
        this.keys.push({ key: k.key, isRateLimited: k.isRateLimited });
      }
    });
  }

  public getNextAvailableKey(): string | null {
      for (let i = 0; i < this.keys.length; i++) {
          if (!this.keys[i].isRateLimited) return this.keys[i].key;
      }
      return null;
  }

  public getActiveKey(): string {
    const availableKeyIndex = this.keys.findIndex(k => !k.isRateLimited);
    if (availableKeyIndex === -1) {
      if (this.keys.length === 0) throw new Error("No valid API Keys available.");
      throw new Error("429: All API Keys are Rate Limited.");
    }
    this.currentIndex = availableKeyIndex;
    return this.keys[this.currentIndex].key;
  }

  public markCurrentAsRateLimited() {
    if (this.keys[this.currentIndex]) {
      this.keys[this.currentIndex].isRateLimited = true;
    }
  }

  public markKeyAsRateLimited(keyStr: string) {
      const target = this.keys.find(k => k.key === keyStr);
      if (target) target.isRateLimited = true;
  }

  public hasAvailableKeys(): boolean {
    return this.keys.some(k => !k.isRateLimited);
  }
}

/**
 * Core translation function with Anti-Lazy protection and Key Rotation
 */
export const translateBatch = async (
  targetBatch: BatchRequest[],
  contextPre: BatchRequest[],
  contextPost: BatchRequest[],
  settings: AppSettings,
  onKeyRateLimit?: (key: string) => void
): Promise<BatchResponse[]> => {
  let attempt = 0;
  const { maxRetries, baseDelay } = APP_CONFIG.retryConfig;
  
  let modelName = APP_CONFIG.geminiModels.standard;
  if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
  else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;
  else if (settings.model === 'flash_lite') modelName = APP_CONFIG.geminiModels.flash_lite;

  const keyManager = new APIKeyManager(settings.apiKeys);
  const totalAllowedAttempts = maxRetries + settings.apiKeys.length * 2;

  while (attempt < totalAllowedAttempts) {
    let currentApiKey = '';
    
    try {
      currentApiKey = keyManager.getActiveKey();
      const ai = new GoogleGenAI({ apiKey: currentApiKey });

      let userPrompt = "Input Data:\n";
      if (contextPre.length > 0) userPrompt += `\n--- PREVIOUS CONTEXT ---\n${JSON.stringify(contextPre)}`;
      userPrompt += `\n\n--- TARGET BLOCKS ---\n${JSON.stringify(targetBatch)}`;
      if (contextPost.length > 0) userPrompt += `\n\n--- FOLLOWING CONTEXT ---\n${JSON.stringify(contextPost)}`;
      userPrompt += "\n\nTask: Translate TARGET BLOCKS to Persian. Return JSON array.";

      const systemInstruction = getSystemInstruction(
        settings.tone, 
        settings.topic, 
        settings.customPrompt, 
        settings.outputStandard,
        settings.glossary
      );

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: settings.temperature || 0.7,
        },
      });

      if (!response.text) throw new Error("Empty response from Gemini");

      let parsedData: BatchResponse[];
      try {
        parsedData = JSON.parse(response.text) as BatchResponse[];
      } catch (e) {
        console.error("JSON Parse Error. Raw text:", response.text);
        throw new Error("Failed to parse Gemini JSON response");
      }

      // Basic validation
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
         // Fallback if model returns empty array but valid JSON
         throw new Error("Model returned empty data array");
      }

      return parsedData;

    } catch (error: any) {
      const errorMessage = (error.message || error.toString()).toLowerCase();
      const isRateLimit = errorMessage.includes("429") || errorMessage.includes("resource_exhausted");
      
      if (isRateLimit) {
        console.warn(`Rate Limit hit for key ...${currentApiKey.slice(-4)}`);
        keyManager.markCurrentAsRateLimited();
        if (onKeyRateLimit && currentApiKey) onKeyRateLimit(currentApiKey);

        // Try to find next working key immediately
        if (!keyManager.hasAvailableKeys()) {
             throw new Error(getFriendlyErrorMessage(new Error("429 RESOURCE_EXHAUSTED"), modelName));
        }
        await delay(1000); 
      } else {
        console.warn(`Attempt ${attempt + 1} failed:`, error);
        attempt++;
        const waitTime = baseDelay * Math.pow(1.5, attempt); // Exponential backoff
        await delay(waitTime);
      }
    }
  }

  throw new Error("Failed to process batch after multiple retries.");
};

export const translateFreeText = async (text: string, settings: AppSettings): Promise<string> => {
    if (!text || !text.trim()) return '';

    let modelName = APP_CONFIG.geminiModels.standard;
    if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
    else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;

    const keyManager = new APIKeyManager(settings.apiKeys);
    let attempt = 0;
    const maxRetries = 2 + settings.apiKeys.length;

    while (attempt < maxRetries) {
        try {
            const currentApiKey = keyManager.getActiveKey();
            const ai = new GoogleGenAI({ apiKey: currentApiKey });
            const response = await ai.models.generateContent({
                model: modelName,
                contents: text,
                config: {
                    systemInstruction: `Translate to Persian (${settings.tone} tone). Preserve formatting.`,
                    temperature: settings.temperature || 0.7,
                },
            });
            return response.text || '';
        } catch (error: any) {
            const msg = (error.message || "").toLowerCase();
            if (msg.includes("429") || msg.includes("resource_exhausted")) {
                keyManager.markCurrentAsRateLimited();
                if (!keyManager.hasAvailableKeys()) throw new Error("All keys exhausted");
                await delay(500);
            } else {
                attempt++;
                if (attempt >= maxRetries) throw error;
                await delay(1000);
            }
        }
    }
    throw new Error("Failed to translate text.");
};
