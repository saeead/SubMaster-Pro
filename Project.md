# Project.md — مستند فنی SubMaster Pro

## 1. نمای کلی پروژه

**SubMaster Pro** یک اپلیکیشن وب تک‌صفحه‌ای برای بارگذاری، ترجمه، ویرایش، بهینه‌سازی و خروجی گرفتن از فایل‌های زیرنویس است. پروژه با **React 19**، **TypeScript** و **Vite** پیاده‌سازی شده و تمام جریان اصلی آن در مرورگر اجرا می‌شود. سرویس ترجمه می‌تواند از Gemini، LM Studio یا سرویس‌های OpenAI-compatible استفاده کند و خروجی را در قالب‌های SRT، VTT و ASS تولید کند.

پروژه backend اختصاصی ندارد؛ بنابراین وضعیت پروژه، تنظیمات، واژه‌نامه و حافظه ترجمه عمدتاً در `localStorage` مرورگر نگهداری می‌شوند. تنها مسیر شبیه‌به backend در کد، proxy اختیاری `/api/openai-compatible/chat/completions` برای سرویس‌های OpenAI-compatible است که در صورت نبودن یا خطای 404/405، کد به فراخوانی مستقیم endpoint برمی‌گردد.

## 2. تکنولوژی‌ها و وابستگی‌ها

- **React + React DOM** برای UI و مدیریت state کامپوننتی.
- **TypeScript** برای تعریف مدل‌های داده و تایپ‌کردن سرویس‌ها و کامپوننت‌ها.
- **Vite** برای توسعه، build و اجرای محلی.
- **@google/genai** برای ارتباط با Gemini.
- **JSZip** برای خروجی دسته‌ای فایل‌ها به صورت ZIP.
- **lucide-react** برای آیکن‌ها.

اسکریپت‌های اصلی پروژه:

- `npm run dev`: اجرای محیط توسعه Vite.
- `npm run build`: build production.
- `npm run preview`: preview خروجی build.

## 3. ساختار دایرکتوری و نقش فایل‌ها

```text
src/
  App.tsx                         هسته orchestration اپلیکیشن
  index.tsx                       نقطه ورود React
  constants.ts                    تنظیمات عمومی، مدل‌ها، promptها و استانداردها
  types.ts                        مدل‌های داده، enumها و typeهای مشترک
  services/
    geminiService.ts              لایه ارتباط با مدل‌های AI، retry، validation و diagnostics
    subtitleUtils.ts              parse/stringify زیرنویس، chunking، timing و QC
    translationMemory.ts          حافظه ترجمه روی localStorage
    projectStateManager.ts        ذخیره/بازیابی پروژه روی localStorage
    translationJobRunner.ts       صف ترجمه، lifecycle jobها و AbortController
  components/
    Header.tsx                    نوار بالایی و اکشن‌های عمومی
    Sidebar.tsx                   لیست فایل‌ها و نشست‌های ذخیره‌شده
    FileUpload.tsx                دریافت و parse فایل‌ها
    SubtitleEditor.tsx            ویرایش بلوک‌ها، انتخاب، undo/redo و ابزارهای متنی
    SettingsModal.tsx             تنظیم API، مدل، provider، prompt، استاندارد و ظاهر
    ExportModal.tsx               انتخاب فرمت و style خروجی
    TimingModal.tsx               تنظیم گروهی timing
    GlossaryModal.tsx             مدیریت واژه‌نامه
    TextTranslatorModal.tsx       ترجمه متن آزاد
    Toast.tsx                     اعلان‌های کاربر
```

## 4. مدل داده و state اصلی

مدل اصلی هر cue زیرنویس، `SubtitleBlock` است. هر بلوک شامل `id`، زمان شروع و پایان، متن اصلی، متن ترجمه‌شده و `index` نمایشی است. وضعیت کلی هر فایل با `SubtitleFile` نگهداری می‌شود که علاوه بر metadata فایل، لیست بلوک‌ها، وضعیت پردازش، درصد پیشرفت، خطاهای استاندارد خروجی، شمارش پردازش‌شده‌ها و تاریخچه undo/redo را دارد.

