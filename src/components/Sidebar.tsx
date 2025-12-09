import React from 'react';
import { Settings, Check, FileText, BookOpen, MessageSquareText } from 'lucide-react';
import { AppSettings, ToneType, TopicType } from '../types';
import { TONE_OPTIONS, TOPIC_OPTIONS } from '../constants';
import { TemperatureControl } from './TemperatureControl';

interface SidebarProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenGlossary: () => void;
  onOpenTextTranslator: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ settings, updateSettings, onOpenSettings, onOpenGlossary, onOpenTextTranslator }) => {
  return (
    <aside className="w-full md:w-72 glass flex flex-col h-auto md:h-screen md:sticky md:top-0 p-6 gap-6 border-l border-white/10 z-20 overflow-y-auto custom-scrollbar">
      
      {/* Tone Selection */}
      <div className="space-y-2">
        <label className="text-xs text-[#00f0ff] font-bold tracking-wide uppercase">لحن ترجمه</label>
        <div className="relative">
          <select 
            value={settings.tone}
            onChange={(e) => updateSettings({ tone: e.target.value as ToneType })}
            className="w-full bg-[#0a0e27]/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#00f0ff] focus:outline-none appearance-none cursor-pointer transition-colors hover:bg-white/5"
          >
            {Object.entries(TONE_OPTIONS).map(([key, label]) => (
              <option key={key} value={key} className="bg-[#0a0e27]">{label}</option>
            ))}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Topic Selection */}
      <div className="space-y-2">
        <label className="text-xs text-[#ff00ea] font-bold tracking-wide uppercase">موضوع محتوا</label>
        <div className="relative">
          <select 
            value={settings.topic}
            onChange={(e) => updateSettings({ topic: e.target.value as TopicType })}
            className="w-full bg-[#0a0e27]/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-[#ff00ea] focus:outline-none appearance-none cursor-pointer transition-colors hover:bg-white/5"
          >
            {Object.entries(TOPIC_OPTIONS).map(([key, label]) => (
              <option key={key} value={key} className="bg-[#0a0e27]">{label}</option>
            ))}
          </select>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Custom Glossary Button (Educational Only) */}
      {settings.topic === 'educational' && (
         <div className="animate-in fade-in slide-in-from-right-4">
             <button 
                onClick={onOpenGlossary}
                className="w-full py-2.5 px-4 rounded-xl border border-[#ff00ea]/30 bg-[#ff00ea]/10 hover:bg-[#ff00ea]/20 text-white font-medium flex items-center justify-between group transition-all"
             >
                <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#ff00ea]" />
                    <span className="text-xs">واژه‌نامه اختصاصی</span>
                </div>
                {settings.glossary && settings.glossary.length > 0 && (
                    <span className="bg-[#ff00ea] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {settings.glossary.length}
                    </span>
                )}
             </button>
         </div>
      )}

      {/* Output Format */}
      <div className="space-y-2">
        <label className="text-xs text-white/50 font-bold tracking-wide uppercase">فرمت خروجی</label>
        <div className="flex bg-[#0a0e27]/50 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => updateSettings({ outputFormat: 'vtt' })}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.outputFormat === 'vtt' ? 'bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-white/50 hover:text-white'}`}
          >
            VTT
          </button>
          <button 
            onClick={() => updateSettings({ outputFormat: 'srt' })}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.outputFormat === 'srt' ? 'bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-white/50 hover:text-white'}`}
          >
            SRT
          </button>
        </div>
      </div>

      {/* Output Standard */}
      <div className="space-y-2">
        <label className="text-xs text-white/50 font-bold tracking-wide uppercase">استاندارد خروجی</label>
        <div className="flex bg-[#0a0e27]/50 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => updateSettings({ outputStandard: 'normal' })}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.outputStandard === 'normal' ? 'bg-white/10 text-white shadow' : 'text-white/50 hover:text-white'}`}
          >
            Normal
          </button>
          <button 
            onClick={() => updateSettings({ outputStandard: 'netflix' })}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.outputStandard === 'netflix' ? 'bg-[#E50914] text-white shadow-[0_0_10px_rgba(229,9,20,0.4)]' : 'text-white/50 hover:text-white'}`}
          >
            Netflix
          </button>
        </div>
      </div>

      {/* Temperature Control */}
      <div className="space-y-2">
         <TemperatureControl 
            temperature={settings.temperature} 
            topic={settings.topic} 
            onChange={(val) => updateSettings({ temperature: val })} 
         />
      </div>

      <div className="flex-1"></div>

      {/* Text Translator Button */}
      <button 
        onClick={onOpenTextTranslator}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#00f0ff]/10 to-[#00f0ff]/5 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20 transition-all group shadow-[0_0_10px_rgba(0,240,255,0.1)] mt-4"
      >
        <MessageSquareText className="w-5 h-5" />
        <span className="text-sm font-bold">ترجمه متن</span>
      </button>

      {/* Settings Button */}
      <button 
        onClick={onOpenSettings}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-white/80 hover:text-white hover:border-[#ff00ea]/50 group mt-3"
      >
        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
        <span className="text-sm">تنظیمات پیشرفته</span>
      </button>

    </aside>
  );
};