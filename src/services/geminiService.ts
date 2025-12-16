
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { BatchRequest, BatchResponse, AppSettings, UserAPIKey, TargetLanguage } from "../types";
import { APP_CONFIG, getSystemInstruction, LANGUAGE_PROMPTS } from "../constants";

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

// Subtitles often contain violence, swearing, or sensitive topics.
// We must disable safety filters to prevent the API from blocking valid translations.
const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Robustly extracts error text from various error object structures including nested JSON
 */
const extractErrorDetails = (error: any): string => {
    let msg = "";
    if (!error) return "";
    
    if (typeof error === 'string') return error.toLowerCase();
    
    // Standard Error props
    if (error.message) msg += " " + error.message;
    if (error.statusText) msg += " " + error.statusText;
    if (error.status) msg += " " + error.status;

    // Check for nested Google API error structure (e.g. error.error.message)
    if (error.error && typeof error.error === 'object') {
        if (error.error.message) msg += " " + error.error.message;
        if (error.error.code) msg += " " + error.error.code;
        if (error.error.status) msg += " " + error.error.status;
    }

    // Sometimes the SDK wraps the error in a JSON string inside the message
    // Try to stringify the whole object to catch hidden keys
    try {
        const jsonStr = JSON.stringify(error);
        msg += " " + jsonStr;
    } catch (e) {
        // ignore circular structure errors
    }
    
    return msg.toLowerCase();
};

/**
 * Transforms raw API errors into user-friendly Persian messages with actionable advice.
 */
const getFriendlyErrorMessage = (error: any, modelName: string): string => {
  const msg = extractErrorDetails(error);

  // --- GEO-BLOCKING / SANCTIONS ---
  if (
    msg.includes('location is not supported') || 
    msg.includes('region is not supported') || 
    msg.includes('403 forbidden') ||
    msg.includes('preconditions check failed')
  ) {
    return '⛔ خطای تحریم (IP): گوگل اجازه دسترسی با این IP را نمی‌دهد. لطفاً فیلترشکن (VPN) خود را روشن کرده یا سرور آن را تغییر دهید (پیشنهاد: آمریکا یا اروپا).';
  }

  // --- NETWORK ISSUES ---
  if (msg.includes('fetch failed') || msg.includes('networkerror') || msg.includes('failed to fetch')) {
    return '⚠️ خطای شبکه: اینترنت شما قطع است یا اتصال به سرور گوگل مسدود شده است. اتصال خود را بررسی کنید.';
  }

  // --- AUTHENTICATION ---
  if (msg.includes('400') || msg.includes('invalid_argument')) {
    return 'خطای درخواست (400): اطلاعات ارسالی نامعتبر است.';
  }
  if (msg.includes('401') || msg.includes('unauthenticated') || msg.includes('api key not valid')) {
    return 'خطای احراز هویت (401): کلید API نامعتبر است.';
  }

  // --- QUOTA ---
  if (msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('too many requests')) {
    return 'پایان اعتبار (429): سقف استفاده از کلید API پر شده است.';
  }

  // --- SERVER ERRORS ---
  if (msg.includes('500') || msg.includes('503') || msg.includes('internal') || msg.includes('unavailable') || msg.includes('overloaded')) {
    return 'خطای سرور گوگل (503): مدل هوش مصنوعی موقتاً شلوغ است (Overloaded). سیستم به طور خودکار صبر کرده و تلاش مجدد خواهد کرد.';
  }
  if (msg.includes('safety') || msg.includes('blocked')) {
    return 'خطای محتوا (Safety): ترجمه توسط فیلترهای ایمنی گوگل مسدود شد. (تنظیمات ایمنی در نسخه جدید غیرفعال شده‌اند، اگر این خطا را می‌بینید محتوا بسیار حساس است).';
  }

  return `خطای سیستمی: ${msg.substring(0, 150)}...`;
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
     const errorMessage = extractErrorDetails(e);
     const isRateLimit = errorMessage.includes("429") || errorMessage.includes("resource_exhausted");

     if (strictMode && isRateLimit) return false;
     if (!strictMode && isRateLimit) return true; // Accept rate limited keys during setup

     return false;
  }
};

/**
 * Diagnoses the connection health and IP status before starting a batch.
 * Returns null if healthy, or a user-friendly error string if failed.
 */
