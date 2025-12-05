



import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FileUpload } from './components/FileUpload';
import { StatsCard } from './components/StatsCard';
import { SubtitleEditor } from './components/SubtitleEditor';
import { SettingsModal } from './components/SettingsModal';
import { TimingModal } from './components/TimingModal';
import { ExportModal } from './components/ExportModal'; 
import { Toast, ToastType } from './components/Toast';
import { SubtitleBlock, AppStatus, BatchRequest, AppSettings, AdjustmentConfig, NetflixError, VttStyleConfig } from './types';
import { generateSubtitleFile, downloadFile, smartChunking, formatPersianSubtitle, adjustBlockTiming, validateNetflixStandards, fixNetflixStandards } from './services/subtitleUtils';
import { translateBatch } from './services/geminiService';
import { getFromMemory, addToMemory } from './services/translationMemory';
import { BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, APP_CONFIG } from './constants';
import { Loader2 } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'submaster_pro_settings_v1';
const VERSION_STORAGE_KEY = 'submaster_pro_version';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [blocks, setBlocks] = useState<SubtitleBlock[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [originalType, setOriginalType] = useState<'SRT' | 'VTT'>('SRT');
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  
  // Toast States
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false); 
  const [netflixErrors, setNetflixErrors] = useState<NetflixError[]>([]);
  
  const [startTime, setStartTime] = useState<number | null>(null);
  const [processingDuration, setProcessingDuration] = useState<string | null>(null);
  const [completionToast, setCompletionToast] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    tone: 'conversational',
    topic: 'educational',
    outputFormat: 'vtt', 
    outputStandard: 'normal',
    model: 'standard',
    customPrompt: '',
    apiKeys: [],
    enableTranslationMemory: true 
  });

  const statusRef = useRef<AppStatus>(AppStatus.IDLE);
  const blocksRef = useRef<SubtitleBlock[]>([]);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // Load settings and version from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (!parsed.apiKeys) parsed.apiKeys = [];
        if (!parsed.outputStandard) parsed.outputStandard = 'normal';
        if (parsed.enableTranslationMemory === undefined) parsed.enableTranslationMemory = true;
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load settings from local storage:', error);
      }
    }

    const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (savedVersion) {
        APP_CONFIG.version = savedVersion;
    }
  }, []);

  const checkForUpgrade = (input: string) => {
    if (input.toLowerCase().includes('upgrade version')) {
       let currentVersion = APP_CONFIG.version;
       const parts = currentVersion.split('.');
       if (parts.length >= 2) {
         const lastIndex = parts.length - 1;
         const lastPart = parseInt(parts[lastIndex]);
         if (!isNaN(lastPart)) {
             parts[lastIndex] = (lastPart + 1).toString().padStart(parts[lastIndex].length, '0');
             const newVersion = parts.join('.');
             APP_CONFIG.version = newVersion;
             localStorage.setItem(VERSION_STORAGE_KEY, newVersion);
             alert(`System upgraded to v${newVersion} [Simulated]`);
         }
       }
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    if (newSettings.customPrompt) {
        checkForUpgrade(newSettings.customPrompt);
    }
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const showToast = (msg: string, type: ToastType = 'error') => {
    setToast({ msg, type });
  };

  const handleFileLoad = (loadedBlocks: SubtitleBlock[], name: string, type: 'SRT' | 'VTT', size: number) => {
    setBlocks(loadedBlocks);
    setFilename(name);
    setFileSize(size);
    setOriginalType(type);
    
    setStatus(AppStatus.READY);
    setProcessedCount(0);
    setProgressMessage('');
    setToast(null);
    setProcessingDuration(null);
    setCompletionToast(false);
    setNetflixErrors([]);
  };

  const handleFileError = (msg: string) => {
    showToast(msg, 'error');
  };

  const resetProject = () => {
    setStatus(AppStatus.IDLE);
    setBlocks([]);
    setFilename('');
    setFileSize(0);
    setProcessedCount(0);
    setToast(null);
    setProgressMessage('');
    setProcessingDuration(null);
    setStartTime(null);
    setCompletionToast(false);
    setNetflixErrors([]);
  };

  const updateBlock = (id: number, text: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, translatedText: text } : b));
    
    // Optional: If user manually edits a block, should we update memory?
    // Let's decide NOT to auto-update memory on manual edit to prevent polluting memory with context-specific edits,
    // unless we add an explicit "Save to Memory" button later.
  };

  const handleTimingAdjustment = (config: AdjustmentConfig) => {
    const updatedBlocks = adjustBlockTiming(blocks, config);
    setBlocks(updatedBlocks);
    setNetflixErrors([]);
  };

  const handleNetflixCheck = () => {
    const errors = validateNetflixStandards(blocks);
    setNetflixErrors(errors);
    if (errors.length === 0) {
       showToast("هیچ خطایی مطابق استاندارد نتفلیکس یافت نشد.", 'success');
    }
  };

  const handleFixNetflixErrors = () => {
    const fixedBlocks = fixNetflixStandards(blocks);
    setBlocks(fixedBlocks);
    
    const errors = validateNetflixStandards(fixedBlocks);
    setNetflixErrors(errors);
    
    if (errors.length === 0) {
        showToast("تمامی خطاها با موفقیت برطرف شدند!", 'success');
    } else {
        showToast(`اصلاح خودکار انجام شد. ${errors.length} مورد باقی مانده است.`, 'warning');
    }
  };

  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleConfirmDownload = (format: 'srt' | 'vtt', styles?: VttStyleConfig) => {
    const outputName = filename.replace(/\.(srt|vtt)$/i, `_fa.${format}`);
    const content = generateSubtitleFile(blocks, format, styles);
    downloadFile(outputName, content);
    setIsExportModalOpen(false);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes} دقیقه و ${remainingSeconds} ثانیه`;
    }
    return `${seconds} ثانیه`;
  };

  const processChunks = async () => {
    const allBlocks = blocksRef.current;
    
    setProgressMessage('در حال تقسیم‌بندی فایل...');
    await new Promise(r => setTimeout(r, 100)); 
    const chunks = smartChunking(allBlocks, BATCH_SIZE);
    
    let completed = 0;
    const totalChunks = chunks.length;

    // Callback to handle API Key Rotation Updates
    const onKeyRateLimit = (failedKey: string) => {
        showToast(`کلید API (...${failedKey.slice(-4)}) به محدودیت رسید. جایگزینی با کلید بعدی...`, 'warning');
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.map(k => k.key === failedKey ? { ...k, isRateLimited: true } : k)
        }));
    };

    for (let i = 0; i < totalChunks; i++) {
      if (statusRef.current !== AppStatus.TRANSLATING) break;
      const chunk = chunks[i];

      setProgressMessage(`پردازش بخش ${i + 1} از ${totalChunks}...`);

      const preContextBlocks = chunk.blocks.slice(0, chunk.targetStartIndex);
      const targetBlocks = chunk.blocks.slice(chunk.targetStartIndex, chunk.targetEndIndex);
      const postContextBlocks = chunk.blocks.slice(chunk.targetEndIndex);

      // --- TRANSLATION MEMORY LOGIC ---
      let cachedCount = 0;
      if (settings.enableTranslationMemory) {
        targetBlocks.forEach(block => {
          if (!block.translatedText) {
            const cached = getFromMemory(block.originalText);
            if (cached) {
              block.translatedText = cached;
              cachedCount++;
            }
          }
        });

        // Update UI immediately if we found cached items
        if (cachedCount > 0) {
          setBlocks(prev => [...prev]); // Trigger re-render with updated block references
        }
      }

      // Filter out blocks that already have a translation (either from Memory or manual)
      const effectiveTarget = targetBlocks.filter(b => !b.translatedText);
      
      if (effectiveTarget.length === 0) {
        completed += targetBlocks.length;
        setProcessedCount(completed);
        continue;
      }

      const targetRequest: BatchRequest[] = effectiveTarget.map(b => ({ id: b.id, text: b.originalText }));
      
      // Context should include the just-cached items to keep context flow valid
      const preContextReq: BatchRequest[] = preContextBlocks.map(b => ({ id: b.id, text: `${b.originalText} (Persian: ${b.translatedText || 'N/A'})` }));
      const postContextReq: BatchRequest[] = postContextBlocks.map(b => ({ id: b.id, text: b.originalText }));

      try {
        const results = await translateBatch(targetRequest, preContextReq, postContextReq, settings, onKeyRateLimit);

        setBlocks(prev => {
          const newBlocks = [...prev];
          results.forEach(res => {
            const formattedText = formatPersianSubtitle(res.translatedText);
            const idx = newBlocks.findIndex(b => b.id === res.id);
            if (idx !== -1) {
              const block = newBlocks[idx];
              block.translatedText = formattedText;
              
              // Save to Translation Memory
              if (settings.enableTranslationMemory) {
                 addToMemory(block.originalText, formattedText);
              }
            }
          });
          return newBlocks;
        });

        completed += targetBlocks.length;
        setProcessedCount(completed);

        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));

      } catch (err: any) {
        console.error("Batch processing error:", err);
        const msg = err.message || `خطا در پردازش بخش ${chunk.id + 1}.`;
        showToast(msg, 'error');
        setStatus(AppStatus.ERROR);
        return;
      }
    }

    if (statusRef.current === AppStatus.TRANSLATING) {
      
      if (settings.outputStandard === 'netflix') {
         setProgressMessage('بهینه‌سازی برای استاندارد Netflix...');
         await new Promise(r => setTimeout(r, 800)); 
         
         const currentBlocks = blocksRef.current; 
         const fixedBlocks = fixNetflixStandards(currentBlocks);
         setBlocks(fixedBlocks);
         blocksRef.current = fixedBlocks; 
         
         const errors = validateNetflixStandards(fixedBlocks);
         setNetflixErrors(errors);
      }

      setProgressMessage('اعتبارسنجی نهایی...');
      await new Promise(r => setTimeout(r, 500));

      const finalBlocks = blocksRef.current;
      const missingCount = finalBlocks.filter(b => !b.translatedText).length;

      if (missingCount > 0) {
        showToast(`توجه: ${missingCount} خط ترجمه نشده باقی ماند.`, 'warning');
      } else {
         setProgressMessage('تکمیل شد!');
         setCompletionToast(true);
      }
      
      if (startTime) {
        const duration = Date.now() - startTime;
        setProcessingDuration(formatDuration(duration));
      }

      setStatus(AppStatus.COMPLETED);
    }
  };

  const startTranslation = () => {
    const hasAvailableKeys = settings.apiKeys.some(k => k.isValid && !k.isRateLimited);
    
    if (settings.apiKeys.length === 0) {
      showToast("هیچ کلید API تعریف نشده است. لطفاً در تنظیمات کلید شخصی اضافه کنید.", 'error');
      setIsSettingsOpen(true);
      return;
    }
    
    if (!hasAvailableKeys) {
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.map(k => ({...k, isRateLimited: false}))
        }));
    }

    setStartTime(Date.now());
    setStatus(AppStatus.TRANSLATING);
    setToast(null);
    setProcessingDuration(null);
    setCompletionToast(false);
    
    setTimeout(() => {
        processChunks();
    }, 100);
  };

  const pauseTranslation = () => {
    setStatus(AppStatus.PAUSED);
    setProgressMessage('متوقف شده');
  };

  const cancelTranslation = () => {
    setStatus(AppStatus.CANCELLED);
    setProgressMessage('پروژه لغو شد');
    setProcessingDuration(null);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      
      <Sidebar 
        settings={settings} 
        updateSettings={updateSettings} 
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        <Header />

        <main className="flex-1 px-4 md:px-8 py-8 w-full max-w-5xl mx-auto pb-24">
            
            {status === AppStatus.IDLE && (
                <div className="flex flex-col items-center justify-center min-h-[60vh]">
                     <div className="text-center mb-10 space-y-4">
                        <h2 className="text-4xl md:text-5xl font-montserrat font-bold text-white leading-tight">
                            Translation <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#ff00ea]">Reimagined</span>
                        </h2>
                        <p className="text-white/60 text-lg max-w-xl mx-auto">
                             مترجم هوشمند با قابلیت تشخیص لحن و موضوع. فایل خود را آپلود کنید و از نتیجه حرفه‌ای لذت ببرید.
                        </p>
                    </div>
                    <FileUpload 
                        onLoad={handleFileLoad} 
                        onError={handleFileError} 
                        status={status} 
                        outputStandard={settings.outputStandard} 
                    />
                </div>
            )}

            {status !== AppStatus.IDLE && (
                <>
                    <StatsCard 
                        status={status}
                        blocks={blocks}
                        onStart={startTranslation}
                        onPause={pauseTranslation}
                        onCancel={cancelTranslation}
                        onDownload={handleOpenExportModal} 
                        onNewProject={resetProject}
                        onOpenTimingTools={() => setIsTimingModalOpen(true)}
                        currentFileName={filename}
                        fileSize={fileSize}
                        progressMessage={progressMessage}
                        processingDuration={processingDuration}
                        validationErrors={netflixErrors}
                        onFixErrors={handleFixNetflixErrors}
                    />

                    <div className="mb-6 glass p-4 rounded-xl border border-white/10">
                         <textarea 
                            value={settings.customPrompt}
                            onChange={(e) => updateSettings({ customPrompt: e.target.value })}
                            placeholder="دستورالعمل خاصی دارید؟ اینجا بنویسید... (مثلاً: همیشه واژه 'Galaxy' را به 'کهکشان' ترجمه کن)"
                            className="w-full bg-transparent text-sm text-white placeholder-white/30 focus:outline-none resize-none h-12"
                         />
                    </div>
                    
                    <SubtitleEditor 
                        blocks={blocks} 
                        onUpdateBlock={updateBlock} 
                        validationErrors={netflixErrors}
                    />
                </>
            )}
        </main>
        
        <footer className="w-full py-6 text-center text-white/20 text-xs border-t border-white/5 mt-auto">
            <p className="font-montserrat">Designed and developed with ❤️ by Saeid Bagherian</p>
        </footer>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
      />

      <TimingModal 
        isOpen={isTimingModalOpen}
        onClose={() => setIsTimingModalOpen(false)}
        onApply={handleTimingAdjustment}
        onNetflixCheck={handleNetflixCheck}
      />

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmDownload}
        defaultFormat={settings.outputFormat}
      />

       {status === AppStatus.TRANSLATING && (
            <div className="fixed bottom-8 right-8 glass border border-[#00f0ff]/50 text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10">
                <div className="relative">
                     <div className="absolute inset-0 bg-[#00f0ff] blur opacity-50 animate-pulse"></div>
                     <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff] relative z-10" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold">{progressMessage || 'در حال پردازش...'}</span>
                    <span className="text-xs text-white/50">پیشرفت: {Math.round((processedCount / (blocks.length || 1)) * 100)}%</span>
                </div>
            </div>
        )}

        {/* Global Toast System */}
        {toast && (
            <Toast 
                message={toast.msg} 
                type={toast.type} 
                onClose={() => setToast(null)} 
            />
        )}
        
        {/* Completion Toast */}
        {completionToast && (
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-300 w-full max-w-md px-4">
                <div className="glass bg-[#0a0e27]/95 border border-green-500/50 text-white p-4 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.2)] flex items-start gap-4 backdrop-blur-xl">
                    <div className="p-2 bg-green-500/20 rounded-full flex-shrink-0 mt-0.5">
                    <Loader2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <strong className="block text-sm font-bold text-green-200 mb-1">تکمیل شد</strong>
                        <p className="text-sm text-white/80 leading-relaxed">ترجمه با موفقیت به پایان رسید.</p>
                    </div>
                    <button 
                        onClick={() => setCompletionToast(false)} 
                        className="p-1 hover:bg-white/10 rounded-full transition-colors -mr-1 text-white/50 hover:text-white"
                    >
                        <Loader2 className="w-4 h-4 rotate-45" />
                    </button>
                </div>
            </div>
        )}

    </div>
  );
};

export default App;
