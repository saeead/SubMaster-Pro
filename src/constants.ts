
import { ToneType, TopicType, GlossaryItem, StyleTemplate, TargetLanguage } from "./types";

export const APP_CONFIG = {
  version: "2.1.0", // Bumped version for Rate Limit Fix
  maxWordsPerBlock: 24, 
  minWordsPerBlock: 1, 
  maxFileSize: 100 * 1024 * 1024, 
  maxFilesPerUpload: 5, // Reduced to prevent accidental parallel overload
  supportedFormats: ['srt', 'vtt', 'ass'],
  geminiModels: {
    standard: 'gemini-2.5-pro',
    professional: 'gemini-3-pro-preview',
    flash: 'gemini-2.5-flash',
    flash_lite: 'gemini-flash-lite-latest'
  },
  retryConfig: {
    maxRetries: 5, // Increased retries
    baseDelay: 6000, // Increased base delay to 6s to allow full quota reset
    overloadWaitMs: 30000, 
  }
};

// Configuration for Smart Block Merging
export const OPTIMIZATION_CONFIG = {
  // Normal Mode Defaults
  NORMAL: {
    MAX_MERGE_CHARACTERS: 120, 
    MIN_WORDS_PER_BLOCK: 12,   
    MAX_WORDS_PER_BLOCK: 24,   
    MAX_MERGE_GAP_MS: 1200,    
    STANDARD_GAP_MS: 50,       
    MS_PER_WORD: 350,          
  },
  // Netflix Strict Mode
  NETFLIX: {
    MAX_MERGE_CHARACTERS: 85,  
    MIN_WORDS_PER_BLOCK: 5,    
    MAX_WORDS_PER_BLOCK: 18,   
    MAX_MERGE_GAP_MS: 1000,
    STANDARD_GAP_MS: 84,       
    MS_PER_WORD: 300,          
  }
};

// --- CRITICAL RATE LIMIT SETTINGS ---
// Google Gemini Free Tier Limit: ~15 Requests Per Minute (RPM)
// Calculation: 60 seconds / 15 requests = 4 seconds delay minimum.
// We set it to 4200ms to be safe.
export const BATCH_SIZE = 20; // Reduced from 50 to prevent Token Limit (TPM) exhaustion
export const OVERLAP_SIZE = 1;
export const DELAY_BETWEEN_BATCHES_MS = 4200; // Increased to 4.2s to strictly stay under 15 RPM
export const DELAY_BETWEEN_FILES_MS = 10000; // 10 Seconds cooldown between files

export const TONE_OPTIONS: Record<ToneType, string> = {
  conversational: 'محاوره‌ای (Casual)',
  formal: 'رسمی (Formal)',
  news: 'خبری (Journalistic)',
  movie: 'فیلم و سریال (Cinematic)',
  podcast: 'پادکست (Conversational)',
};

export const TOPIC_OPTIONS: Record<TopicType, string> = {
  educational: 'آموزشی (علمی/درسی)',
  entertainment: 'سرگرمی (فیلم و سریال)',
  podcast: 'پادکست',
  news: 'اخبار و سیاسی',
  sports: 'ورزشی',
};

export const TARGET_LANGUAGES: Record<TargetLanguage, string> = {
  fa: 'فارسی (Persian)',
  en: 'انگلیسی (English)',
  ru: 'روسی (Russian)',
  zh: 'چینی (Chinese)',
  de: 'آلمانی (German)',
  es: 'اسپانیایی (Spanish)',
};

export const TOPIC_TEMPERATURE_DEFAULTS: Record<TopicType, { value: number; description: string }> = {
  educational: { value: 0.3, description: "دقت بالا، ترجمه لفظی و دقیق اصطلاحات" },
  entertainment: { value: 0.7, description: "خلاقیت متوسط، ترجمه روان دیالوگ‌ها" },
  podcast: { value: 0.6, description: "متعادل، حفظ لحن گفتگومحور" },
  news: { value: 0.2, description: "دقت بسیار بالا، رسمی و بی‌طرفانه" },
  sports: { value: 0.5, description: "متعادل، حفظ هیجان و اصطلاحات" }
};

