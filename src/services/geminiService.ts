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
    return `خطای مدل (404): مدل انتخاب شده "${modelName}" یافت نشد. این مدل ممکن است منقضی شده باشد یا برای کلید شما فعال نباشد. لطفاً در تنظیمات، مدل را تغییر دهید.`;
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
 * Validates a specific API Key by making a lightweight call.
 * @param apiKey The key to test
 * @param strictMode If true, returns FALSE for Rate Limit errors (used during rotation). If false, allows Rate Limit (used during setup).
 */
export const validateAPIConnection = async (apiKey: string, strictMode: boolean = false): Promise<boolean> => {
  if (!apiKey) return false;

  try {
     const ai = new GoogleGenAI({ apiKey: apiKey });
     // Lightweight check to verify API key validity
     await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Hi', // Very short prompt
     });
     return true;
  } catch (e: any) {
     const errorMessage = e.message || JSON.stringify(e);
     
     const isRateLimit = errorMessage.includes("429") || 
                         errorMessage.includes("quota") || 
                         errorMessage.includes("RESOURCE_EXHAUSTED") ||
                         errorMessage.includes("Too Many Requests");

     // In Strict Mode (Runtime Rotation), a Rate Limited key is considered "Invalid" for immediate use.
     if (strictMode && isRateLimit) {
         console.warn(`Strict Validation: Key ...${apiKey.slice(-4)} is Rate Limited.`);
         return false;
     }

     // In Setup Mode (Settings), we allow adding a key even if it's currently 429, 
     // assuming it will recover later.
     if (!strictMode && isRateLimit) {
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
      // Trust the input 'isValid' but strictly respect 'isRateLimited' state
      if (k.isValid) {
        this.keys.push({ key: k.key, isRateLimited: k.isRateLimited, source: 'USER' });
      }
    });
  }

  /**
   * Returns the next available key without advancing the index automatically.
   */
  public getNextAvailableKey(): string | null {
      // Start searching from current index
      for (let i = 0; i < this.keys.length; i++) {
          // Wrap around logic if needed, but for simplicity let's just find *any* non-limited key
          // We prioritize maintaining order.
          if (!this.keys[i].isRateLimited) {
              return this.keys[i].key;
          }
      }
      return null;
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
    if (this.keys.length > 0 && this.keys[this.currentIndex]) {
      this.keys[this.currentIndex].isRateLimited = true;
    }
  }

  public markKeyAsRateLimited(keyStr: string) {
      const target = this.keys.find(k => k.key === keyStr);
      if (target) {
          target.isRateLimited = true;
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
  
  let modelName = APP_CONFIG.geminiModels.standard;
  if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
  else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;
  else if (settings.model === 'flash_lite') modelName = APP_CONFIG.geminiModels.flash_lite;

  // Initialize Key Manager for this batch process session
  const keyManager = new APIKeyManager(settings.apiKeys);

  // We loop more than maxRetries to allow for key switching
  // Total attempts = standard retries + number of keys to try
  const totalAllowedAttempts = maxRetries + settings.apiKeys.length * 2; // Increased multiplier for safety

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

      const systemInstruction = getSystemInstruction(
        settings.tone, 
        settings.topic, 
        settings.customPrompt, 
        settings.outputStandard,
        settings.glossary
      );

      const temperature = settings.temperature !== undefined ? settings.temperature : 0.7;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: temperature,
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

      if (parsedData.length !== targetBatch.length) {
        throw new Error(`Anti-Lazy Count mismatch: ${parsedData.length}/${targetBatch.length}`);
      }

      return parsedData;

    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      
      const isRateLimit = errorMessage.includes("429") || 
                          errorMessage.includes("quota") || 
                          errorMessage.includes("Too Many Requests") || 
                          errorMessage.includes("RESOURCE_EXHAUSTED");
      
      if (isRateLimit) {
        console.warn(`Rate Limit hit for key ending ...${currentApiKey.slice(-4)}.`);
        
        // 1. Mark the CURRENT failed key as limited immediately
        keyManager.markCurrentAsRateLimited();
        if (onKeyRateLimit && currentApiKey) onKeyRateLimit(currentApiKey);

        // 2. INDEPENDENT VALIDATION LOGIC
        // We must check if the NEXT available key is actually alive.
        // Google often limits projects, so if keys share a project, the next one is likely dead too.
        // We iterate until we find a TRULY alive key or run out.
        
        let foundWorkingKey = false;
        
        while (keyManager.hasAvailableKeys() && !foundWorkingKey) {
            const nextCandidate = keyManager.getNextAvailableKey();
            if (!nextCandidate) break; // Should be covered by hasAvailableKeys but safe check

            console.log(`Checking next candidate key ending ...${nextCandidate.slice(-4)} independently...`);
            
            // "Pre-flight" check using Strict Mode
            const isAlive = await validateAPIConnection(nextCandidate, true);
            
            if (isAlive) {
                console.log(`Key ...${nextCandidate.slice(-4)} is ALIVE. Proceeding.`);
                foundWorkingKey = true;
                // The main loop will pick this key up via keyManager.getActiveKey() in next iteration
            } else {
                console.warn(`Key ...${nextCandidate.slice(-4)} failed independent check (Quota Shared?). Marking as limited.`);
                keyManager.markKeyAsRateLimited(nextCandidate);
                if (onKeyRateLimit) onKeyRateLimit(nextCandidate);
                // Loop continues to check the next one...
            }
        }

        if (!keyManager.hasAvailableKeys()) {
             // If we ran out of keys completely after checking them all independently
             throw new Error(getFriendlyErrorMessage(new Error("429 RESOURCE_EXHAUSTED"), modelName));
        }
        
        // Short delay before retrying with the found working key
        await delay(1000); 

      } else {
        // Non-RateLimit Error
        console.warn(`Translation Attempt ${attempt + 1} failed:`, error);
        attempt++;
        const waitTime = baseDelay * Math.pow(1.5, attempt);
        await delay(waitTime);
      }
    }
  }

  throw new Error("Failed to process batch after multiple retries and key rotation.");
};

