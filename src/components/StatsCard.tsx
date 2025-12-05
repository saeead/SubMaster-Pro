

import React from 'react';
import { SubtitleBlock, AppStatus, NetflixError } from '../types';
import { Play, Pause, Download, FileText, Clock, Hash, Timer, HardDrive, Trash2, XCircle, RefreshCw, Settings2, Wand2 } from 'lucide-react';

interface StatsCardProps {
  status: AppStatus;
  blocks: SubtitleBlock[];
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onDownload: () => void;
  onNewProject: () => void;
  onOpenTimingTools: () => void;
  currentFileName: string;
  fileSize?: number;
  progressMessage?: string;
  processingDuration?: string | null;
  validationErrors?: NetflixError[];
  onFixErrors?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  status, 
  blocks, 
  onStart, 
  onPause, 
  onCancel,
  onDownload,
  onNewProject,
  onOpenTimingTools,
  currentFileName,
  fileSize,
  progressMessage,
  processingDuration,
  validationErrors = [],
  onFixErrors
}) => {
  const total = blocks.length;
  const translatedCount = blocks.filter(b => b.translatedText).length;
  const percentage = Math.round((translatedCount / total) * 100) || 0;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isProcessing = status === AppStatus.TRANSLATING;
  const isPaused = status === AppStatus.PAUSED;
  const isCompleted = status === AppStatus.COMPLETED;
  const isCancelled = status === AppStatus.CANCELLED;
  const isReady = status === AppStatus.READY;
  const isError = status === AppStatus.ERROR;
  const hasErrors = validationErrors.length > 0;

  // Tools should be available if we have blocks loaded, regardless of translation status (mostly)
  const showTools = blocks.length > 0 && !isProcessing;

  return (
    <div className="glass rounded-3xl p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden group">
      
      {/* File Info Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-[#00f0ff]" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white truncate dir-ltr text-right max-w-md" title={currentFileName}>
                    {currentFileName}
                    </h3>
                    
                    <div className="flex items-center gap-2 md:mr-4">
                        {/* Timing Tools Button */}
                        {showTools && (
                            <button 
                                onClick={onOpenTimingTools}
                                className="p-2 rounded-lg hover:bg-[#00f0ff]/10 text-[#00f0ff]/70 hover:text-[#00f0ff] transition-colors"
                                title="ابزارهای زمان‌بندی و استاندارد نتفلیکس"
                            >
                                <Settings2 className="w-5 h-5" />
                            </button>
                        )}

                        {/* Delete/Remove File Icon */}
                        {(isReady || isCancelled || isCompleted || isError) && (
                            <button 
                                onClick={onNewProject}
                                className="p-2 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
                                title="حذف فایل / پروژه جدید"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-white/50">
                    <span className="flex items-center gap-1"><Hash className="w-3 h-3"/> {total} خط</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {blocks[blocks.length-1]?.endTime}</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3"/> {formatFileSize(fileSize)}</span>
                    {processingDuration && (
                        <span className="flex items-center gap-1 text-[#00f0ff] animate-in fade-in"><Timer className="w-3 h-3"/> زمان پردازش: {processingDuration}</span>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Progress & Controls */}
      <div className="space-y-6">
         {/* Progress Bar Container */}
        <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
                <div className="text-right">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full border 
                        ${isCompleted ? 'text-green-400 bg-green-400/10 border-green-400/20' : 
                          isCancelled ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                          'text-[#00f0ff] bg-[#00f0ff]/10 border-[#00f0ff]/20'}`}>
                        {isProcessing ? (progressMessage || 'در حال ترجمه...') : 
                         isCompleted ? 'ترجمه تکمیل شد' : 
                         isCancelled ? 'پروژه لغو شد' :
                         isPaused ? 'توقف موقت' :
                         status === AppStatus.ERROR ? 'خطا در پردازش' :
                         'آماده پردازش'}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-sm font-bold text-white">{percentage}%</span>
                </div>
            </div>
            
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-[#0a0e27] border border-white/10 relative">
                <div 
                    style={{ width: `${percentage}%` }} 
                    className={`
                        shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500
                        ${isCompleted ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 
                          isCancelled ? 'bg-red-500/50 grayscale' :
                          'bg-gradient-to-r from-[#00f0ff] to-[#ff00ea]'}
                        ${isProcessing ? 'animate-pulse-neon' : ''}
                    `}
                >
                     {isProcessing && (
                         <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                     )}
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row items-center gap-4">
             {/* Netflix Fix Button - Prominent when errors exist */}
             {hasErrors && onFixErrors && (
                 <button 
                    onClick={onFixErrors}
                    className="w-full flex-1 bg-[#E50914] hover:bg-[#b20710] text-white font-bold py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(229,9,20,0.4)] transition-all flex items-center justify-center gap-2 animate-in slide-in-from-top-2"
                 >
                     <Wand2 className="w-5 h-5" />
                     اصلاح خودکار مشکلات ({validationErrors.length})
                 </button>
             )}

             {/* Start / Resume */}
             {(isReady || isPaused || isError) && !hasErrors && (
                 <button 
                    onClick={onStart}
                    className="w-full flex-1 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black font-bold py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                 >
                    <Play className="w-5 h-5 fill-current" />
                    {isPaused ? 'ادامه ترجمه' : 'شروع ترجمه'}
                 </button>
             )}

             {/* Pause */}
             {isProcessing && (
                <button 
                    onClick={onPause}
                    className="w-full flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                 >
                    <Pause className="w-5 h-5 fill-current" />
                    توقف
                 </button>
             )}

             {/* Cancel */}
             {(isProcessing || isPaused) && (
                 <button 
                    onClick={onCancel}
                    className="w-full flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-bold py-3 px-6 rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2"
                 >
                    <XCircle className="w-5 h-5" />
                    لغو پروژه
                 </button>
             )}

             {/* Download Output - Only visible when COMPLETED */}
             {isCompleted && !hasErrors && (
                 <button 
                    onClick={onDownload}
                    className="w-full flex-1 bg-[#ff00ea]/10 text-[#ff00ea] border border-[#ff00ea] hover:bg-[#ff00ea]/20 shadow-[0_0_15px_rgba(255,0,234,0.2)] font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 animate-in zoom-in"
                  >
                    <Download className="w-5 h-5" />
                    دانلود خروجی
                  </button>
             )}

             {/* New Project / Replace File - Visible when Finished or Cancelled */}
             {(isCompleted || isCancelled) && (
                 <button 
                    onClick={onNewProject}
                    className="w-full flex-1 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    پروژه جدید
                  </button>
             )}
        </div>
      </div>
    </div>
  );
};