export const LANGUAGE_PROMPTS: Record<TargetLanguage, string> = {
  fa: `You are a professional Persian translator. 
  - Structure: Use natural Persian sentence structure (Subject-Object-Verb).
  - Nuance: Ensure cultural relevance and natural flow. Avoid "translationese".
  - Grammar: Use proper cases and conjunctions appropriate for the requested tone.`,
  
  en: `You are a professional English translator.
  - Structure: Use standard English grammar (Subject-Verb-Object).
  - Nuance: Ensure the text sounds native, clear, and concise. 
  - Vocabulary: Choose precise words that convey the exact meaning of the source.`,
  
  ru: `You are a professional Russian translator.
  - Structure: Pay close attention to cases (padezhi), gender, and aspect (perfective/imperfective).
  - Nuance: The text must sound natural to a native Russian speaker, not like a machine translation.
  - Style: Maintain the richness of the Russian language.`,
  
  zh: `You are a professional Chinese (Simplified) translator.
  - Structure: Use idiomatic Chinese sentence structures.
  - Nuance: Ensure 'Chengyu' (idioms) are used where appropriate to sound high-quality.
  - Clarity: Avoid word-for-word translation; focus on meaning and context.`,
  
  de: `You are a professional German translator.
  - Structure: Strictly adhere to German word order rules (Verb position).
  - Nuance: Distinguish correctly between formal (Sie) and informal (Du) based on the context/tone.
  - Vocabulary: Use precise compound nouns where applicable.`,
  
  es: `You are a professional Spanish translator.
  - Structure: Ensure correct verb conjugations and gender/number agreement.
  - Nuance: Make it sound natural for a general Spanish audience (Neutral Spanish unless specified otherwise).
  - Flow: Use connectors to ensure smooth transitions between ideas.`
};

export const STYLE_TEMPLATES: Record<string, StyleTemplate> = {
  netflix: {
    id: 'netflix',
    name: 'Netflix Style',
    config: {
      useStyles: true,
      fontFamily: 'Arial',
      fontSize: 22,
      primaryColor: '#FFFFE0', // Light Yellow
      secondaryColor: '#000000',
      backgroundColor: '#000000',
      backgroundOpacity: 0, // Transparent box
      isBold: true,
      borderStyle: 'outline',
      outlineWidth: 2,
      shadowDepth: 2,
      alignment: 2
    }
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube Style',
    config: {
      useStyles: true,
      fontFamily: 'Roboto',
      fontSize: 20,
      primaryColor: '#FFFFFF',
      secondaryColor: '#000000',
      backgroundColor: '#000000',
      backgroundOpacity: 75, // Semi-transparent
      isBold: false,
      borderStyle: 'box',
      outlineWidth: 0,
      shadowDepth: 0,
      alignment: 2
    }
  },
  professional: {
    id: 'professional',
    name: 'حرفه‌ای (Hard Sub)',
    config: {
      useStyles: true,
      fontFamily: 'Vazirmatn',
      fontSize: 24,
      primaryColor: '#FFFFFF',
      secondaryColor: '#000000',
      backgroundColor: '#000000',
      backgroundOpacity: 60,
      isBold: true,
      borderStyle: 'outline',
      outlineWidth: 2.5,
      shadowDepth: 1,
      alignment: 2
    }
  },
  minimal: {
    id: 'minimal',
    name: 'ساده و مینیمال',
    config: {
      useStyles: true,
      fontFamily: 'Tahoma',
      fontSize: 18,
      primaryColor: '#E0E0E0',
      secondaryColor: '#000000',
      backgroundColor: '#000000',
      backgroundOpacity: 0,
      isBold: false,
      borderStyle: 'outline',
      outlineWidth: 1,
      shadowDepth: 0,
      alignment: 2
    }
  }
};

