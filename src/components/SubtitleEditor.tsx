
import React, { useState } from 'react';
import { SubtitleBlock, NetflixError } from '../types';
import { Clock, AlertTriangle, Search, Replace, ArrowLeft } from 'lucide-react';

interface SubtitleEditorProps {
  blocks: SubtitleBlock[];
  onUpdateBlock: (id: number, text: string) => void;
  validationErrors?: NetflixError[];
  onFindReplace: (find: string, replace: string) => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ 
  blocks, 
  onUpdateBlock, 
  validationErrors = [],
  onFindReplace
}) => {
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  
  const getErrorForBlock = (id: number) => {
    return validationErrors.find(e => e.blockId === id);
  };

  const handleReplaceClick = () => {
    if (findTerm.trim()) {
      onFindReplace(findTerm, replaceTerm);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Find & Replace Tool Bar */}
      <div className="glass rounded-2xl p-6 border border-[#00f0ff]/20 animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center gap-2 mb-4 text-[#00f0ff]">
           <Replace className="w-5 h-5" />
           <h3 className="font-bold text-sm">تصحیح گروهی کلمات (Find & Replace)</h3>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
             <label className="text-xs text-white/50 pr-1">کلمه اشتباه (موجود در متن)</label>
             <div className="relative">
                <input 
                  value={findTerm}
                  onChange={(e) => setFindTerm(e.target.value)}
                  placeholder="مثلاً: گالکسی"
                  className="w-full bg-[#0a0e27] border border-white/10 rounded-xl py-3 px-4 pl-10 text-sm text-white focus:border-[#00f0ff] focus:outline-none transition-colors"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
             </div>
          </div>

          <div className="hidden md:flex pb-3 text-white/20">
             <ArrowLeft className="w-6 h-6" />
          </div>

          <div className="flex-1 w-full space-y-2">
             <label className="text-xs text-white/50 pr-1">کلمه صحیح (جایگزین شود)</label>
             <input 
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                placeholder="مثلاً: کهکشان"
                className="w-full bg-[#0a0e27] border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-[#00f0ff] focus:outline-none transition-colors"
             />
          </div>

          <button 
            onClick={handleReplaceClick}
            disabled={!findTerm.trim()}
            className="w-full md:w-auto bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/20 font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
          >
             <Replace className="w-4 h-4" />
             جایگزینی در کل فایل
          </button>
        </div>
      </div>

      {/* Blocks List */}
      <div className="space-y-4">
        {blocks.map((block) => {
          const error = getErrorForBlock(block.id);
          const hasError = !!error;
          
          return (
            <div 
              key={block.id} 
              className={`
                group relative glass rounded-2xl p-6 transition-all duration-300
                ${hasError 
                  ? 'border-[#E50914] bg-[#E50914]/5' 
                  : block.translatedText 
                      ? 'border-[#00f0ff]/30 hover:border-[#00f0ff]/50' 
                      : 'border-white/5 hover:border-white/20'
                }
              `}
            >
              {/* Error Message */}
              {hasError && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#E50914] text-white text-[10px] py-1 px-3 rounded-full flex items-center gap-1 shadow-lg z-10 whitespace-nowrap">
                    <AlertTriangle className="w-3 h-3" />
                    {error.message}
                </div>
              )}

              {/* Header: ID and Time */}
              <div className="flex justify-between items-center mb-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                    <span className={`${hasError ? 'text-[#E50914]' : 'text-[#00f0ff]'} font-bold`}>#{block.index}</span>
                    <div className="flex items-center gap-2 bg-[#0a0e27] px-3 py-1.5 rounded-lg border border-white/10 text-white/50">
                        <Clock className="w-3 h-3" />
                        <span>{block.startTime}</span>
                        <span className="text-white/20">➜</span>
                        <span>{block.endTime}</span>
                    </div>
                </div>
              </div>
    
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original Text */}
                <div className="relative group/input">
                    <label className="absolute -top-3 right-3 px-2 bg-[#0a0e27] text-[10px] text-white/40 uppercase tracking-wider rounded border border-white/10">Original</label>
                    <div 
                        className="w-full p-4 bg-[#0a0e27]/50 rounded-xl text-white/80 text-sm leading-7 dir-ltr text-left border border-white/5 min-h-[100px]"
                    >
                        {block.originalText}
                    </div>
                </div>
    
                {/* Translated Text */}
                <div className="relative group/input">
                    <label className={`absolute -top-3 left-3 px-2 bg-[#0a0e27] text-[10px] uppercase tracking-wider rounded border ${hasError ? 'text-[#E50914] border-[#E50914]/50' : 'text-[#00f0ff] border-[#00f0ff]/20'}`}>Persian</label>
                    <textarea
                        value={block.translatedText || ''}
                        onChange={(e) => onUpdateBlock(block.id, e.target.value)}
                        placeholder="در انتظار ترجمه..."
                        className={`
                            w-full p-4 bg-[#0a0e27] rounded-xl text-sm leading-7 dir-rtl text-right resize-y min-h-[100px] focus:outline-none border transition-all
                            ${block.translatedText 
                                ? 'text-white border-white/10 focus:border-[#00f0ff]/50' 
                                : 'text-white/30 border-white/5 focus:border-white/20 italic'
                            }
                        `}
                        dir="rtl"
                    />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
