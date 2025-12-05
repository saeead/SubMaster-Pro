

import React, { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { parseSRT, parseVTT, optimizeSubtitleBlocks } from '../services/subtitleUtils';
import { SubtitleBlock, AppStatus } from '../types';
import { APP_CONFIG } from '../constants';

interface FileUploadProps {
  onLoad: (blocks: SubtitleBlock[], filename: string, type: 'SRT' | 'VTT', size: number) => void;
  status: AppStatus;
  onError: (msg: string) => void;
  outputStandard: 'normal' | 'netflix';
}

export const FileUpload: React.FC<FileUploadProps> = ({ onLoad, status, onError, outputStandard }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string[] => {
    const errors: string[] = [];
    
    // Size Check
    if (file.size > APP_CONFIG.maxFileSize) {
      errors.push(`حجم فایل بیش از ${APP_CONFIG.maxFileSize / 1024 / 1024}MB است`);
    }
    
    // Format Check
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !APP_CONFIG.supportedFormats.includes(ext)) {
      errors.push(`فرمت ${ext || 'ناشناخته'} پشتیبانی نمی‌شود`);
    }
    
    return errors;
  };

  const processFile = async (file: File) => {
    // 1. Validation
    const validationErrors = validateFile(file);
    if (validationErrors.length > 0) {
      onError(validationErrors.join(' | '));
      return;
    }

    try {
      const text = await file.text();
      let blocks: SubtitleBlock[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();
      const type = extension === 'srt' ? 'SRT' : 'VTT';

      // 2. Parsing
      if (type === 'SRT') {
        blocks = parseSRT(text);
      } else {
        blocks = parseVTT(text);
      }

      if (blocks.length === 0) {
        onError('فایل انتخاب شده خالی است یا ساختار معتبری ندارد.');
        return;
      }

      // 3. Optimization (Merge short lines, fix timing)
      // Pass the selected standard (Normal vs Netflix) to control merging behavior
      const optimizedBlocks = optimizeSubtitleBlocks(blocks, outputStandard);

      onLoad(optimizedBlocks, file.name, type, file.size);
    } catch (err) {
      onError('خطا در خواندن و پردازش فایل.');
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  if (status !== AppStatus.IDLE) return null;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-500">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          glass relative overflow-hidden rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 group
          ${isDragging 
            ? 'border-[#00f0ff] bg-[#00f0ff]/5' 
            : 'border-white/10 hover:border-[#00f0ff]/50 hover:bg-white/5'
          }
        `}
      >
        <input 
          type="file" 
          ref={inputRef} 
          onChange={handleChange} 
          className="hidden" 
          accept=".srt,.vtt"
        />
        
        {/* Glow Effect */}
        <div className={`absolute inset-0 bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/5 to-[#00f0ff]/0 transition-transform duration-1000 ${isDragging ? 'translate-x-0' : '-translate-x-full'}`}></div>

        <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
          <div className={`p-6 rounded-2xl transition-all duration-300 ${isDragging ? 'bg-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.4)]' : 'bg-[#0a0e27] border border-white/10 group-hover:border-[#00f0ff]/50 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.2)]'}`}>
            <Upload className={`w-10 h-10 ${isDragging ? 'text-[#0a0e27]' : 'text-[#00f0ff]'}`} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">فایل را بکشید و رها کنید</h3>
            <p className="text-white/50">یا برای انتخاب فایل کلیک کنید</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            <span className="uppercase">srt, vtt</span>
            <span>|</span>
            <span>Max 100MB</span>
            <span>|</span>
            <span className={`${outputStandard === 'netflix' ? 'text-[#E50914]' : 'text-[#00f0ff]'}`}>
                {outputStandard === 'netflix' ? 'Netflix Optimized' : 'Standard Optimized'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};