در `AppSettings` فیلد `targetLanguage` هم وجود دارد تا pipeline ترجمه، promptها و formatterها به فارسی محدود نباشند.

وضعیت پردازش فایل با enum `AppStatus` مدیریت می‌شود:

- `IDLE`
- `PARSING`
- `READY`
- `TRANSLATING`
- `PAUSED`
- `COMPLETED`
- `ERROR`
- `CANCELLED`

تنظیمات کاربر در `AppSettings` تعریف شده‌اند؛ شامل tone، topic، temperature، output format، output standard، روش ترجمه، مدل، provider، تنظیمات LM Studio، سرویس‌های OpenAI-compatible، prompt سفارشی، کلیدهای API، حافظه ترجمه، واژه‌نامه، اصطلاحات غیرقابل ترجمه و theme.

## 5. معماری کلی

معماری پروژه به صورت **client-side layered SPA** است:

1. **لایه UI**: کامپوننت‌های React در `src/components` برای دریافت فایل، تنظیمات، نمایش لیست فایل‌ها، ویرایش زیرنویس و export.
2. **لایه orchestration**: فایل `src/App.tsx` که state اصلی را نگه می‌دارد و جریان‌هایی مثل بارگذاری فایل، شروع ترجمه، توقف، ادامه، ذخیره، export و batch actions را هماهنگ می‌کند. orchestration ترجمه اکنون روی job queue جداگانه سوار شده است.
3. **لایه domain utilities**: فایل `src/services/subtitleUtils.ts` که parse، stringify، chunking، تنظیم زمان، formatterهای زبان‌محور و اعتبارسنجی استانداردها را انجام می‌دهد.
4. **لایه AI gateway**: فایل `src/services/geminiService.ts` که prompt می‌سازد، provider مناسب را فراخوانی می‌کند، خروجی JSON را validate می‌کند، retry و چرخش کلید API را مدیریت می‌کند و خطاها را diagnostic-friendly می‌کند. این لایه برای providerهای HTTP از AbortController هم پشتیبانی می‌کند.
5. **لایه persistence محلی**: فایل‌های `translationMemory.ts` و `projectStateManager.ts` که داده‌ها را در `localStorage` ذخیره و بازیابی می‌کنند.

## 6. جریان بارگذاری فایل

کاربر می‌تواند چند فایل زیرنویس را بارگذاری کند. فایل‌ها بعد از parse به مجموعه‌ای از `SubtitleBlock` تبدیل می‌شوند و برای هر فایل یک `SubtitleFile` با `crypto.randomUUID()` ساخته می‌شود. پروژه تا 10 فایل و حجم هر فایل تا 100MB را در configuration پشتیبانی می‌کند.

Parserها در `subtitleUtils.ts` پیاده‌سازی شده‌اند:

- `parseSRT`: cueهای SRT را با زمان `HH:MM:SS,mmm` استخراج می‌کند.
- `parseVTT`: زمان‌های VTT با نقطه را به فرمت داخلی comma-based تبدیل می‌کند.
- `parseASS`: بخش `[Events]` و خطوط `Dialogue:` را می‌خواند، تگ‌های ASS را حذف می‌کند و زمان را به فرمت داخلی تبدیل می‌کند.

فرمت داخلی زمان در اکثر توابع `HH:MM:SS,mmm` است و برای ASS هنگام خروجی گرفتن به centisecond تبدیل می‌شود.

## 7. مدیریت تنظیمات و شخصی‌سازی ترجمه

تنظیمات در `localStorage` با کلید `submaster_pro_settings_v1` ذخیره می‌شوند. هنگام load اولیه، کد برای compatibility با نسخه‌های قبلی، فیلدهای missing را مقداردهی پیش‌فرض می‌کند.

تنظیمات اثرگذار روی ترجمه:

- **Tone**: محاوره‌ای، رسمی، خبری، سینمایی، پادکست.
- **Topic**: آموزشی، سرگرمی، پادکست، اخبار، ورزشی.
- **Temperature**: به صورت خودکار بر اساس topic preset می‌شود، اما قابل تغییر است.
- **Output Standard**: normal، netflix، bbc، broadcast.
- **Translation Method**: default یا paragraph.
- **Provider**: Gemini، LM Studio یا OpenAI-compatible.
- **Glossary** و **Do-not-translate terms**: در system prompt تزریق می‌شوند.
- **Custom Prompt**: به انتهای دستورالعمل سیستم اضافه می‌شود.