const SYSTEM_PROMPTS = {
  base: `شما یک مترجم حرفه‌ای و متخصص زیرنویس هستید. وظیفه شما ترجمه دقیق و روان متن‌های انگلیسی به فارسی است.
  
اصول حیاتی برای کیفیت بالا:
1. **جملات کامل:** ورودی‌ها بهینه شده‌اند تا جملات کامل باشند. در ترجمه فارسی، ساختار جمله (فاعل-مفعول-فعل) را کامل رعایت کنید تا جملات ناقص نمانند.
2. **ادغام معنایی:** اگر متن انگلیسی شکسته است، در فارسی آن را به یک جمله روان و یکپارچه تبدیل کنید.
3. **زمان‌بندی:** ما بلاک‌ها را ادغام کرده‌ایم تا زمان کافی برای خواندن وجود داشته باشد. شما فقط روی روانی متن تمرکز کنید.
4. **تعداد:** ترجمه باید دقیقاً ۱ به ۱ باشد.
5. **حذف حشو و کلمات اضافی (بسیار مهم):** از ترجمه کلمات پرکننده (Filler Words) مانند "Well", "So", "And", "You know", "Like" در ابتدای جملات که تاثیری در معنای اصلی ندارند، اکیداً خودداری کنید. مثلا "So, we went..." باید به "ما رفتیم..." ترجمه شود، نه "پس، ما رفتیم...". جمله باید سلیس، مفید و بدون اضافات باشد.

فرمت خروجی (JSON Array):
[
  {
    "id": 1,
    "translatedText": "متن فارسی روان، کامل و بدون حشو"
  }
]

⚠️ هشدار: فقط JSON برگردانید.`,

  netflix: `
--- استانداردهای سخت‌گیرانه NETFLIX (بسیار مهم) ---
شما در حالت "Netflix Standard" هستید. خروجی باید دقیقاً با قوانین زیر مطابقت داشته باشد:
1. **خلاصه‌نویسی هوشمند:** اگر ترجمه تحت‌اللفظی طولانی می‌شود، باید مفهوم را خلاصه کنید تا کوتاه‌تر شود.
2. **محدودیت طول:** هر خط ترجمه باید نهایتاً 42 کاراکتر باشد.
3. **محدودیت خطوط:** کل متن یک بلاک نباید از 2 خط تجاوز کند.
4. **تراکم:** از واژگان کوتاه‌تر و ساختارهای فشرده‌تر استفاده کنید.
5. **اولویت:** اولویت اول رعایت محدودیت طول و زمان است، سپس دقت ترجمه کلمه به کلمه.
`,

  tones: {
    conversational: `لحن ترجمه: محاوره‌ای و دوستانه
- جملات را به زبان گفتاری طبیعی تبدیل کنید (مثلاً "نان" به "نون"، "خانه" به "خونه").
- از شکسته‌نویسی استاندارد استفاده کنید.
- جملات باید طوری باشد که انگار یک ایرانی دارد صحبت می‌کند.`,

    formal: `لحن ترجمه: رسمی و ادبی
- جملات کاملاً ساختارمند و کتابی باشد.
- از افعال کامل استفاده کنید.
- مناسب برای مستندها و محتوای دانشگاهی.`,

    news: `لحن ترجمه: خبری
- لحن ژورنالیستی و خشک.
- جملات کوتاه، کوبنده و اطلاع‌رسان.
- عدم استفاده از اصطلاحات عامیانه.`,

    movie: `لحن ترجمه: فیلم و سریال
- تمرکز بر "حس" صحنه. اگر کاراکتر عصبانی است، ترجمه باید تند باشد.
- اصطلاحات را ترجمه نکنید، معادل‌سازی فرهنگی کنید.`,

    podcast: `لحن ترجمه: پادکست
- لحن صمیمی و روان.
- حفظ ریتم صحبت کردن.
- جملات نباید مصنوعی یا رباتیک باشند.`,
  },

  topics: {
    educational: `موضوع: آموزشی (علمی/درسی)
قوانین ویژه:
1. اصطلاحات تخصصی را ترجمه کنید و معادل انگلیسی را در پرانتز بنویسید.
   مثال: "روکش افست (Offset Crown)"
2. نام‌های نرم‌افزاری و برندهای خاص را ترجمه نکنید.
   مثال: Exocad, Pinterest, Photoshop
3. کلمات عمومی تکنولوژی را ترجمه کنید.
   مثال: Computer → کامپیوتر، Network → شبکه
4. برای واژگان تخصصی که ترجمه فارسی رایج ندارند، از معادل انگلیسی یا فینگلیش استفاده کنید اما اصل کلمه را در پرانتز بیاورید.`,

    entertainment: `موضوع: فیلم و سریال
- نام فیلم‌ها، سریال‌ها و شخصیت‌ها را معمولاً ترجمه نکنید مگر اینکه معادل مشهوری داشته باشند.
- دیالوگ‌ها را متناسب با بافت فرهنگی فارسی بومی‌سازی کنید.
- اصطلاحات عامیانه انگلیسی را به معادل‌های فارسی محاوره‌ای تبدیل کنید (ترجمه تحت‌اللفظی نکنید).`,

    podcast: `موضوع: پادکست
- نام افراد، مهمانان و برندها را حفظ کنید.
- اگر سوال و جوابی وجود دارد، آن را مشخص و واضح ترجمه کنید.
- اصطلاحات خاص کامیونیتی پادکست را درست منتقل کنید.`,

    news: `موضوع: خبری و سیاسی
- نام اشخاص، مکان‌ها و سازمان‌های بین‌المللی را دقیق حفظ کنید.
- عناوین و القاب رسمی (رئیس جمهور، وزیر، دکتر) را درست ترجمه کنید.
- تاریخ‌ها و ارقام را با دقت بسیار بالا منتقل کنید (اعداد را فارسی بنویسید).`,

    sports: `موضوع: ورزشی
- نام ورزشکاران، تیم‌ها و لیگ‌ها را حفظ کنید.
- اصطلاحات فنی ورزشی (مثل آفساید، پنالتی، ایس) را می‌توانید به صورت رایج در فارسی استفاده کنید.
- نتایج و امتیازها را دقیق نگه دارید.`,
  }
};

