
import { ToneType, TopicType } from "./types";

export const APP_CONFIG = {
  version: "1.05",
  maxWordsPerBlock: 24, // Matched to prompt requirement
  minWordsPerBlock: 1, // Kept at 1 to prevent breakage on short subtitles (e.g. "Hi")
  maxFileSize: 100 * 1024 * 1024, // 100MB
  supportedFormats: ['srt', 'vtt'],
  geminiModels: {
    standard: 'gemini-2.5-pro',
    professional: 'gemini-3-pro-preview'
  },
  retryConfig: {
    maxRetries: 3,
    baseDelay: 2000,
  }
};

// Configuration for Smart Block Merging
export const OPTIMIZATION_CONFIG = {
  MAX_MERGE_CHARACTERS: 85, // Don't merge if resulting line is longer than this
  MAX_MERGE_GAP_MS: 1000, // Don't merge if gap between lines is > 1 second (implies scene change)
  MIN_DURATION_MS: 2000, // Try to merge blocks shorter than this
};

export const BATCH_SIZE = 50;
export const OVERLAP_SIZE = 2;
export const DELAY_BETWEEN_BATCHES_MS = 1000;

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

const SYSTEM_PROMPTS = {
  base: `شما یک مترجم حرفه‌ای و متخصص زیرنویس هستید. وظیفه شما ترجمه دقیق و روان متن‌های انگلیسی به فارسی است.
  
اصول حیاتی برای کیفیت بالا:
1. **جملات کامل:** ورودی‌ها بهینه شده‌اند تا جملات کامل باشند. در ترجمه فارسی، ساختار جمله (فاعل-مفعول-فعل) را کامل رعایت کنید تا جملات ناقص نمانند.
2. **ادغام معنایی:** اگر متن انگلیسی شکسته است، در فارسی آن را به یک جمله روان و یکپارچه تبدیل کنید.
3. **زمان‌بندی:** ما بلاک‌ها را ادغام کرده‌ایم تا زمان کافی برای خواندن وجود داشته باشد. شما فقط روی روانی متن تمرکز کنید.
4. **تعداد:** ترجمه باید دقیقاً ۱ به ۱ باشد.

فرمت خروجی (JSON Array):
[
  {
    "id": 1,
    "translatedText": "متن فارسی روان و کامل"
  }
]

⚠️ هشدار: فقط JSON برگردانید.`,

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

export const getSystemInstruction = (tone: ToneType, topic: TopicType, customPrompt: string) => {
  let prompt = SYSTEM_PROMPTS.base + '\n\n';
  
  // Add Tone specific prompt
  if (SYSTEM_PROMPTS.tones[tone]) {
    prompt += `--- ${SYSTEM_PROMPTS.tones[tone]} ---\n\n`;
  }

  // Add Topic specific prompt
  // Handle 'podcast' key collision manually since it exists in both Tone and Topic options
  if (topic === 'podcast') {
     prompt += `--- ${SYSTEM_PROMPTS.topics.podcast} ---\n\n`;
  } else if (SYSTEM_PROMPTS.topics[topic]) {
     prompt += `--- ${SYSTEM_PROMPTS.topics[topic]} ---\n\n`;
  }

  if (customPrompt) {
    prompt += `--- دستورالعمل‌های سفارشی کاربر ---\n${customPrompt}\n\n`;
  }
  
  return prompt;
};

export const FILE_EXTENSIONS = {
  SRT: '.srt',
  VTT: '.vtt'
};