`getSystemInstruction` در `constants.ts` prompt نهایی را از پروتکل پایه، استاندارد خروجی، tone، topic، واژه‌نامه، اصطلاحات محافظت‌شده و prompt سفارشی می‌سازد.

## 8. استراتژی chunking و context

پروژه دو روش اصلی برای برنامه‌ریزی ترجمه دارد:

### 8.1 روش default / smart chunking

`smartChunking` فایل را به chunkهای معمولاً 20تایی تقسیم می‌کند. اما قبل و بعد chunk، context هوشمند اضافه می‌شود. تابع `getSmartContextWindow` تا چند بلوک قبل/بعد را نگاه می‌کند و اگر جمله ناقص باشد یا مرز دیالوگ وجود نداشته باشد، context را گسترش می‌دهد. هدف این است که مدل فقط target را ترجمه کند ولی برای فهم جمله‌های شکسته‌شده، بافت اطراف را ببیند.

### 8.2 روش paragraph

`paragraphChunking` cueها را به پاراگراف‌های marked تبدیل می‌کند. هر بلوک با marker مثل `⟦123⟧` مشخص می‌شود. این روش برای ترجمه روان‌تر متن‌های پیوسته طراحی شده، اما مرز cueها را سخت نگه می‌دارد تا خروجی دوباره به همان idهای زیرنویس برگردد. محدودیت chunk بر اساس تعداد کاراکتر و نقاط امن مثل پایان جمله یا مرز speaker مدیریت می‌شود.

## 9. جریان ترجمه و مدیریت taskها

ترجمه توسط `startBatchTranslation` و `processFile` در `App.tsx` برنامه‌ریزی می‌شود.

### 9.1 شروع task ترجمه

وقتی کاربر ترجمه را شروع می‌کند:

1. اگر provider محلی نباشد، وجود API key معتبر بررسی می‌شود.
2. اگر کلیدها قبلاً rate-limited شده باشند، در صورت نبود کلید آزاد reset می‌شوند.
3. فایل‌های قابل پردازش انتخاب می‌شوند: `READY`، `ERROR` یا `PAUSED`.
4. اتصال provider با `diagnoseConnection` تست می‌شود.
5. پرچم‌های ref-based یعنی `isTranslatingRef` و `isPausedRef` تنظیم می‌شوند.
6. فایل‌ها به ترتیب پردازش می‌شوند، بین فایل‌ها delay ثابت وجود دارد.

### 9.2 پردازش هر فایل

برای هر فایل:

1. وضعیت به `TRANSLATING` تغییر می‌کند.
2. بر اساس روش ترجمه، chunkها ساخته می‌شوند.
3. اگر فایل قبلاً تا بخشی ترجمه شده باشد، chunkهای کامل skip می‌شوند و resume از اولین chunk ناقص انجام می‌شود.
4. برای هر chunk، context قبل، target و context بعد ساخته می‌شود.
5. حافظه ترجمه بررسی می‌شود؛ اگر ترجمه source قبلاً ذخیره شده باشد، بدون فراخوانی مدل استفاده می‌شود.
6. فقط بلوک‌های بدون ترجمه به `translateBatch` ارسال می‌شوند.
7. خروجی model بر اساس id به بلوک‌ها برگردانده می‌شود.
8. متن فارسی با `formatPersianSubtitle` به حداکثر دو خط مناسب‌تر شکسته می‌شود.
9. ترجمه‌های جدید در حافظه ترجمه ذخیره می‌شوند.
10. بین batchها delay ثابت وجود دارد.
11. پیشرفت بر اساس تعداد target blockهای انجام‌شده محاسبه می‌شود.
12. در پایان، اگر استاندارد خروجی normal نباشد، auto-fix و validation استاندارد اجرا می‌شود.

### 9.3 توقف، pause و cancel

پروژه قبلاً به جای cancel کردن مستقیم promiseهای در حال اجرا، از refها استفاده می‌کرد. اکنون یک job queue سبک هم وجود دارد و برای jobهای قابل‌لغو، `AbortController` روی درخواست جاری اعمال می‌شود:

- `isTranslatingRef.current = false` باعث توقف loop بعد از پایان مرحله جاری می‌شود.
- `isPausedRef.current = true` تفاوت pause با cancel را مشخص می‌کند.
- `TranslationJobRunner` jobهای queued/running/paused/cancelled را مدیریت می‌کند.
- `AbortController` برای fetchهای LM Studio و OpenAI-compatible پاس داده می‌شود.
- در pause، وضعیت پروژه ذخیره می‌شود و فایل به `PAUSED` می‌رود.
- در cancel، وضعیت فایل‌های در حال ترجمه یا pause شده به `CANCELLED` می‌رود.

این طراحی هنوز client-side است، اما توقف شبکه را بسیار سریع‌تر و قابل پیش‌بینی‌تر کرده است.

## 10. لایه AI و کیفیت خروجی

`geminiService.ts` یک gateway واحد برای ترجمه است.

### 10.1 Providerها

- **Gemini**: با `GoogleGenAI` و `models.generateContent` فراخوانی می‌شود. برای Gemini از `responseMimeType: application/json` و schema آرایه‌ای استفاده شده است.
- **LM Studio**: از endpoint سازگار با OpenAI یعنی `/chat/completions` روی base URL محلی استفاده می‌کند.
- **OpenAI-compatible**: endpoint از base URL ساخته می‌شود و ابتدا از proxy داخلی `/api/openai-compatible/chat/completions` استفاده می‌کند؛ اگر proxy وجود نداشت، fallback به fetch مستقیم انجام می‌شود. برای OpenRouter، headerهای referer و title نیز اضافه می‌شوند و در بعضی موارد prefix مدل normalize می‌شود.

### 10.2 اعتبارسنجی پاسخ مدل

`validateBatchResponse` کنترل می‌کند که:

- خروجی آرایه JSON باشد.
- هر item دارای `id` عددی و `translatedText` غیرخالی باشد.
- idها غیرمنتظره، تکراری یا missing نباشند.
- متن شامل marker خام، markdown یا توضیحات اضافه نباشد.
- تعداد خروجی با تعداد targetها برابر باشد.
- ترجمه‌های تکراری پشت‌سرهم و cueهای بیش از حد بلند هم علامت‌گذاری می‌شوند.

سپس خروجی بر اساس ترتیب target idها مرتب می‌شود.

### 10.3 self-review و اصلاح محلی

بعد از ترجمه اولیه، متن‌ها با `assessTranslationQuality` بررسی می‌شوند. موارد critical مثل marker خام، markdown، متن خالی، انگلیسی ناخواسته یا طول غیرعادی باعث می‌شوند همان بلوک‌ها وارد مرحله review شوند. در review، مدل prompt جداگانه‌ای دریافت می‌کند تا draft را اصلاح کند، نه اینکه همه چیز را بی‌دلیل از صفر بازترجمه کند. مشکلات سبک‌تر مثل طول خط زیاد یا بیش از دو خط بودن، با normalize محلی مدیریت می‌شوند.

### 10.4 retry و rate limit

برای Gemini، `APIKeyManager` کلیدهای معتبر را نگه می‌دارد و در خطای 429، کلید فعلی را rate-limited می‌کند و سراغ کلید بعدی می‌رود. برای خطاهای overload مثل 503 یا unavailable، delay بلندتری اعمال می‌شود. سایر خطاها با backoff نمایی ساده retry می‌شوند. اگر اتصال، quota یا overload در سطح `processFile` تشخیص داده شود، فایل pause می‌شود و diagnostic قابل فهم به کاربر نمایش داده می‌شود.

## 11. حافظه ترجمه

حافظه ترجمه در `translationMemory.ts` با کلید `submaster_translation_memory_v1` در `localStorage` ذخیره می‌شود. mapping ساده‌ای از متن اصلی به متن ترجمه‌شده نگهداری می‌شود. قبل از فراخوانی مدل، هر بلوک target در حافظه جستجو می‌شود و اگر ترجمه موجود باشد، از API call حذف می‌شود. سقف نرم حافظه 10,000 مورد است و هنگام پر شدن quota حدود 20٪ ورودی‌های قدیمی حذف می‌شوند.