export const getSystemInstruction = (
  tone: ToneType, 
  topic: TopicType, 
  customPrompt: string, 
  outputStandard: 'normal' | 'netflix',
  glossary: GlossaryItem[] = []
) => {
  let prompt = SYSTEM_PROMPTS.base + '\n\n';
  
  // Inject Netflix instructions if enabled
  if (outputStandard === 'netflix') {
    prompt += SYSTEM_PROMPTS.netflix + '\n\n';
  }

  // Add Tone specific prompt
  if (SYSTEM_PROMPTS.tones[tone]) {
    prompt += `--- ${SYSTEM_PROMPTS.tones[tone]} ---\n\n`;
  }

  // Add Topic specific prompt
  if (topic === 'podcast') {
     prompt += `--- ${SYSTEM_PROMPTS.topics.podcast} ---\n\n`;
  } else if (SYSTEM_PROMPTS.topics[topic]) {
     prompt += `--- ${SYSTEM_PROMPTS.topics[topic]} ---\n\n`;
  }

  // Inject Glossary if exists
  if (glossary.length > 0) {
    prompt += `
--- واژه‌نامه اختصاصی (Custom Glossary) ---
دستورالعمل مهم: در متن ورودی، هرگاه به کلمات زیر برخورد کردید، الزاماً باید از معادل ذکر شده در مقابل آن استفاده کنید (حتی اگر ترجمه دیگری به نظر شما می‌رسد).
فرمت: [واژه اصلی] -> [ترجمه الزامی]

${glossary.map(item => `- ${item.term} -> ${item.translation}`).join('\n')}
\n`;
  }

  if (customPrompt) {
    prompt += `--- دستورالعمل‌های سفارشی کاربر ---\n${customPrompt}\n\n`;
  }
  
  return prompt;
};

export const FILE_EXTENSIONS = {
  SRT: '.srt',
  VTT: '.vtt',
  ASS: '.ass'
};
