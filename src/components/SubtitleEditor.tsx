import React from 'react';
import { SubtitleBlock } from '../types';
import { Clock } from 'lucide-react';

interface SubtitleEditorProps {
  blocks: SubtitleBlock[];
  onUpdateBlock: (id: number, text: string) => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ blocks, onUpdateBlock }) => {
  return (
    <div className="space-y-4 pb-20">
      {blocks.map((block) => (
        <div 
          key={block.id} 
          className={`
            group relative glass rounded-2xl p-6 transition-all duration-300
            ${block.translatedText 
                ? 'border-[#00f0ff]/30 hover:border-[#00f0ff]/50' 
                : 'border-white/5 hover:border-white/20'
            }
          `}
        >
          {/* Header: ID and Time */}
          <div className="flex justify-between items-center mb-4 text-xs font-mono">
             <div className="flex items-center gap-3">
                <span className="text-[#00f0ff] font-bold">#{block.index}</span>
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
                 <label className="absolute -top-3 left-3 px-2 bg-[#0a0e27] text-[10px] text-[#00f0ff] uppercase tracking-wider rounded border border-[#00f0ff]/20">Persian</label>
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
      ))}
    </div>
  );
};