/**
 * Translates a single block of free text preserving formatting
 */
export const translateFreeText = async (
    text: string, 
    settings: AppSettings
): Promise<string> => {
    if (!text || !text.trim()) return '';

    let modelName = APP_CONFIG.geminiModels.standard;
    // For free text, we can respect the model choice, but Flash is usually sufficient and faster for large text.
    if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
    else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;
    else if (settings.model === 'flash_lite') modelName = APP_CONFIG.geminiModels.flash_lite;

    const keyManager = new APIKeyManager(settings.apiKeys);
    let attempt = 0;
    const maxRetries = 2 + settings.apiKeys.length;

    while (attempt < maxRetries) {
        let currentApiKey = '';
        try {
            currentApiKey = keyManager.getActiveKey();
            const ai = new GoogleGenAI({ apiKey: currentApiKey });

            const systemInstruction = `You are a professional Persian translator. 
            Your task is to translate the input text into Persian (Farsi).
            
            CRITICAL RULES:
            1. Preserve ALL formatting exactly (paragraphs, line breaks, bullet points, headers).
            2. Do not output JSON. Output raw text.
            3. Inherit the following style guide:
               - Tone: ${settings.tone}
               - Topic: ${settings.topic}
               - Use proper Persian punctuation.
            
            Detect the input language automatically. If it's already Persian, improve the style/grammar based on the settings.`;

            const response = await ai.models.generateContent({
                model: modelName,
                contents: text,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: settings.temperature || 0.7,
                },
            });

            if (!response.text) {
                throw new Error("Empty response from Gemini");
            }

            return response.text;

        } catch (error: any) {
            const errorMessage = error.message || error.toString();
            const isRateLimit = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED");

            if (isRateLimit) {
                console.warn("Rate limit hit in Free Text translation. Rotating key...");
                keyManager.markCurrentAsRateLimited();
                
                if (!keyManager.hasAvailableKeys()) {
                     throw new Error("All API keys are exhausted.");
                }
                await delay(500);
            } else {
                attempt++;
                if (attempt >= maxRetries) throw error;
                await delay(1000 * attempt);
            }
        }
    }

    throw new Error("Failed to translate text.");
};