

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
  const msg = error.message || error.toString();

  // 400 Bad Request
  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
    return 'خطای درخواست (400): اطلاعات ارسالی به هوش مصنوعی نامعتبر است. این ممکن است به دلیل فرمت نامناسب فایل یا کاراکترهای خاص باشد.';
  }

  // 401 Unauthorized / Invalid API Key
  if (msg.includes('401') || msg.includes('API key not valid') || msg.includes('UNAUTHENTICATED')) {
    return 'خطای احراز هویت (401): کلید API وارد شده نامعتبر یا منقضی شده است. لطفاً به بخش تنظیمات بروید و کلید خود را بررسی کنید.';
  }
  
  // 403 Permission Denied
  if (msg.includes('403') || msg.includes('permission denied') || msg.includes('PERMISSION_DENIED')) {
    return 'خطای دسترسی (403): کلید API شما اجازه استفاده از این مدل را ندارد. اگر از کلید رایگان استفاده می‌کنید، ممکن است منطقه (Region) شما تحریم شده باشد. لطفاً از نرم‌افزار تغییر IP معتبر استفاده کنید یا پروژه جدیدی در گوگل کنسول بسازید.';
  }

  // 404 Not Found (Model Name Error)
  if (msg.includes('404') || msg.includes('not found') || msg.includes('NOT_FOUND')) {
    return `خطای مدل (404): مدل انتخاب شده "${modelName}" یافت نشد. این مدل ممکن است منقضی شده باشد یا برای کلید شما فعال نباشد. لطفاً در تنظیمات، مدل را تغییر دهید (مثلاً از Professional به Standard یا برعکس).`;
  }

  // 429 Rate Limit
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'پایان اعتبار تمام کلیدها (429): تمامی کلیدهای API وارد شده به سقف مجاز (Quota) رسیده‌اند. لطفاً کلیدهای جدید اضافه کنید یا فردا مجدداً تلاش نمایید.';
  }

  // 5xx Server Errors
  if (msg.includes('500') || msg.includes('503') || msg.includes('internal') || msg.includes('UNAVAILABLE')) {
    return 'خطای سرور گوگل (503): سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً چند دقیقه دیگر تلاش کنید.';
  }
  
  // Safety Filters
  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('finishReason')) {
    return 'خطای محتوا: ترجمه توسط فیلترهای ایمنی گوگل مسدود شد. ممکن است بخشی از متن شامل محتوای حساس باشد که هوش مصنوعی از ترجمه آن خودداری می‌کند.';
  }

  // Network / Fetch Errors
  if (msg.includes('fetch failed') || msg.includes('NetworkError') || msg.includes('Load failed')) {
    return 'خطای شبکه: امکان برقراری ارتباط با سرور گوگل وجود ندارد. لطفاً اتصال اینترنت خود را بررسی کنید و حتماً از نرم‌افزار تغییر IP (فیلترشکن) استفاده نمایید.';
  }

  // Fallback
  return `خطای ناشناخته در ارتباط با هوش مصنوعی: ${msg.substring(0, 150)}...`;
};

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
  } catch (e: any) {
     const errorMessage = e.message || JSON.stringify(e);
     
     // 429 / Resource Exhausted means the key IS valid (auth succeeded), just out of quota.
     // We should allow adding it so the rotation manager can use it later.
     if (
         errorMessage.includes("429") || 
         errorMessage.includes("quota") || 
         errorMessage.includes("RESOURCE_EXHAUSTED") ||
         errorMessage.includes("Too Many Requests")
     ) {
         console.warn(`API Key validation (..${apiKey.slice(-4)}): Key is valid but currently Rate Limited.`);
         return true;
     }

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
        this.keys.push({ key: k.key, isRateLimited: k.isRateLimited, source: 'USER' });
      }
    });
  }

  public getActiveKey(): string {
    // Find the first key that is NOT rate limited
    const availableKeyIndex = this.keys.findIndex(k => !k.isRateLimited);
    
    if (availableKeyIndex === -1) {
      if (this.keys.length === 0) {
          throw new Error("No valid API Keys available.");
      }
      throw new Error("429: All API Keys are Rate Limited.");
    }
    
    this.currentIndex = availableKeyIndex;
    return this.keys[this.currentIndex].key;
  }

  public markCurrentAsRateLimited() {
    if (this.keys.length > 0) {
      this.keys[this.currentIndex].isRateLimited = true;
    }
  }

  public hasAvailableKeys(): boolean {
    return this.keys.some(k => !k.isRateLimited);
  }
}

/**
 * Core translation function with Anti-Lazy protection, Advanced Prompts, and Key Rotation
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
  
  const modelName = settings.model === 'professional' 
    ? APP_CONFIG.geminiModels.professional 
    : APP_CONFIG.geminiModels.standard;

  // Initialize Key Manager for this batch process session
  const keyManager = new APIKeyManager(settings.apiKeys);

  // We loop more than maxRetries to allow for key switching
  // Total attempts = standard retries + number of keys to try
  const totalAllowedAttempts = maxRetries + settings.apiKeys.length;

  while (attempt < totalAllowedAttempts) {
    let currentApiKey = '';
    
    try {
      currentApiKey = keyManager.getActiveKey();
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

      // Include outputStandard in system instruction generation
      const systemInstruction = getSystemInstruction(settings.tone, settings.topic, settings.customPrompt, settings.outputStandard);

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
      
      const isRateLimit = errorMessage.includes("429") || 
                          errorMessage.includes("quota") || 
                          errorMessage.includes("Too Many Requests") ||
                          errorMessage.includes("RESOURCE_EXHAUSTED");
      
      if (isRateLimit) {
        console.warn(`Rate Limit hit for key ending ...${currentApiKey.slice(-4)}. Switching...`);
        
        // 1. Mark strictly in local manager
        keyManager.markCurrentAsRateLimited();
        
        // 2. Notify the UI to update global state and show warning toast
        if (onKeyRateLimit && currentApiKey) {
            onKeyRateLimit(currentApiKey);
        }

        // Do NOT increment 'attempt' counter for key switches, 
        // essentially resetting the retry count for the new key.
        // However, we need to ensure we don't loop forever if all keys fail.
        if (!keyManager.hasAvailableKeys()) {
             // If we ran out of keys completely, throw the final error
             throw new Error(getFriendlyErrorMessage(new Error("429 RESOURCE_EXHAUSTED"), modelName));
        }
        
        // Short delay before switching to next key
        await delay(500); 

      } else {
        // Non-RateLimit Error (Network, Server 500, Parse Error)
        console.warn(`Translation Attempt ${attempt + 1} failed:`, error);
        attempt++;
        
        // Exponential Backoff
        const waitTime = baseDelay * Math.pow(1.5, attempt);
        await delay(waitTime);
      }
    }
  }

  throw new Error("Failed to process batch after multiple retries and key rotation.");
};