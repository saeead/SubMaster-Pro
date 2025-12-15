
import React, { useState } from 'react';
import { SubtitleBlock, NetflixError } from '../types';
import { Clock, AlertTriangle, Search, Replace, ArrowLeft, Layers, Undo, Redo } from 'lucide-react';

interface SubtitleEditorProps {
  blocks: SubtitleBlock[];
  onUpdateBlock: (id: number, text: string) => void;
  validationErrors?: NetflixError[];
  onFindReplace: (find: string, replace: string, scope: 'current' | 'all') => void;
  hasMultipleFiles: boolean;
  
  // Undo/Redo Props
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCommitChange: (id: number, oldText: string, newText: string) => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ 
  blocks, 
  onUpdateBlock, 
  validationErrors = [],
  onFindReplace,
  hasMultipleFiles,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCommitChange
}) => {
  const [findTerm, setFindTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [scope, setScope] = useState<'current' | 'all'>('current');
  
  const getErrorForBlock = (id: number) => {
    return validationErrors.find(e => e.blockId === id);
  };

  const handleReplaceClick = () => {
    if (findTerm.trim()) {
      onFindReplace(findTerm, replaceTerm, scope);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Find & Replace Tool Bar */}
      <div className="glass rounded-2xl p-6 border border-[#00f0ff]/20 animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#00f0ff]">
                <Replace className="w-5 h-5" />
                <h3 className="font-bold text-sm">تصحیح گروهی کلمات (Find & Replace)</h3>
            </div>
            
            <div className="flex items-center gap-3">
                {/* Separate Square Undo / Redo Buttons */}
                <div className="flex items-center gap-2 mr-4">
                    <button 
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={`
                            w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-200
                            ${canUndo 
                                ? 'bg-[#0a0e27] hover:bg-white/10 border-white/10 text-white hover:border-[#00f0ff]/50' 
                                : 'bg-black/20 border-transparent text-white/20 cursor-not-allowed'
                            }
                        `}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={onRedo}
                        disabled={!canRedo}
                        className={`
                            w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-200
                            ${canRedo 
                                ? 'bg-[#0a0e27] hover:bg-white/10 border-white/10 text-white hover:border-[#00f0ff]/50' 
                                : 'bg-black/20 border-transparent text-white/20 cursor-not-allowed'
                            }
                        `}
                        title="Redo (Ctrl+Shift+Z)"
                    >
                        <Redo className="w-4 h-4" />
                    </button>
                </div>

                {hasMultipleFiles && (
                    <div className="flex bg-[#0a0e27] rounded-lg p-1 border border-white/10">
                        <button 
                            onClick={() => setScope('current')}
                            className={`px-3 py-1 text-xs rounded transition-colors ${scope === 'current' ? 'bg-white/10 text-white' : 'text-white/50'}`}
                        >
                            فایل جاری
                        </button>
                        <button 
                            onClick={() => setScope('all')}
                            className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1 ${scope === 'all' ? 'bg-[#ff00ea]/20 text-[#ff00ea]' : 'text-white/50'}`}
                        >
                            <Layers className="w-3 h-3" />
                            همه فایل‌ها
                        </button>
                    </div>
                )}
            </div>
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
             {scope === 'all' ? 'جایگزینی در تمام فایل‌ها' : 'جایگزینی در فایل جاری'}
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
                        onFocus={(e) => {
                             // Capture original value on focus to detect changes for Undo stack
                             e.currentTarget.dataset.originalValue = block.translatedText || '';
                        }}
                        onBlur={(e) => {
                            const oldVal = e.currentTarget.dataset.originalValue;
                            const newVal = block.translatedText || '';
                            // Only commit if text actually changed from when user focused
                            if (oldVal !== undefined && oldVal !== newVal) {
                                onCommitChange(block.id, oldVal, newVal);
                            }
                        }}
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
