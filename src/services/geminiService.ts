
import { GoogleGenAI, Type, Schema, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { BatchRequest, BatchResponse, AppSettings, UserAPIKey, TargetLanguage } from "../types";
import { APP_CONFIG, getSystemInstruction, LANGUAGE_PROMPTS } from "../constants";

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

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const extractErrorDetails = (error: any): string => {
    let msg = "";
    if (!error) return "";
    if (typeof error === 'string') return error.toLowerCase();
    if (error.message) msg += " " + error.message;
    if (error.statusText) msg += " " + error.statusText;
    if (error.status) msg += " " + error.status;
    if (error.error && typeof error.error === 'object') {
        if (error.error.message) msg += " " + error.error.message;
    }
    return msg.toLowerCase();
};

const getFriendlyErrorMessage = (error: any, modelName: string): string => {
  const msg = extractErrorDetails(error);
  if (msg.includes('location') || msg.includes('region') || msg.includes('403')) {
    return '⛔ خطای تحریم (IP): گوگل اجازه دسترسی نمی‌دهد. لطفاً VPN خود را روشن یا سرور آن را تغییر دهید.';
  }
  if (msg.includes('fetch failed') || msg.includes('network')) {
    return '⚠️ خطای شبکه: اتصال به سرور گوگل مسدود شده است.';
  }
  if (msg.includes('429') || msg.includes('quota')) {
    return 'پایان اعتبار (429): سقف استفاده از کلید API پر شده است.';
  }
  if (msg.includes('503') || msg.includes('overloaded')) {
    return 'خطای سرور گوگل (503): مدل موقتاً شلوغ است. در حال تلاش مجدد...';
  }
  return `خطای سیستمی: ${msg.substring(0, 100)}...`;
};

export const validateAPIConnection = async (apiKey: string, strictMode: boolean = false): Promise<boolean> => {
  if (!apiKey) return false;
  try {
     const ai = new GoogleGenAI({ apiKey: apiKey });
     await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hi' });
     return true;
  } catch (e: any) {
     const errorMessage = extractErrorDetails(e);
     return errorMessage.includes("429");
  }
};

export const diagnoseConnection = async (apiKey: string): Promise<string | null> => {
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'ping' });
        return null; 
    } catch (e: any) {
        return getFriendlyErrorMessage(e, 'gemini-2.5-flash');
    }
};

class APIKeyManager {
  private keys: { key: string; isRateLimited: boolean }[] = [];
  private currentIndex = 0;
  constructor(userKeys: UserAPIKey[]) {
    userKeys.forEach(k => { if (k.isValid) this.keys.push({ key: k.key, isRateLimited: k.isRateLimited }); });
  }
  public getActiveKey(): string {
    const availableKeyIndex = this.keys.findIndex(k => !k.isRateLimited);
    if (availableKeyIndex === -1) throw new Error("429: All API Keys are Rate Limited.");
    this.currentIndex = availableKeyIndex;
    return this.keys[this.currentIndex].key;
  }
  public markCurrentAsRateLimited() { if (this.keys[this.currentIndex]) this.keys[this.currentIndex].isRateLimited = true; }
  public hasAvailableKeys(): boolean { return this.keys.some(k => !k.isRateLimited); }
}

export const translateBatch = async (
  targetBatch: BatchRequest[],
  contextPre: BatchRequest[],
  contextPost: BatchRequest[],
  settings: AppSettings,
  onKeyRateLimit?: (key: string) => void
): Promise<BatchResponse[]> => {
  let attempt = 0;
  let overloadRetries = 0; 
  const { maxRetries, baseDelay, overloadWaitMs } = APP_CONFIG.retryConfig;

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

      // --- CONTEXTUAL BATCHING PROMPT ---
      let userPrompt = `--- CONTEXTUAL BATCHING PROTOCOL ---\n`;
      userPrompt += `Analyze the following sequence as a SINGLE CONTINUOUS SCENARIO before translating.\n`;
      
      if (contextPre.length > 0) userPrompt += `\nPAST CONTEXT (Reference only):\n${JSON.stringify(contextPre)}`;
      userPrompt += `\n\nTARGET BATCH (Translate these): \n${JSON.stringify(targetBatch)}`;
      if (contextPost.length > 0) userPrompt += `\n\nFUTURE CONTEXT (Study for flow):\n${JSON.stringify(contextPost)}`;
      
      userPrompt += `\n\nTask: Translate TARGET BATCH into Persian. 
Ensure the flow matches the scenario. Use "Tehrani Spoken" rules if conversational.
Return JSON array matching the schema.`;

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
          temperature: settings.temperature,
          safetySettings: SAFETY_SETTINGS,
        },
      });

      if (!response.text) throw new Error("Empty response from Gemini");

      return JSON.parse(response.text) as BatchResponse[];

    } catch (error: any) {
      const errorMessage = extractErrorDetails(error);
      if (errorMessage.includes('fetch failed') || errorMessage.includes('location')) throw new Error(getFriendlyErrorMessage(error, modelName));
      
      const isOverloaded = errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('unavailable');
      if (isOverloaded) {
          overloadRetries++;
          await delay(overloadWaitMs);
          continue; 
      }

      if (errorMessage.includes("429")) {
        keyManager.markCurrentAsRateLimited();
        if (onKeyRateLimit && currentApiKey) onKeyRateLimit(currentApiKey);
        if (!keyManager.hasAvailableKeys()) throw new Error("429 Quota Exhausted");
        await delay(1000); 
      } else {
        attempt++;
        await delay(baseDelay * Math.pow(1.5, attempt));
      }
    }
  }
  throw new Error("Batch processing failed after retries.");
};

export const translateFreeText = async (text: string, settings: AppSettings, targetLang: TargetLanguage = 'fa'): Promise<string> => {
    if (!text || !text.trim()) return '';
    const ai = new GoogleGenAI({ apiKey: new APIKeyManager(settings.apiKeys).getActiveKey() });
    const response = await ai.models.generateContent({
        model: APP_CONFIG.geminiModels.standard,
        contents: text,
        config: {
            systemInstruction: `${LANGUAGE_PROMPTS[targetLang]}\nTone: ${settings.tone}. Native flow, no translationese.`,
            temperature: settings.temperature,
            safetySettings: SAFETY_SETTINGS,
        },
    });
    return response.text || '';
};
