import React from 'react';
import { SubtitleBlock, AppStatus } from '../types';
import { Play, Pause, Download, FileText, Clock, Hash, Timer, HardDrive } from 'lucide-react';

interface StatsCardProps {
  status: AppStatus;
  blocks: SubtitleBlock[];
  onStart: () => void;
  onPause: () => void;
  onDownload: () => void;
  onNewProject: () => void;
  currentFileName: string;
  fileSize?: number;
  progressMessage?: string;
  processingDuration?: string | null;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  status, 
  blocks, 
  onStart, 
  onPause, 
  onDownload,
  onNewProject,
  currentFileName,
  fileSize,
  progressMessage,
  processingDuration
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

  return (
    <div className="glass rounded-3xl p-8 mb-8 animate-in fade-in slide-in-from-bottom-4">
      {/* File Info Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-white/5 pb-8">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#00f0ff]" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-white truncate dir-ltr text-right max-w-md">
                {currentFileName}
                </h3>
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

        <div className="flex items-center gap-3">
             {status === AppStatus.COMPLETED && (
                 <button 
                    onClick={onNewProject}
                    className="btn-secondary px-6 py-3 rounded-xl border border-white/10 hover:bg-white/5 text-white/70 transition-colors"
                >
                    پروژه جدید
                </button>
             )}
        </div>
      </div>

      {/* Progress & Controls */}
      <div className="space-y-6">
         {/* Progress Bar Container */}
        <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
                <div className="text-right">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full border ${status === AppStatus.COMPLETED ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-[#00f0ff] bg-[#00f0ff]/10 border-[#00f0ff]/20'}`}>
                        {status === AppStatus.TRANSLATING ? (progressMessage || 'در حال ترجمه...') : status === AppStatus.COMPLETED ? 'ترجمه تکمیل شد' : 'آماده پردازش'}
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
                        ${status === AppStatus.COMPLETED ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]' : 'bg-gradient-to-r from-[#00f0ff] to-[#ff00ea]'}
                        ${status === AppStatus.TRANSLATING ? 'animate-pulse-neon' : ''}
                    `}
                >
                     {status === AppStatus.TRANSLATING && (
                         <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                     )}
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
             {status === AppStatus.READY || status === AppStatus.PAUSED || status === AppStatus.ERROR ? (
                 <button 
                    onClick={onStart}
                    className="flex-1 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black font-bold py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                 >
                    <Play className="w-5 h-5 fill-current" />
                    {status === AppStatus.PAUSED ? 'ادامه ترجمه' : 'شروع ترجمه'}
                 </button>
             ) : status === AppStatus.TRANSLATING ? (
                <button 
                    onClick={onPause}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
                 >
                    <Pause className="w-5 h-5 fill-current" />
                    توقف
                 </button>
             ) : null}

             <button 
                onClick={onDownload}
                disabled={translatedCount === 0}
                className={`
                    flex-1 font-bold py-3 px-6 rounded-xl border transition-all flex items-center justify-center gap-2
                    ${translatedCount > 0 
                        ? 'bg-[#ff00ea]/10 text-[#ff00ea] border-[#ff00ea] hover:bg-[#ff00ea]/20 shadow-[0_0_15px_rgba(255,0,234,0.2)]' 
                        : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                    }
                `}
              >
                <Download className="w-5 h-5" />
                دانلود خروجی
              </button>
        </div>
      </div>
    </div>
  );
};