export const diagnoseConnection = async (apiKey: string): Promise<string | null> => {
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        // Use a very cheap/fast model for ping
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ping',
        });
        return null; // Connection is Healthy
    } catch (e: any) {
        return getFriendlyErrorMessage(e, 'gemini-2.5-flash');
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
  let overloadRetries = 0; // Separate counter for 503 Overloaded
  
  const { maxRetries, baseDelay, overloadWaitMs } = APP_CONFIG.retryConfig;
  const MAX_OVERLOAD_RETRIES = 10; // Allow up to 10 long waits (10 * 30s = 5 minutes)

  let modelName = APP_CONFIG.geminiModels.standard;
  if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
  else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;
  else if (settings.model === 'flash_lite') modelName = APP_CONFIG.geminiModels.flash_lite;

  const keyManager = new APIKeyManager(settings.apiKeys);
  const totalAllowedAttempts = maxRetries + settings.apiKeys.length * 2;
  
  // Track the last error to show helpful message if all retries fail
  let lastError: Error | null = null;

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
          safetySettings: SAFETY_SETTINGS, // DISABLE FILTERS
        },
      });

      if (!response.text) {
          // Check if response was blocked due to safety despite settings
          if (response.candidates && response.candidates[0] && response.candidates[0].finishReason) {
              throw new Error(`Model finished with reason: ${response.candidates[0].finishReason} (Likely Safety Block)`);
          }
          throw new Error("Empty response from Gemini");
      }

      let parsedData: BatchResponse[];
      try {
        parsedData = JSON.parse(response.text) as BatchResponse[];
      } catch (e) {
        console.error("JSON Parse Error. Raw text:", response.text);
        throw new Error("Failed to parse Gemini JSON response (Invalid JSON)");
      }

      // Basic validation
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
         // Fallback if model returns empty array but valid JSON
         throw new Error("Model returned empty data array");
      }

      return parsedData;

    } catch (error: any) {
      lastError = error;
      const errorMessage = extractErrorDetails(error);
      
      // Critical Network/Geo Errors should NOT retry immediately, throw them to handle in UI
      if (errorMessage.includes('fetch failed') || errorMessage.includes('location is not supported')) {
          throw new Error(getFriendlyErrorMessage(error, modelName));
      }

      // --- 503 OVERLOADED HANDLING (Smart Cool-down) ---
      const isOverloaded = errorMessage.includes('overloaded') || 
                           errorMessage.includes('503') || 
                           errorMessage.includes('unavailable') || 
                           errorMessage.includes('internal error') ||
                           errorMessage.includes('bad gateway') ||
                           errorMessage.includes('service unavailable');

      if (isOverloaded) {
          if (overloadRetries < MAX_OVERLOAD_RETRIES) {
              console.warn(`Model Overloaded (503). Entering cool-down for ${overloadWaitMs/1000}s... (Attempt ${overloadRetries + 1}/${MAX_OVERLOAD_RETRIES})`);
              overloadRetries++;
              
              // Wait for the long cool-down period
              await delay(overloadWaitMs);
              
              // IMPORTANT: We do NOT increment the main 'attempt' counter.
              // This effectively pauses the retry consumption while waiting for the server to recover.
              continue; 
          } else {
               // If we exhausted overload retries, treat it as a hard failure or let standard retry logic handle it
               console.error("Exhausted all Overload cool-down retries.");
          }
      }
      // ------------------------------------------------

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
  
  // Include specific details from the last error in the final exception
  const specificReason = lastError ? extractErrorDetails(lastError) : "Unknown Error";
  throw new Error(`Failed to process batch after multiple retries. Reason: ${specificReason}`);
};

export const translateFreeText = async (text: string, settings: AppSettings, targetLang: TargetLanguage = 'fa'): Promise<string> => {
    if (!text || !text.trim()) return '';

    let modelName = APP_CONFIG.geminiModels.standard;
    if (settings.model === 'professional') modelName = APP_CONFIG.geminiModels.professional;
    else if (settings.model === 'flash') modelName = APP_CONFIG.geminiModels.flash;

    const keyManager = new APIKeyManager(settings.apiKeys);
    let attempt = 0;
    const maxRetries = 2 + settings.apiKeys.length;

    // Fetch the specific prompt for the target language
    const langPrompt = LANGUAGE_PROMPTS[targetLang] || LANGUAGE_PROMPTS.fa;
    const toneInfo = `\nTone: ${settings.tone} (Apply this tone appropriately to the target language).`;
    const fullSystemInstruction = `${langPrompt}\n${toneInfo}\nPreserve original formatting and line breaks.`;

    while (attempt < maxRetries) {
        try {
            const currentApiKey = keyManager.getActiveKey();
            const ai = new GoogleGenAI({ apiKey: currentApiKey });
            const response = await ai.models.generateContent({
                model: modelName,
                contents: text,
                config: {
                    systemInstruction: fullSystemInstruction,
                    temperature: settings.temperature || 0.7,
                    safetySettings: SAFETY_SETTINGS, // DISABLE FILTERS
                },
            });
            return response.text || '';
        } catch (error: any) {
            const msg = extractErrorDetails(error);
            
            // Fast fail for connection issues
            if (msg.includes('fetch failed') || msg.includes('location')) {
                 throw new Error(getFriendlyErrorMessage(error, modelName));
            }

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