## 12. ذخیره و بازیابی پروژه

`projectStateManager.ts` برای هر پروژه کلیدی با prefix `submaster_proj_v1_` می‌سازد و state را JSON-serialize می‌کند. state شامل اطلاعات زیر است:

- تعداد کل/انجام‌شده/باقی‌مانده chunkها.
- بلوک‌های پردازش‌شده.
- `processedBlockIds` برای resume پایدارتر.
- کل بلوک‌های فایل.
- وضعیت و درصد پیشرفت.
- تاریخچه تغییرات.
- زمان آخرین ذخیره.

در `App.tsx` با هر تغییر در `files`، auto-save اجرا می‌شود. کاربر همچنین می‌تواند ذخیره دستی، import backup JSON و export backup JSON انجام دهد.

نکته امنیتی مهم: schema پروژه هنوز فیلد `apiKeyUsed` را به‌صورت backward-compatible نگه می‌دارد، اما در مسیر save/export مقدار آن خالی می‌شود تا کلید واقعی ذخیره نشود.

## 13. ویرایش، undo/redo و عملیات گروهی

ویرایش متن ترجمه‌شده از طریق editor انجام می‌شود. تغییرات در ساختار `Modification` ذخیره می‌شوند. هر modification شامل `blockId`، `oldState`، `newState`، timestamp و `groupId` اختیاری است. Undo/redo می‌تواند تغییرات گروهی مانند find/replace یا اصلاح دسته‌ای را با یک اکشن برگرداند.

Shortcutها:

- `Ctrl/Cmd + Z`: undo.
- `Ctrl/Cmd + Shift + Z`: redo.
- `Ctrl/Cmd + Y`: redo در ویندوز.

برای بعضی عملیات ساختاری مثل حذف بلوک‌ها، id و index دوباره شماره‌گذاری می‌شوند و تاریخچه پاک می‌شود تا inconsistency ایجاد نشود.

## 14. کنترل کیفیت و استانداردهای خروجی

پروژه چند استاندارد خروجی دارد:

- `normal`
- `netflix`
- `bbc`
- `broadcast`

`validateNetflixStandards` با وجود نام تاریخی‌اش برای همه استانداردها استفاده می‌شود و مواردی مثل این‌ها را بررسی می‌کند:

- حداکثر کاراکتر هر خط.
- حداکثر دو خط.
- CPS یا کاراکتر بر ثانیه.
- حداقل و حداکثر duration.
- حداقل gap بین cueها.

`fixNetflixStandards` تلاش می‌کند متن را smart split کند و duration مناسب‌تری بر اساس CPS هدف بسازد، با در نظر گرفتن فاصله با cue بعدی.

`optimizePersianStructure` نیز بعد از ترجمه می‌تواند بعضی cueهای فارسی را بر اساس اتصال معنایی، gap کوتاه و طول مجاز ادغام کند تا خروجی طبیعی‌تر شود.

## 15. خروجی گرفتن

خروجی تکی از `handleConfirmDownload` و خروجی دسته‌ای از `handleDownloadZip` انجام می‌شود.

- SRT با `stringifySRT` تولید می‌شود.
- VTT با `stringifyVTT` تولید می‌شود و در صورت فعال بودن style، block `STYLE` و کلاس cue اضافه می‌شود.
- ASS با `stringifyASS` تولید می‌شود و style کامل شامل فونت، رنگ، outline/box، shadow و alignment در header نوشته می‌شود.
- formatter خروجی اکنون بر اساس `targetLanguage` هم line break مناسب‌تری می‌سازد.

اگر `translatedText` وجود نداشته باشد، خروجی برای آن cue از `originalText` استفاده می‌کند تا فایل ناقص هم قابل export باشد.

## 16. تشخیص خطا و تجربه کاربری

خطاهای ارتباطی و مدل به `TranslationDiagnostic` تبدیل می‌شوند. diagnostic شامل code، severity، title، cause، recovery، جزئیات فنی و timestamp است. این داده هم در فایل فعال نگهداری می‌شود و هم به صورت toast نمایش داده می‌شود. این طراحی کمک می‌کند کاربر تفاوت بین مشکل اتصال، quota، endpoint اشتباه، خروجی JSON نامعتبر یا overload مدل را بفهمد.

