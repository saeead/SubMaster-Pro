
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { TextTranslatorModal } from './components/TextTranslatorModal';
import { Toast, ToastType } from './components/Toast';
import { SubtitleBlock, AppStatus, BatchRequest, AppSettings, AdjustmentConfig, StyleConfig, GlossaryItem, SubtitleFile, Modification } from './types';
import { generateSubtitleFile, downloadFile, smartChunking, formatPersianSubtitle, adjustBlockTiming, validateNetflixStandards, fixNetflixStandards, optimizePersianStructure } from './services/subtitleUtils';
import { translateBatch, diagnoseConnection } from './services/geminiService';
import { getFromMemory, addToMemory } from './services/translationMemory';
import ProjectStateManager, { ProjectState } from './services/projectStateManager'; // Import Manager
import { BATCH_SIZE, DELAY_BETWEEN_BATCHES_MS, DELAY_BETWEEN_FILES_MS, APP_CONFIG, TOPIC_TEMPERATURE_DEFAULTS } from './constants';
import { Loader2, Check, Wand2, History } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'submaster_pro_settings_v1';
const VERSION_STORAGE_KEY = 'submaster_pro_version';

const App: React.FC = () => {
  // --- STATE ---
  const [files, setFiles] = useState<SubtitleFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<string[]>([]); // Track saved sessions
  
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isGlossaryModalOpen, setIsGlossaryModalOpen] = useState(false);
  const [isTranslatorOpen, setIsTranslatorOpen] = useState(false);
  
  const [completionToast, setCompletionToast] = useState<boolean>(false);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    tone: 'conversational',
    topic: 'educational',
    temperature: 0.35, 
    outputFormat: 'vtt', 
    outputStandard: 'normal',
    model: 'standard', 
    customPrompt: '',
    apiKeys: [],
    enableTranslationMemory: true,
    glossary: [],
    theme: 'dark'
  });

  // Refs for processing
  const filesRef = useRef<SubtitleFile[]>([]);
  const isTranslatingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false); 
  const settingsRef = useRef<AppSettings>(settings);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Apply Theme
  useEffect(() => {
     const root = document.documentElement;
     if (settings.theme === 'light') {
         root.setAttribute('data-theme', 'light');
         root.classList.remove('dark');
     } else {
         root.removeAttribute('data-theme');
         root.classList.add('dark');
     }
  }, [settings.theme]);

  // Load settings & saved projects
  useEffect(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (!parsed.apiKeys) parsed.apiKeys = [];
        if (!parsed.outputStandard) parsed.outputStandard = 'normal';
        if (parsed.enableTranslationMemory === undefined) parsed.enableTranslationMemory = true;
        if (!parsed.glossary) parsed.glossary = [];
        if (parsed.temperature === undefined) parsed.temperature = 0.7; 
        if (!parsed.theme) parsed.theme = 'dark';
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load settings from local storage:', error);
      }
    }

    const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    if (savedVersion) {
        APP_CONFIG.version = savedVersion;
    }

    // Check for saved project states
    const projects = ProjectStateManager.listSavedProjects();
    setSavedProjects(projects);
  }, []);

  // --- SAVE LOGIC ---

  // Reusable function to save current state
  const saveCurrentProjectState = useCallback(() => {
    if (files.length > 0) {
      files.forEach(file => {
        // Map SubtitleFile to ProjectState
        const state: ProjectState = {
          id: file.id,
          name: file.name,
          type: file.type,
          status: file.status,
          progress: file.progress,
          allBlocks: file.blocks,
          
          // Required Schema mapping
          totalChunks: file.blocks.length,
          completedChunks: file.processedCount,
          remainingChunks: file.blocks.length - file.processedCount,
          processedBlocks: file.blocks.filter(b => !!b.translatedText).map(b => ({ original: b.originalText, translated: b.translatedText! })),
          fullInputContent: '', // Optional/Heavy
          apiKeyUsed: settings.apiKeys.find(k => k.isValid)?.key || 'unknown',
          
          // Map Modifications history
          modificationsMade: file.modificationsMade || [],
          
          lastProcessedIndex: file.blocks.findIndex(b => !!b.translatedText) - 1, // Approximation
          timestamp: new Date().toISOString()
        };
        
        ProjectStateManager.saveProjectState(file.id, state);
      });
      // Update saved list
      setSavedProjects(ProjectStateManager.listSavedProjects());
    }
  }, [files, settings.apiKeys]);

  // Auto-Save Logic (Debounced slightly by React batched updates, runs on file change)
  useEffect(() => {
    saveCurrentProjectState();
  }, [files, saveCurrentProjectState]); 

  // Manual Save Handler (To LocalStorage)
  const handleManualSave = () => {
    saveCurrentProjectState();
    showToast('پروژه با موفقیت در مرورگر ذخیره شد.', 'success');
  };

  // Export Project to JSON File (Portable)
  const handleExportProjectFile = () => {
    const file = getActiveFile();
    if (!file) return;

    // Create current state
    const state: ProjectState = {
        id: file.id,
        name: file.name,
        type: file.type,
        status: file.status,
        progress: file.progress,
        allBlocks: file.blocks,
        totalChunks: file.blocks.length,
        completedChunks: file.processedCount,
        remainingChunks: file.blocks.length - file.processedCount,
        processedBlocks: file.blocks.filter(b => !!b.translatedText).map(b => ({ original: b.originalText, translated: b.translatedText! })),
        fullInputContent: '', 
        apiKeyUsed: '', // SECURITY: Strip API Key
        modificationsMade: file.modificationsMade || [],
        lastProcessedIndex: file.blocks.findIndex(b => !!b.translatedText) - 1,
        timestamp: new Date().toISOString()
    };

    const jsonString = JSON.stringify(state, null, 2);
    const fileName = `${file.name.replace(/\.[^/.]+$/, "")}_backup.json`;
    downloadFile(fileName, jsonString);
    showToast('فایل پشتیبان پروژه دانلود شد.', 'success');
  };


  // Auto-adjust temperature when topic changes
  useEffect(() => {
    const preset = TOPIC_TEMPERATURE_DEFAULTS[settings.topic];
    if (preset) {
      setSettings(prev => {
        if (prev.temperature === preset.value) return prev;
        return { ...prev, temperature: preset.value };
      });
    }
  }, [settings.topic]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
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

  const handleFilesLoaded = (loadedFiles: { blocks: SubtitleBlock[], filename: string, type: 'SRT' | 'VTT' | 'ASS', size: number }[]) => {
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
      netflixErrors: [],
      // Initialize History
      modificationsMade: [],
      historyPointer: -1
    }));

    setFiles(prev => [...prev, ...newFiles]);
    if (activeFileId === null && newFiles.length > 0) {
      setActiveFileId(newFiles[0].id);
    }
    setToast(null);
  };

  // Handle Importing a Backup JSON file
  const handleProjectImport = (projectState: ProjectState) => {
    const restoredFile: SubtitleFile = {
        id: projectState.id || crypto.randomUUID(),
        name: projectState.name,
        size: 0, // Not strictly needed for resume
        type: projectState.type,
        originalType: projectState.type,
        blocks: projectState.allBlocks,
        status: projectState.status as AppStatus,
        progress: projectState.progress,
        processedCount: projectState.completedChunks,
        netflixErrors: [],
        // Restore History if available
        modificationsMade: projectState.modificationsMade || [],
        historyPointer: projectState.modificationsMade ? projectState.modificationsMade.length - 1 : -1
    };

    // If importing a completed file, ensure status is reflected
    if (restoredFile.progress >= 100) {
        restoredFile.status = AppStatus.COMPLETED;
    } else if (restoredFile.status === AppStatus.TRANSLATING) {
        restoredFile.status = AppStatus.PAUSED; // Don't auto-start translating
    }

    setFiles([restoredFile]); // Replace current workspace? Or append? Let's replace for a cleaner state restore.
    setActiveFileId(restoredFile.id);
    
    // Save to LS immediately so it sticks
    ProjectStateManager.saveProjectState(restoredFile.id, projectState);
    setSavedProjects(ProjectStateManager.listSavedProjects());

    showToast(`پروژه "${projectState.name}" با موفقیت بازیابی شد.`, 'success');
  };

  const handleResumeSession = () => {
    const loadedFiles: SubtitleFile[] = [];
    savedProjects.forEach(pid => {
        const pState = ProjectStateManager.loadProjectState(pid);
        if (pState) {
            loadedFiles.push({
                id: pState.id,
                name: pState.name,
                size: 0, // Metadata lost in simple schema, not critical
                type: pState.type,
                originalType: pState.type,
                blocks: pState.allBlocks,
                status: pState.status as AppStatus,
                progress: pState.progress,
                processedCount: pState.completedChunks,
                netflixErrors: [],
                modificationsMade: pState.modificationsMade || [],
                historyPointer: pState.modificationsMade ? pState.modificationsMade.length - 1 : -1
            });
        }
    });

    if (loadedFiles.length > 0) {
        setFiles(loadedFiles);
        setActiveFileId(loadedFiles[0].id);
        showToast(`نشست قبلی با ${loadedFiles.length} فایل بازیابی شد.`, 'success');
    }
  };

  const handleClearSavedSessions = () => {
      savedProjects.forEach(pid => ProjectStateManager.deleteProjectState(pid));
      setSavedProjects([]);
      showToast('تاریخچه ذخیره شده پاک شد.', 'success');
  };

  const handleFileError = (msg: string) => {
    showToast(msg, 'error');
  };

  const resetProject = () => {
    files.forEach(f => ProjectStateManager.deleteProjectState(f.id));
    
    setFiles([]);
    setActiveFileId(null);
    setToast(null);
    setCompletionToast(false);
    isTranslatingRef.current = false;
    isPausedRef.current = false;
    setSavedProjects(ProjectStateManager.listSavedProjects());
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

  // --- UNDO / REDO LOGIC ---

  const handleCommitChange = (blockId: number, oldText: string, newText: string) => {
      if (!activeFileId || oldText === newText) return;

      setFiles(prev => prev.map(f => {
          if (f.id === activeFileId) {
              const newHistory = f.modificationsMade.slice(0, f.historyPointer + 1);
              newHistory.push({
                  blockId,
                  oldState: { translatedText: oldText },
                  newState: { translatedText: newText },
                  timestamp: new Date().toISOString()
              });
              
              return {
                  ...f,
                  modificationsMade: newHistory,
                  historyPointer: newHistory.length - 1
              };
          }
          return f;
      }));
  };

  const handleUndo = useCallback(() => {
      if (!activeFileId) return;
      
      setFiles(prev => prev.map(f => {
          if (f.id === activeFileId && f.historyPointer > -1) {
              let currentPtr = f.historyPointer;
              let currentMod = f.modificationsMade[currentPtr];
              const groupId = currentMod.groupId;
              
              let newBlocks = [...f.blocks];

              // Logic loop to handle grouped actions (undo all actions with same GroupID)
              do {
                   currentMod = f.modificationsMade[currentPtr];
                   newBlocks = newBlocks.map(b => {
                        if (b.id === currentMod.blockId) {
                            return { ...b, ...currentMod.oldState };
                        }
                        return b;
                   });
                   currentPtr--;
              } while (
                  groupId && 
                  currentPtr > -1 && 
                  f.modificationsMade[currentPtr].groupId === groupId
              );

              return {
                  ...f,
                  blocks: newBlocks,
                  historyPointer: currentPtr
              };
          }
          return f;
      }));
      showToast('Undo performed', 'success');
  }, [activeFileId]);

  const handleRedo = useCallback(() => {
      if (!activeFileId) return;

      setFiles(prev => prev.map(f => {
          if (f.id === activeFileId && f.historyPointer < f.modificationsMade.length - 1) {
              let currentPtr = f.historyPointer + 1;
              let currentMod = f.modificationsMade[currentPtr];
              const groupId = currentMod.groupId;

              let newBlocks = [...f.blocks];

              // Logic loop to handle grouped actions (redo all actions with same GroupID)
              do {
                   currentMod = f.modificationsMade[currentPtr];
                   newBlocks = newBlocks.map(b => {
                        if (b.id === currentMod.blockId) {
                            return { ...b, ...currentMod.newState };
                        }
                        return b;
                   });
                   
                   // Check next item to see if it belongs to same group
                   if (groupId && currentPtr < f.modificationsMade.length - 1) {
                       if (f.modificationsMade[currentPtr + 1].groupId === groupId) {
                           currentPtr++;
                           continue;
                       }
                   }
                   break; // Stop if next item is not in group or end of list
              } while (true);

              return {
                  ...f,
                  blocks: newBlocks,
                  historyPointer: currentPtr
              };
          }
          return f;
      }));
       showToast('Redo performed', 'success');
  }, [activeFileId]);

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  handleRedo();
              } else {
                  handleUndo();
              }
          }
          // Support Ctrl+Y for Redo on Windows
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !e.shiftKey) {
              e.preventDefault();
              handleRedo();
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // --- BATCH ACTION LOGIC ---

  const handleFindReplace = (find: string, replace: string, scope: 'current' | 'all') => {
    if (!find) return;
    let totalOccurrences = 0;
    const targetFiles = scope === 'all' ? files : files.filter(f => f.id === activeFileId);
    
    // Batch ID for Undo/Redo Grouping
    const groupId = crypto.randomUUID();

    const updatedFiles = files.map(f => {
       if (!targetFiles.find(tf => tf.id === f.id)) return f;

       const newHistory = f.modificationsMade ? f.modificationsMade.slice(0, f.historyPointer + 1) : [];
       let fileOccurrences = 0;
       
       const newBlocks = f.blocks.map(block => {
         if (block.translatedText && block.translatedText.includes(find)) {
            const newText = block.translatedText.replaceAll(find, replace);
            if (newText !== block.translatedText) {
                fileOccurrences++;
                
                // Add to history
                newHistory.push({
                    blockId: block.id,
                    oldState: { translatedText: block.translatedText },
                    newState: { translatedText: newText },
                    groupId: groupId,
                    timestamp: new Date().toISOString()
                });

                return { ...block, translatedText: newText };
            }
         }
         return block;
       });

       totalOccurrences += fileOccurrences;
       return { 
           ...f, 
           blocks: newBlocks,
           modificationsMade: newHistory,
           historyPointer: newHistory.length - 1
       };
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
                netflixErrors: [] 
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

    const errors = validateNetflixStandards(file.blocks, settings.outputStandard);
    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, netflixErrors: errors } : f));
    
    if (errors.length === 0) {
       showToast("هیچ خطایی مطابق استاندارد انتخاب شده یافت نشد.", 'success');
    }
  };

  const handleFixNetflixErrors = () => {
    if (!activeFileId) return;
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;

    // Batch ID for Undo/Redo
    const groupId = crypto.randomUUID();
    const newHistory = file.modificationsMade ? file.modificationsMade.slice(0, file.historyPointer + 1) : [];

    // Calculate fixes based on current standard
    const fixedBlocks = fixNetflixStandards(file.blocks, settings.outputStandard);
    
    // Determine which blocks actually changed to log them in history
    let changesCount = 0;
    fixedBlocks.forEach((newBlock) => {
        const oldBlock = file.blocks.find(b => b.id === newBlock.id);
        if (oldBlock) {
             const textChanged = oldBlock.translatedText !== newBlock.translatedText;
             const timeChanged = oldBlock.endTime !== newBlock.endTime;

             if (textChanged || timeChanged) {
                 changesCount++;
                 newHistory.push({
                     blockId: newBlock.id,
                     oldState: { 
                         translatedText: oldBlock.translatedText, 
                         endTime: oldBlock.endTime 
                     },
                     newState: { 
                         translatedText: newBlock.translatedText, 
                         endTime: newBlock.endTime 
                     },
                     groupId: groupId,
                     timestamp: new Date().toISOString()
                 });
             }
        }
    });

    const remainingErrors = validateNetflixStandards(fixedBlocks, settings.outputStandard);

    setFiles(prev => prev.map(f => f.id === file.id ? { 
        ...f, 
        blocks: fixedBlocks, 
        netflixErrors: remainingErrors,
        modificationsMade: newHistory,
        historyPointer: newHistory.length - 1
    } : f));

    if (remainingErrors.length === 0) {
        showToast("تمامی خطاها با موفقیت برطرف شدند!", 'success');
    } else {
        showToast(`اصلاح خودکار انجام شد. ${remainingErrors.length} مورد باقی مانده است.`, 'warning');
    }
  };

  const handleOptimizePersianStructure = () => {
      if (!activeFileId) return;
      const file = files.find(f => f.id === activeFileId);
      if (!file) return;

      const optimizedBlocks = optimizePersianStructure(file.blocks);
      
      const newErrors = validateNetflixStandards(optimizedBlocks, settings.outputStandard);

      setFiles(prev => prev.map(f => f.id === activeFileId ? {
          ...f,
          blocks: optimizedBlocks,
          netflixErrors: newErrors
      } : f));

      showToast('ساختار زیرنویس بر اساس زبان فارسی بهینه‌سازی شد.', 'success');
  };

  // --- EXPORT LOGIC ---

  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const handleConfirmDownload = (format: 'srt' | 'vtt' | 'ass', styles?: StyleConfig) => {
    const file = getActiveFile();
    if (!file) return;

    const outputName = file.name.replace(/\.(srt|vtt|ass|ssa)$/i, `_fa.${format}`);
    const content = generateSubtitleFile(file.blocks, format, styles);
    downloadFile(outputName, content);
    setIsExportModalOpen(false);
  };

  const handleDownloadZip = async () => {
      const zip = new JSZip();
      
      files.forEach(f => {
         const format = settings.outputFormat;
         const outputName = f.name.replace(/\.(srt|vtt|ass|ssa)$/i, `_fa.${format}`);
         const content = generateSubtitleFile(f.blocks, format); 
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

     let startChunkIndex = 0;
     let completed = 0;

     for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const targetBlocks = chunk.blocks.slice(chunk.targetStartIndex, chunk.targetEndIndex);
        const isChunkComplete = targetBlocks.every(b => !!b.translatedText && b.translatedText.trim() !== '');
        if (isChunkComplete) {
            completed += targetBlocks.length;
            startChunkIndex = i + 1;
        } else {
            break;
        }
     }
     
     if (startChunkIndex > 0) {
        const initialProgress = (completed / file.blocks.length) * 100;
        updateFileStatus(fileId, { progress: initialProgress, processedCount: completed });
     }

     const onKeyRateLimit = (failedKey: string) => {
        showToast(`کلید API (...${failedKey.slice(-4)}) به محدودیت رسید. جایگزینی با کلید بعدی...`, 'warning');
        setSettings(prev => ({
            ...prev,
            apiKeys: prev.apiKeys.map(k => k.key === failedKey ? { ...k, isRateLimited: true } : k)
        }));
     };

     for (let i = startChunkIndex; i < totalChunks; i++) {
        // Critical: Check if stopped. If stopped via Pause, don't set to Cancelled.
        if (!isTranslatingRef.current) {
            if (isPausedRef.current) {
                // Stopped because of Pause
                updateFileStatus(fileId, { status: AppStatus.PAUSED, progressMessage: 'توقف موقت (ذخیره شد)' });
                return;
            } else {
                // Stopped because of Cancel
                updateFileStatus(fileId, { status: AppStatus.CANCELLED, progressMessage: 'لغو شده' });
                return;
            }
        }

        const chunk = chunks[i];
        updateFileStatus(fileId, { progressMessage: `پردازش بخش ${i + 1} از ${totalChunks}...` });

        const preContextBlocks = chunk.blocks.slice(0, chunk.targetStartIndex);
        const targetBlocks = chunk.blocks.slice(chunk.targetStartIndex, chunk.targetEndIndex);
        const postContextBlocks = chunk.blocks.slice(chunk.targetEndIndex);

        let cachedCount = 0;
        if (settingsRef.current.enableTranslationMemory) {
            targetBlocks.forEach(block => {
                if (!block.translatedText) {
                    const cached = getFromMemory(block.originalText);
                    if (cached) {
                        block.translatedText = cached;
                        cachedCount++;
                    }
                }
            });
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
                const results = await translateBatch(targetRequest, preContextReq, postContextReq, settingsRef.current, onKeyRateLimit);

                setFiles(prev => prev.map(f => {
                    if (f.id === fileId) {
                        const newBlocks = [...f.blocks];
                        results.forEach(res => {
                            const formattedText = formatPersianSubtitle(res.translatedText);
                            const idx = newBlocks.findIndex(b => b.id === res.id);
                            if (idx !== -1) {
                                newBlocks[idx].translatedText = formattedText;
                                if (settingsRef.current.enableTranslationMemory) {
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
                
                const errorMessage = (err.message || err.toString() || "").toLowerCase();
                
                // --- NEW CONNECTION HANDLING ---
                if (errorMessage.includes('fetch failed') || errorMessage.includes('location')) {
                    updateFileStatus(fileId, { 
                         status: AppStatus.PAUSED, 
                         progressMessage: 'خطای اتصال (توقف)' 
                    });
                    showToast(errorMessage, 'error'); 
                    isTranslatingRef.current = false;
                    return;
                }

                const isOverloaded = errorMessage.includes('overloaded') || 
                                     errorMessage.includes('503') || 
                                     errorMessage.includes('unavailable') ||
                                     errorMessage.includes('service unavailable');

                if (isOverloaded) {
                     updateFileStatus(fileId, { 
                         status: AppStatus.PAUSED, 
                         progressMessage: 'توقف خودکار (سرور گوگل شلوغ است)' 
                     });
                     showToast('سرور گوگل موقتاً پاسخگو نیست (503 Overloaded). پروژه متوقف شد تا دیتای شما حفظ شود. لطفاً دقایقی دیگر ادامه دهید.', 'warning');
                     isTranslatingRef.current = false; 
                     return;
                }

                if (!isTranslatingRef.current && isPausedRef.current) {
                     updateFileStatus(fileId, { status: AppStatus.PAUSED, progressMessage: 'توقف موقت (ذخیره شد)' });
                     return;
                }

                const isQuotaError = errorMessage.includes("429") || 
                                     errorMessage.includes("quota") || 
                                     errorMessage.includes("پایان اعتبار") || 
                                     errorMessage.includes("resource_exhausted") ||
                                     errorMessage.includes("too many requests");

                if (isQuotaError) {
                     updateFileStatus(fileId, { 
                         status: AppStatus.PAUSED, 
                         progressMessage: 'توقف: پایان اعتبار کلیدها' 
                     });
                     showToast('اعتبار تمام کلیدها به پایان رسید. لطفاً کلید جدید اضافه کنید و دکمه "ادامه ترجمه" را بزنید.', 'error');
                     isTranslatingRef.current = false; 
                     return; 
                }

                updateFileStatus(fileId, { status: AppStatus.ERROR, progressMessage: 'خطا در ترجمه' });
                throw err;
            }
        }

        completed += targetBlocks.length;
        const progress = (completed / file.blocks.length) * 100;
        updateFileStatus(fileId, { progress, processedCount: completed });
     }

     let finalBlocks = filesRef.current.find(f => f.id === fileId)?.blocks || [];
     
     if (settingsRef.current.outputStandard !== 'normal') {
         updateFileStatus(fileId, { progressMessage: 'بهینه‌سازی بر اساس استاندارد...' });
         await new Promise(r => setTimeout(r, 800));
         finalBlocks = fixNetflixStandards(finalBlocks, settingsRef.current.outputStandard);
         const errors = validateNetflixStandards(finalBlocks, settingsRef.current.outputStandard);
         updateFileStatus(fileId, { blocks: finalBlocks, netflixErrors: errors });
     } else {
         const errors = validateNetflixStandards(finalBlocks, settingsRef.current.outputStandard);
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

    const pendingFiles = files.filter(f => 
        f.status === AppStatus.READY || 
        f.status === AppStatus.ERROR || 
        f.status === AppStatus.PAUSED
    );
    
    if (pendingFiles.length === 0) {
        showToast('همه فایل‌ها قبلاً ترجمه شده‌اند.', 'warning');
        return;
    }

    const firstFileId = pendingFiles[0].id;
    updateFileStatus(firstFileId, {
        status: AppStatus.TRANSLATING, 
        progressMessage: 'در حال بررسی اتصال به سرور گوگل (DNS/VPN)...'
    });

    const testKey = settings.apiKeys.find(k => k.isValid)?.key;
    if (testKey) {
        const diagnosisError = await diagnoseConnection(testKey);
        if (diagnosisError) {
             updateFileStatus(firstFileId, { 
                status: AppStatus.PAUSED, 
                progressMessage: 'خطای اتصال' 
             });
             showToast(diagnosisError, 'error');
             return;
        }
    }

    isTranslatingRef.current = true;
    isPausedRef.current = false; 
    setCompletionToast(false);

    let stoppedEarly = false;

    try {
        for (let i = 0; i < pendingFiles.length; i++) {
            if (!isTranslatingRef.current) {
                stoppedEarly = true;
                break;
            }
            const file = pendingFiles[i];
            setActiveFileId(file.id);

            try {
                await processFile(file.id);
            } catch (e: any) {
                console.error(`Failed to process file ${file.name}`, e);
                if (!isTranslatingRef.current) {
                    stoppedEarly = true;
                    break;
                }
            }

            if (i < pendingFiles.length - 1 && isTranslatingRef.current) {
                const waitTime = DELAY_BETWEEN_FILES_MS;
                const nextFileId = pendingFiles[i+1].id;
                updateFileStatus(nextFileId, { progressMessage: `در انتظار نوبت (${Math.round(waitTime/1000)} ثانیه)...` });
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    } catch (e) {
        console.error("Batch Loop Error", e);
    } finally {
        isTranslatingRef.current = false;
        if (!stoppedEarly) {
            setCompletionToast(true); 
        }
    }
  };

  const pauseTranslation = () => {
    isTranslatingRef.current = false;
    isPausedRef.current = true; 
    
    setFiles(prev => prev.map(f => f.status === AppStatus.TRANSLATING ? { ...f, status: AppStatus.PAUSED, progressMessage: 'توقف موقت' } : f));
    
    saveCurrentProjectState();
    showToast('پروژه متوقف و ذخیره شد.', 'warning');
  };

  const cancelTranslation = () => {
    isTranslatingRef.current = false;
    isPausedRef.current = false; 
    setFiles(prev => prev.map(f => 
        (f.status === AppStatus.TRANSLATING || f.status === AppStatus.PAUSED) 
        ? { ...f, status: AppStatus.CANCELLED, progressMessage: 'لغو شد' } 
        : f
    ));
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background text-text transition-colors duration-300">
      
      <Sidebar 
        settings={settings} 
        updateSettings={updateSettings} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => { setIsSettingsOpen(true); setIsSidebarOpen(false); }}
        onOpenGlossary={() => { setIsGlossaryModalOpen(true); setIsSidebarOpen(false); }}
        onOpenTextTranslator={() => { setIsTranslatorOpen(true); setIsSidebarOpen(false); }}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden h-screen overflow-y-auto">
        <Header 
            theme={settings.theme} 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 px-4 md:px-8 py-8 w-full max-w-7xl mx-auto pb-24">
            
            {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                     <div className="text-center mb-4 space-y-4">
                        <h2 className="text-4xl md:text-5xl font-montserrat font-bold text-text leading-tight">
                            Translation <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Reimagined</span>
                        </h2>
                        <p className="text-text-muted text-lg max-w-xl mx-auto">
                             مترجم هوشمند با قابلیت تشخیص لحن و موضوع. فایل خود را آپلود کنید و از نتیجه حرفه‌ای لذت ببرید.
                        </p>
                    </div>
                    <FileUpload 
                        onLoad={handleFilesLoaded} 
                        onProjectLoad={handleProjectImport}
                        onError={handleFileError} 
                        status={AppStatus.IDLE} 
                        outputStandard={settings.outputStandard} 
                    />
                    {savedProjects.length > 0 && (
                        <div className="flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 mt-4">
                            <button onClick={handleResumeSession} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[#00f0ff]/50 transition-all text-sm text-text">
                                <History className="w-4 h-4 text-[#00f0ff]" />
                                <span>بازیابی نشست قبلی ({savedProjects.length} فایل ذخیره شده)</span>
                            </button>
                            <button onClick={handleClearSavedSessions} className="text-[10px] text-text-muted/50 hover:text-red-400 transition-colors">پاکسازی تاریخچه</button>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex overflow-x-auto gap-2 mb-6 pb-2 custom-scrollbar">
                        {files.map(file => (
                            <button key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all min-w-[150px] max-w-[200px] flex-shrink-0 ${activeFileId === file.id ? 'bg-primary/10 border-primary text-text shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-surface border-border text-text-muted hover:bg-surfaceHighlight'}`}>
                                <div className={`w-2 h-2 rounded-full ${file.status === AppStatus.COMPLETED ? 'bg-green-500' : file.status === AppStatus.TRANSLATING ? 'bg-yellow-500 animate-pulse' : file.status === AppStatus.ERROR ? 'bg-red-500' : file.status === AppStatus.PAUSED ? 'bg-orange-400' : 'bg-text/20'}`}></div>
                                <span className="truncate text-sm font-medium direction-ltr">{file.name}</span>
                                {file.status === AppStatus.COMPLETED && <Check className="w-3 h-3 text-green-500 ml-auto" />}
                            </button>
                        ))}
                    </div>
                    <StatsCard activeFile={getActiveFile()} activeFileIndex={getActiveFileIndex()} totalFiles={files.length} onStart={startBatchTranslation} onPause={pauseTranslation} onCancel={cancelTranslation} onDownload={handleOpenExportModal} onDownloadZip={handleDownloadZip} onNewProject={resetProject} onOpenTimingTools={() => setIsTimingModalOpen(true)} onFixErrors={handleFixNetflixErrors} onSave={handleManualSave} onExportBackup={handleExportProjectFile} onOptimizeStructure={handleOptimizePersianStructure} />
                    <div className="mb-6 glass p-6 rounded-2xl border border-border space-y-3">
                         <label className="text-sm font-bold text-white/70 flex items-center gap-2"><Wand2 className="w-4 h-4 text-[#ff00ea]" />پرامپت اختصاصی (Custom Prompt)</label>
                         <textarea value={settings.customPrompt} onChange={(e) => updateSettings({ customPrompt: e.target.value })} placeholder="دستورالعمل خاصی دارید؟ اینجا بنویسید..." className="w-full bg-[#0a0e27]/50 text-sm text-text placeholder-text-muted focus:outline-none resize-none h-24 rounded-xl p-4 border border-white/10 focus:border-[#ff00ea]/50 transition-all" />
                    </div>
                    <SubtitleEditor blocks={getActiveFile().blocks} onUpdateBlock={(id, text) => activeFileId && updateBlock(activeFileId, id, text)} validationErrors={getActiveFile().netflixErrors} onFindReplace={handleFindReplace} hasMultipleFiles={files.length > 1} onCommitChange={handleCommitChange} onUndo={handleUndo} onRedo={handleRedo} canUndo={!!getActiveFile()?.modificationsMade && getActiveFile().historyPointer > -1} canRedo={!!getActiveFile()?.modificationsMade && getActiveFile().historyPointer < getActiveFile().modificationsMade.length - 1} />
                </>
            )}
        </main>
        <footer className="w-full py-6 text-center text-text-muted text-xs border-t border-border mt-auto">
            <p className="font-montserrat">Designed and developed with ❤️ by Saeid Bagherian</p>
        </footer>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} updateSettings={updateSettings} />
      <TimingModal isOpen={isTimingModalOpen} onClose={() => setIsTimingModalOpen(false)} onApply={handleTimingAdjustment} onNetflixCheck={handleNetflixCheck} hasMultipleFiles={files.length > 1} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onConfirm={handleConfirmDownload} defaultFormat={settings.outputFormat} />
      <GlossaryModal isOpen={isGlossaryModalOpen} onClose={() => setIsGlossaryModalOpen(false)} glossary={settings.glossary} onUpdate={handleUpdateGlossary} />
      <TextTranslatorModal isOpen={isTranslatorOpen} onClose={() => setIsTranslatorOpen(false)} settings={settings} />
       {files.some(f => f.status === AppStatus.TRANSLATING) && (
            <div className="fixed bottom-8 right-8 glass border border-primary/50 text-text px-6 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10">
                <div className="relative">
                     <div className="absolute inset-0 bg-primary blur opacity-50 animate-pulse"></div>
                     <Loader2 className="w-6 h-6 animate-spin text-primary relative z-10" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold">{getActiveFile().progressMessage || 'در حال پردازش...'}</span>
                    <span className="text-xs text-text-muted">{activeFileId && getActiveFile()?.name}</span>
                </div>
            </div>
        )}
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {completionToast && !files.some(f => f.status === AppStatus.PAUSED || f.status === AppStatus.ERROR) && (
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-300 w-full max-w-md px-4">
                <div className="glass bg-background/95 border border-green-500/50 text-text p-4 rounded-2xl shadow-[0_0_30px_rgba(34,197,94,0.2)] flex items-start gap-4 backdrop-blur-xl">
                    <div className="p-2 bg-green-500/20 rounded-full flex-shrink-0 mt-0.5"><Loader2 className="w-5 h-5 text-green-500" /></div>
                    <div className="flex-1 min-w-0">
                        <strong className="block text-sm font-bold text-green-500 mb-1">عملیات تکمیل شد</strong>
                        <p className="text-sm text-text-muted leading-relaxed">پردازش فایل‌ها با موفقیت به پایان رسید.</p>
                    </div>
                    <button onClick={() => setCompletionToast(false)} className="p-1 hover:bg-surface rounded-full transition-colors -mr-1 text-text-muted hover:text-text"><Loader2 className="w-4 h-4 rotate-45" /></button>
                </div>
            </div>
        )}
    </div>
  );
};

export default App;
