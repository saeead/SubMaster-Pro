







import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FileUpload } from './components/FileUpload';
import { StatsCard } from './components/StatsCard';
import { SubtitleEditor } from './components/SubtitleEditor';
import { SettingsModal } from './components/SettingsModal';
import { TimingModal } from './components/TimingModal';
import { ExportModal } from './components/ExportModal';
import { GlossaryModal } from './components/GlossaryModal';
import { Toast, ToastType } from './components/Toast';
import { SubtitleBlock, AppStatus, BatchRequest, AppSettings, AdjustmentConfig, NetflixError, VttStyleConfig, GlossaryItem, SubtitleFile } from './types';
import { generateSubtitleFile, downloadFile, smartChunking, formatPersianSubtitle, adjustBlockTiming, validateNetflixStandards, fixNetflixStandards } from './services/subtitleUtils';
import { translateBatch } from './services/geminiService';
import { getFromMemory, addToMemory } from './services/translationMemory';
import { BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, DELAY_BETWEEN_FILES_MS, APP_CONFIG, TOPIC_TEMPERATURE_DEFAULTS } from './constants';
import { Loader2, File, Check, X as XIcon } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'submaster_pro_settings_v1';
const VERSION_STORAGE_KEY = 'submaster_pro_version';

const App: React.FC = () => {
  // --- STATE ---
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
  
  const [completionToast, setCompletionToast] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    tone: 'conversational',
    topic: 'educational',
    temperature: 0.3, // Default for educational
    outputFormat: 'vtt', 
    outputStandard: 'normal',
    model: 'standard',
    customPrompt: '',
    apiKeys: [],
    enableTranslationMemory: true,
    glossary: []
  });

  const filesRef = useRef<SubtitleFile[]>([]);
  const isTranslatingRef = useRef<boolean>(false);

  useEffect(() => { filesRef.current = files; }, [files]);

  // Load settings and version from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (!parsed.apiKeys) parsed.apiKeys = [];
        if (!parsed.outputStandard) parsed.outputStandard = 'normal';
        if (parsed.enableTranslationMemory === undefined) parsed.enableTranslationMemory = true;
        if (!parsed.glossary) parsed.glossary = [];
        if (parsed.temperature === undefined) parsed.temperature = 0.7; // Fallback
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

  // Auto-adjust temperature when topic changes
  useEffect(() => {
    const preset = TOPIC_TEMPERATURE_DEFAULTS[settings.topic];
    if (preset) {
      // Check if the current temperature is wildly different or just update it?
      // For better UX, if user changes topic, we assume they want the optimal settings for that topic.
      // However, we avoid infinite loop or overriding manual adjustment if topic hasn't changed.
      // Since this effect runs on settings.topic change, it's safe.
      setSettings(prev => {
        // Prevent update loop if already set (though useEffect dependency array handles this mostly)
        if (prev.temperature === preset.value) return prev;
        return { ...prev, temperature: preset.value };
      });
    }
  }, [settings.topic]);


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

  const handleUpdateGlossary = (newGlossary: GlossaryItem[]) => {
      updateSettings({ glossary: newGlossary });
  };

  const showToast = (msg: string, type: ToastType = 'error') => {
    setToast({ msg, type });
  };

  // --- FILE MANAGEMENT ---

  const handleFilesLoaded = (loadedFiles: { blocks: SubtitleBlock[], filename: string, type: 'SRT' | 'VTT', size: number }[]) => {
    const newFiles: SubtitleFile[] = loadedFiles.map(f => ({
      id: crypto.randomUUID(),
      name: f.filename,
      size: f.size,
      type: f.type,
      originalType: f.type,
      blocks: f.blocks,
      status: AppStatus.READY,
      progress: 0,
      processedCount: 0,
      netflixErrors: []
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (activeFileId === null && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }
    setToast(null);
  };

  const handleFileError = (msg: string) => {
    showToast(msg, 'error');
  };

  const resetProject = () => {
    // If multiple files, confirm before clearing? 
    // For now, reset everything.
    setFiles([]);
    setActiveFileId(null);
    setToast(null);
    setCompletionToast(false);
    isTranslatingRef.current = false;
  };

  const updateBlock = (fileId: string, blockId: number, text: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          blocks: f.blocks.map(b => b.id === blockId ? { ...b, translatedText: text } : b)
        };
      }
      return f;
    }));
  };

  const getActiveFile = () => {
    return files.find(f => f.id === activeFileId) || files[0];
  };

  const getActiveFileIndex = () => {
    return files.findIndex(f => f.id === activeFileId);
  }

  // --- BATCH ACTION LOGIC ---

  const handleFindReplace = (find: string, replace: string, scope: 'current' | 'all') => {
    if (!find) return;
    
    let totalOccurrences = 0;
    
    const targetFiles = scope === 'all' ? files : files.filter(f => f.id === activeFileId);

    const updatedFiles = files.map(f => {
       if (!targetFiles.find(tf => tf.id === f.id)) return f;

       let fileOccurrences = 0;
       const newBlocks = f.blocks.map(block => {
         if (block.translatedText && block.translatedText.includes(find)) {
            const newText = block.translatedText.replaceAll(find, replace);
            if (newText !== block.translatedText) {
                fileOccurrences++;
            }
            return { ...block, translatedText: newText };
         }
         return block;
       });
       totalOccurrences += fileOccurrences;
       return { ...f, blocks: newBlocks };
    });

    if (totalOccurrences > 0) {
      setFiles(updatedFiles);
      showToast(`${totalOccurrences} مورد در ${scope === 'all' ? 'همه فایل‌ها' : 'فایل جاری'} جایگزین شد.`, 'success');
    } else {
      showToast('موردی برای جایگزینی یافت نشد.', 'warning');
    }
  };

  const handleTimingAdjustment = (config: AdjustmentConfig, scope: 'current' | 'all') => {
    if (!activeFileId && files.length === 0) return;

    let updatedCount = 0;
    
    setFiles(prev => prev.map(f => {
        const shouldUpdate = scope === 'all' || f.id === activeFileId;
        
        if (shouldUpdate) {
            updatedCount++;
            return {
                ...f,
                blocks: adjustBlockTiming(f.blocks, config),
                netflixErrors: [] // Clear errors as timing changed
            };
        }
        return f;
    }));
    
    showToast(`تغییرات زمان‌بندی روی ${scope === 'all' ? 'همه فایل‌ها' : 'فایل جاری'} اعمال شد.`, 'success');
  };

  const handleNetflixCheck = () => {
    if (!activeFileId) return;
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;

    const errors = validateNetflixStandards(file.blocks);
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, netflixErrors: errors } : f));
    
    if (errors.length === 0) {
       showToast("هیچ خطایی مطابق استاندارد نتفلیکس یافت نشد.", 'success');
    }
  };

  const handleFixNetflixErrors = () => {
    if (!activeFileId) return;
    
    // Fix active file logic
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;

    const fixedBlocks = fixNetflixStandards(file.blocks);
    const remainingErrors = validateNetflixStandards(fixedBlocks);

    setFiles(prev => prev.map(f => f.id === file.id ? { 
        ...f, 
        blocks: fixedBlocks, 
        netflixErrors: remainingErrors 
    } : f));

    if (remainingErrors.length === 0) {
        showToast("تمامی خطاها با موفقیت برطرف شدند!", 'success');
    } else {
        showToast(`اصلاح خودکار انجام شد. ${remainingErrors.length} مورد باقی مانده است.`, 'warning');
    }
  };

  // --- EXPORT LOGIC ---

  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleConfirmDownload = (format: 'srt' | 'vtt', styles?: VttStyleConfig) => {
    const file = getActiveFile();
    if (!file) return;

    const outputName = file.name.replace(/\.(srt|vtt)$/i, `_fa.${format}`);
    const content = generateSubtitleFile(file.blocks, format, styles);
    downloadFile(outputName, content);
    setIsExportModalOpen(false);
  };

  const handleDownloadZip = async () => {
      const zip = new JSZip();
      
      files.forEach(f => {
         const format = settings.outputFormat;
         const outputName = f.name.replace(/\.(srt|vtt)$/i, `_fa.${format}`);
         const content = generateSubtitleFile(f.blocks, format); // Default styles for bulk
         zip.file(outputName, content);
      });

      const blob = await zip.generateAsync({type: "blob"});
      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = "subtitles_batch.zip";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  // --- TRANSLATION LOGIC ---

  const updateFileStatus = (id: string, updates: Partial<SubtitleFile>) => {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const processFile = async (fileId: string) => {
     const file = filesRef.current.find(f => f.id === fileId);
     if (!file) return;

     updateFileStatus(fileId, { status: AppStatus.TRANSLATING, progressMessage: 'در حال تقسیم‌بندی...' });
     const startTime = Date.now();

     const chunks = smartChunking(file.blocks, BATCH_SIZE);
     const totalChunks = chunks.length;

     // SMART RESUME: Calculate where to start to avoid re-processing or state flooding
     let startChunkIndex = 0;
     let completed = 0;

     // Scan for the first incomplete chunk
     for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        // Identify the "real" blocks belonging to this chunk
        const targetBlocks = chunk.blocks.slice(chunk.targetStartIndex, chunk.targetEndIndex);
        
        // Check if all blocks in this chunk are already translated
        const isChunkComplete = targetBlocks.every(b => !!b.translatedText && b.translatedText.trim() !== '');
        
        if (isChunkComplete) {
            completed += targetBlocks.length;
            startChunkIndex = i + 1;
        } else {
            // Found the first chunk that needs work, stop skipping
            break;
        }
     }
     
     // If resuming, update progress immediately to reflect current state without flooding
     if (startChunkIndex > 0) {
        const initialProgress = (completed / file.blocks.length) * 100;
        updateFileStatus(fileId, { progress: initialProgress, processedCount: completed });
     }

     // Callback to handle API Key Rotation Updates
     const onKeyRateLimit = (failedKey: string) => {
        showToast(`کلید API (...${failedKey.slice(-4)}) به محدودیت رسید. جایگزینی با کلید بعدی...`, 'warning');
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.map(k => k.key === failedKey ? { ...k, isRateLimited: true } : k)
        }));
     };

     for (let i = startChunkIndex; i < totalChunks; i++) {
        // Check cancellation
        if (!isTranslatingRef.current) {
            updateFileStatus(fileId, { status: AppStatus.CANCELLED, progressMessage: 'لغو شده' });
            return;
        }

        const chunk = chunks[i];
        updateFileStatus(fileId, { progressMessage: `پردازش بخش ${i + 1} از ${totalChunks}...` });

        const preContextBlocks = chunk.blocks.slice(0, chunk.targetStartIndex);
        const targetBlocks = chunk.blocks.slice(chunk.targetStartIndex, chunk.targetEndIndex);
        const postContextBlocks = chunk.blocks.slice(chunk.targetEndIndex);

        // TM Logic
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
            // Update UI if we found matches in this chunk
            if (cachedCount > 0) {
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f } : f));
            }
        }

        const effectiveTarget = targetBlocks.filter(b => !b.translatedText);
        
        if (effectiveTarget.length > 0) {
            const targetRequest: BatchRequest[] = effectiveTarget.map(b => ({ id: b.id, text: b.originalText }));
            const preContextReq: BatchRequest[] = preContextBlocks.map(b => ({ id: b.id, text: `${b.originalText} (Persian: ${b.translatedText || 'N/A'})` }));
            const postContextReq: BatchRequest[] = postContextBlocks.map(b => ({ id: b.id, text: b.originalText }));

            try {
                const results = await translateBatch(targetRequest, preContextReq, postContextReq, settings, onKeyRateLimit);

                // Update blocks in state
                setFiles(prev => prev.map(f => {
                    if (f.id === fileId) {
                        const newBlocks = [...f.blocks];
                        results.forEach(res => {
                            const formattedText = formatPersianSubtitle(res.translatedText);
                            const idx = newBlocks.findIndex(b => b.id === res.id);
                            if (idx !== -1) {
                                newBlocks[idx].translatedText = formattedText;
                                if (settings.enableTranslationMemory) {
                                    addToMemory(newBlocks[idx].originalText, formattedText);
                                }
                            }
                        });
                        return { ...f, blocks: newBlocks };
                    }
                    return f;
                }));

                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));

            } catch (err: any) {
                console.error("Batch processing error:", err);
                updateFileStatus(fileId, { status: AppStatus.ERROR, progressMessage: 'خطا در ترجمه' });
                throw err;
            }
        }

        completed += targetBlocks.length;
        const progress = (completed / file.blocks.length) * 100;
        updateFileStatus(fileId, { progress, processedCount: completed });
     }

     // Post-processing
     let finalBlocks = filesRef.current.find(f => f.id === fileId)?.blocks || [];
     
     if (settings.outputStandard === 'netflix') {
         updateFileStatus(fileId, { progressMessage: 'بهینه‌سازی Netflix...' });
         await new Promise(r => setTimeout(r, 800));
         finalBlocks = fixNetflixStandards(finalBlocks);
         const errors = validateNetflixStandards(finalBlocks);
         updateFileStatus(fileId, { blocks: finalBlocks, netflixErrors: errors });
     } else {
         // Even for normal mode, lets run validation just to show status
         const errors = validateNetflixStandards(finalBlocks);
         updateFileStatus(fileId, { netflixErrors: errors });
     }

     const duration = Date.now() - startTime;
     const seconds = Math.floor(duration / 1000);
     const minutes = Math.floor(seconds / 60);
     const durationStr = minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;

     updateFileStatus(fileId, { 
         status: AppStatus.COMPLETED, 
         progress: 100, 
         progressMessage: 'تکمیل شد',
         processingDuration: durationStr
     });
  };

  const startBatchTranslation = async () => {
    const hasAvailableKeys = settings.apiKeys.some(k => k.isValid && !k.isRateLimited);
    
    if (settings.apiKeys.length === 0) {
      showToast("هیچ کلید API تعریف نشده است.", 'error');
      setIsSettingsOpen(true);
      return;
    }
    
    if (!hasAvailableKeys) {
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.map(k => ({...k, isRateLimited: false}))
        }));
    }

    isTranslatingRef.current = true;
    setCompletionToast(false);

    // Filter pending files (Including PAUSED now to allow resuming)
    const pendingFiles = files.filter(f => 
        f.status === AppStatus.READY || 
        f.status === AppStatus.ERROR || 
        f.status === AppStatus.PAUSED
    );
    
    if (pendingFiles.length === 0) {
        showToast('همه فایل‌ها قبلاً ترجمه شده‌اند.', 'warning');
        return;
    }

    try {
        for (let i = 0; i < pendingFiles.length; i++) {
            if (!isTranslatingRef.current) break;
            
            const file = pendingFiles[i];
            
            // Switch tab to current file
            setActiveFileId(file.id);

            try {
                await processFile(file.id);
            } catch (e) {
                console.error(`Failed to process file ${file.name}`, e);
                // Continue to next file? Or stop? 
                // Let's continue but maybe delay more
            }

            // Cooldown between files if there are more remaining
            if (i < pendingFiles.length - 1 && isTranslatingRef.current) {
                const waitTime = DELAY_BETWEEN_FILES_MS;
                // Update next file status to waiting
                const nextFileId = pendingFiles[i+1].id;
                updateFileStatus(nextFileId, { progressMessage: `در انتظار نوبت (${Math.round(waitTime/1000)} ثانیه)...` });
                
                // Countdown visualization could be here, but simple delay for now
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    } catch (e) {
        console.error("Batch Loop Error", e);
    } finally {
        isTranslatingRef.current = false;
        setCompletionToast(true);
    }
  };

  const pauseTranslation = () => {
    isTranslatingRef.current = false;
    setFiles(prev => prev.map(f => f.status === AppStatus.TRANSLATING ? { ...f, status: AppStatus.PAUSED, progressMessage: 'توقف موقت' } : f));
  };

  const cancelTranslation = () => {
    isTranslatingRef.current = false;
    setFiles(prev => prev.map(f => 
        (f.status === AppStatus.TRANSLATING || f.status === AppStatus.PAUSED) 
        ? { ...f, status: AppStatus.CANCELLED, progressMessage: 'لغو شد' } 
        : f
    ));
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      
      <Sidebar 
        settings={settings} 
        updateSettings={updateSettings} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGlossary={() => setIsGlossaryModalOpen(true)}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        <Header />

        <main className="flex-1 px-4 md:px-8 py-8 w-full max-w-5xl mx-auto pb-24">
            
            {files.length === 0 ? (
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
                        onLoad={handleFilesLoaded} 
                        onError={handleFileError} 
                        status={AppStatus.IDLE} 
                        outputStandard={settings.outputStandard} 
                    />
                </div>
            ) : (
                <>
                    {/* File Tabs */}
                    <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar">
                        {files.map(file => (
                            <button
                                key={file.id}
                                onClick={() => setActiveFileId(file.id)}
                                className={`
                                    flex items-center gap-2 px-4 py-3 rounded-xl border transition-all min-w-[150px] max-w-[200px]
                                    ${activeFileId === file.id 
                                        ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-white shadow-[0_0_15px_rgba(0,240,255,0.1)]' 
                                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                                    }
                                `}
                            >
                                <div className={`w-2 h-2 rounded-full ${
                                    file.status === AppStatus.COMPLETED ? 'bg-green-500' :
                                    file.status === AppStatus.TRANSLATING ? 'bg-yellow-500 animate-pulse' :
                                    file.status === AppStatus.ERROR ? 'bg-red-500' :
                                    'bg-white/20'
                                }`}></div>
                                <span className="truncate text-sm font-medium direction-ltr">{file.name}</span>
                                {file.status === AppStatus.COMPLETED && <Check className="w-3 h-3 text-green-500 ml-auto" />}
                            </button>
                        ))}
                    </div>

                    <StatsCard 
                        activeFile={getActiveFile()}
                        activeFileIndex={getActiveFileIndex()}
                        totalFiles={files.length}
                        onStart={startBatchTranslation}
                        onPause={pauseTranslation}
                        onCancel={cancelTranslation}
                        onDownload={handleOpenExportModal} 
                        onDownloadZip={handleDownloadZip}
                        onNewProject={resetProject}
                        onOpenTimingTools={() => setIsTimingModalOpen(true)}
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
                        blocks={getActiveFile().blocks} 
                        onUpdateBlock={(id, text) => activeFileId && updateBlock(activeFileId, id, text)} 
                        validationErrors={getActiveFile().netflixErrors}
                        onFindReplace={handleFindReplace}
                        hasMultipleFiles={files.length > 1}
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
        hasMultipleFiles={files.length > 1}
      />

      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmDownload}
        defaultFormat={settings.outputFormat}
      />

      <GlossaryModal 
        isOpen={isGlossaryModalOpen}
        onClose={() => setIsGlossaryModalOpen(false)}
        glossary={settings.glossary}
        onUpdate={handleUpdateGlossary}
      />

       {files.some(f => f.status === AppStatus.TRANSLATING) && (
            <div className="fixed bottom-8 right-8 glass border border-[#00f0ff]/50 text-white px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10">
                <div className="relative">
                     <div className="absolute inset-0 bg-[#00f0ff] blur opacity-50 animate-pulse"></div>
                     <Loader2 className="w-6 h-6 animate-spin text-[#00f0ff] relative z-10" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold">
                        {getActiveFile().progressMessage || 'در حال پردازش...'}
                    </span>
                    <span className="text-xs text-white/50">
                        {activeFileId && getActiveFile()?.name}
                    </span>
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
                        <strong className="block text-sm font-bold text-green-200 mb-1">عملیات تکمیل شد</strong>
                        <p className="text-sm text-white/80 leading-relaxed">پردازش فایل‌ها با موفقیت به پایان رسید.</p>
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