## 17. جمع‌بندی معماری عملکرد

SubMaster Pro یک pipeline مرورگری برای ترجمه زیرنویس است:

```text
Upload files
  -> parse SRT/VTT/ASS
  -> create SubtitleFile state
  -> persist local project
  -> choose pending files
  -> diagnose provider
  -> chunk with context
  -> fill from translation memory
  -> translate missing blocks
  -> validate JSON/id mapping
  -> review critical outputs
  -> local subtitle formatting
  -> update progress and autosave
  -> QC/fix standards
  -> export SRT/VTT/ASS or ZIP
```

نقطه قوت اصلی معماری، ساده بودن deploy و اجرای کاملاً client-side است. نقطه ضعف اصلی همین معماری، محدودیت‌های localStorage و ریسک‌های مقیاس‌پذیری است؛ با این حال job queue سبک، AbortController و تست‌های واحد هسته‌ای بخشی از این gap را کم کرده‌اند.

## 18. معماری مکمل: Skeleton STR (سه‌فاز، opt-in)

روش `skeleton_str` یک strategy مستقل در کنار `default` و `paragraph` است؛ انتخاب آن اختیاری است و promptها و رفتار روش‌های موجود را تغییر نمی‌دهد. هسته این strategy در `src/services/methods/skeleton_str/index.ts` نگهداری می‌شود و یک قرارداد index-based دارد: مدل فقط دیالوگ را می‌بیند و ساختار فایل دوباره از خروجی مدل parse نمی‌شود.

```text
source text
  -> Phase 1: detect + split
     originalLines + contentLines + contentIndices
  -> Phase 2: numbered context batches
     translatedLines (هم‌طول با contentLines)
  -> Phase 3: restore by original physical indices
     original skeleton with translated dialogue
```

### فاز ۱: جداسازی skeleton

`detectSkeletonFileType` با بررسی محتوا، VTT را از header، ASS را فقط با رأی اکید، و SRT/SBV/LRC را با الگوهای زمان تشخیص می‌دهد. `filterSubLines` فقط خطوط قابل ترجمه را همراه با اندیس فیزیکی‌شان ذخیره می‌کند. بنابراین timecode، شماره cue، metadata و blockهای VTT، شناسه cue، و فیلدهای غیرمتنی ASS وارد payload مدل نمی‌شوند. برای ASS، `prepareAssForTranslation` تگ‌های ابتدایی و breakهای `\N` را با placeholder محافظت می‌کند و drawingها را verbatim نگه می‌دارد.

### فاز ۲: ترجمه دیالوگ با markerهای شماره‌دار

`buildContextPayload` فقط targetها را با `[TRANSLATE_n]` و همسایه‌ها را با `[CONTEXT]` می‌سازد. `translateSkeletonPayload` همان gateway/provider انتخابی برنامه را با system instruction اختصاصی صدا می‌زند. `extractTranslatedLinesWithNumbers` با backreference markerها را می‌خواند، از fallback موقعیتی پرهیز می‌کند، پاسخ one-based جابه‌جا، merge مشکوک و echo از context را رد می‌کند. در orchestration، هر slot نامعتبر یا خالی با source همان block باقی می‌ماند تا هیچ cue جابه‌جا نشود.

### فاز ۳: بازگردانی skeleton

`restoreSkeleton` یک کپی از `originalLines` می‌سازد و فقط در `contentIndices` می‌نویسد. اگر translation slot خالی باشد، هیچ writeای انجام نمی‌شود؛ در نتیجه blank cue separator ایجاد نشده و متن اصلی همان timestamp باقی می‌ماند. برای ASS prefix تمام فیلدهای `Dialogue:` حفظ می‌شود؛ برای LRC تمام timestamp prefixها باقی می‌مانند. در حالت bilingual، cueها با اندیس timecode قبلی گروه‌بندی می‌شوند، نه با مقدار زمان، تا cueهای مستقل با timestamp یکسان با هم ادغام نشوند. line ending اصلی (`\n` یا `\r\n`) نیز در restore حفظ می‌شود.
