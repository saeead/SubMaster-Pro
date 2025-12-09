import React, { useState } from 'react';
import { X, Copy, Languages, Sparkles, ArrowRight, Loader2, Trash2, CheckCircle } from 'lucide-react';
import { AppSettings } from '../types';
import { translateFreeText } from '../services/geminiService';
import { TONE_OPTIONS, TOPIC_OPTIONS } from '../constants';

interface TextTranslatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
}

export const TextTranslatorModal: React.FC<TextTranslatorModalProps> = ({ isOpen, onClose, settings }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    // Check keys
    if (settings.apiKeys.length === 0 || !settings.apiKeys.some(k => k.isValid && !k.isRateLimited)) {
        setError("لطفا ابتدا یک کلید API معتبر در تنظیمات وارد کنید.");
        return;
    }

    setIsTranslating(true);
    setError(null);
    setOutputText('');

    try {
        const result = await translateFreeText(inputText, settings);
        setOutputText(result);
    } catch (err: any) {
        setError(err.message || "خطا در برقراری ارتباط با هوش مصنوعی");
    } finally {
        setIsTranslating(false);
    }
  };

  const handleCopy = () => {
      if (!outputText) return;
      navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
      setInputText('');
      setOutputText('');
      setError(null);
  };

  const getQualityLabel = (temp: number = 0.7) => {
    if (temp < 0.4) return "دقیق (Precision)";
    if (temp < 0.7) return "متعادل (Balanced)";
    return "خلاقانه (Creative)";
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>
      
      {/* Increased width to max-w-6xl and fixed height to h-[90vh] for larger workspace */}
      <div className="relative w-full max-w-6xl glass rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0e27]/50">
          <div className="flex items-center gap-3">
             <div className="bg-[#00f0ff]/10 p-2 rounded-lg border border-[#00f0ff]/20">
                <Languages className="w-6 h-6 text-[#00f0ff]" />
             </div>
             <div>
                 <h2 className="text-xl font-bold text-white">ترجمه متن هوشمند</h2>
                 <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 mt-1">
                     <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]"></span>
                        لحن: {TONE_OPTIONS[settings.tone]}
                     </span>
                     <span className="text-white/20">|</span>
                     <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff00ea]"></span>
                        موضوع: {TOPIC_OPTIONS[settings.topic]}
                     </span>
                     <span className="text-white/20">|</span>
                     {/* Quality Indicator */}
                     <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                        کیفیت: {getQualityLabel(settings.temperature)}
                     </span>
                 </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
            
            {/* Input Section */}
            <div className="flex-1 flex flex-col gap-3 h-full">
                <div className="flex justify-between items-center text-xs text-white/50 px-1">
                    <span className="font-bold text-[#00f0ff]">متن ورودی (تشخیص خودکار)</span>
                    {inputText && (
                        <button onClick={handleClear} className="text-white/30 hover:text-red-400 transition-colors flex items-center gap-1">
                            <Trash2 className="w-3 h-3" /> پاک کردن
                        </button>
                    )}
                </div>
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="متن خود را اینجا وارد کنید..."
                    className="flex-1 w-full bg-[#0a0e27]/80 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-[#00f0ff] focus:outline-none resize-none leading-7 custom-scrollbar placeholder-white/20 dir-auto"
                />
            </div>

            {/* Middle Action (Desktop) */}
            <div className="hidden md:flex flex-col justify-center gap-4">
                 <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !inputText.trim()}
                    className="p-4 rounded-full bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none group"
                 >
                     {isTranslating ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform rtl:rotate-180" />}
                 </button>
            </div>

            {/* Output Section */}
            <div className="flex-1 flex flex-col gap-3 h-full">
                 <div className="flex justify-between items-center text-xs text-white/50 px-1">
                    <span className="font-bold text-[#ff00ea]">ترجمه فارسی</span>
                    {outputText && (
                        <button 
                            onClick={handleCopy} 
                            className={`flex items-center gap-1 transition-colors ${copied ? 'text-green-400' : 'text-white/30 hover:text-white'}`}
                        >
                            {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied ? 'کپی شد' : 'کپی متن'}
                        </button>
                    )}
                </div>
                <div className="relative flex-1 h-full">
                    <textarea 
                        readOnly
                        value={outputText}
                        placeholder={isTranslating ? "در حال ترجمه..." : "نتیجه ترجمه اینجا نمایش داده می‌شود"}
                        className={`
                            flex-1 w-full h-full bg-[#0a0e27] border rounded-xl p-4 text-sm text-white focus:outline-none resize-none leading-7 custom-scrollbar dir-rtl
                            ${isTranslating ? 'animate-pulse border-[#00f0ff]/30 text-white/50' : outputText ? 'border-[#ff00ea]/50' : 'border-white/5'}
                        `}
                    />
                    {!outputText && !isTranslating && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                            <Sparkles className="w-16 h-16 text-white" />
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Action Button */}
            <div className="md:hidden">
                 <button 
                    onClick={handleTranslate}
                    disabled={isTranslating || !inputText.trim()}
                    className="w-full py-3 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black font-bold rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                 >
                     {isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                     {isTranslating ? 'در حال ترجمه...' : 'ترجمه کن'}
                 </button>
            </div>
        </div>
        
        {/* Footer / Error */}
        {error && (
            <div className="px-6 pb-6 animate-in slide-in-from-bottom-2">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                    {error}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};