
import React from 'react';
import { Settings, BookOpen, MessageSquareText, ShieldCheck, X } from 'lucide-react';
import { AppSettings, ToneType, TopicType } from '../types';
import { TONE_OPTIONS, TOPIC_OPTIONS } from '../constants';
import { TemperatureControl } from './TemperatureControl';

interface SidebarProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenGlossary: () => void;
  onOpenTextTranslator: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  settings, 
  updateSettings, 
  isOpen,
  onClose,
  onOpenSettings, 
  onOpenGlossary, 
  onOpenTextTranslator 
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer - Widened to w-80 */}
      <aside 
        className={`
          fixed inset-y-0 right-0 z-40 w-80 bg-[#0a0e27] md:bg-transparent glass md:glass-none 
          flex flex-col h-full border-l border-white/10 overflow-y-auto custom-scrollbar 
          transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen p-6 gap-6
          ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between md:hidden mb-2">
            <h3 className="text-lg font-bold text-white">منوی تنظیمات</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
            </button>
        </div>
      
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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

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
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {settings.topic === 'educational' && (
           <div className="animate-in fade-in">
               <button onClick={onOpenGlossary} className="w-full py-3 px-4 rounded-xl border border-[#ff00ea]/30 bg-[#ff00ea]/10 hover:bg-[#ff00ea]/20 text-white font-medium flex items-center justify-between transition-all">
                  <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#ff00ea]" /><span className="text-sm">واژه‌نامه اختصاصی</span></div>
                  {settings.glossary.length > 0 && <span className="bg-[#ff00ea] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{settings.glossary.length}</span>}
               </button>
           </div>
        )}

        <div className="space-y-3 bg-[#0a0e27]/40 p-3 rounded-xl border border-white/5">
          <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-4 h-4 text-white/70" /><label className="text-xs text-white/70 font-bold uppercase">استاندارد خروجی</label></div>
          <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateSettings({ outputStandard: 'normal' })} className={`relative p-3 rounded-lg border text-xs font-bold transition-all ${settings.outputStandard === 'normal' ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-white' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}>Normal</button>
              <button onClick={() => updateSettings({ outputStandard: 'netflix' })} className={`relative p-3 rounded-lg border text-xs font-bold transition-all ${settings.outputStandard === 'netflix' ? 'bg-[#E50914]/10 border-[#E50914] text-white' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}>Netflix</button>
          </div>
        </div>

        <TemperatureControl temperature={settings.temperature} topic={settings.topic} onChange={(val) => updateSettings({ temperature: val })} />

        <div className="flex-1"></div>

        <button onClick={onOpenTextTranslator} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-[#00f0ff]/10 to-[#00f0ff]/5 border border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/20 transition-all font-bold shadow-[0_0_10px_rgba(0,240,255,0.1)]">
          <MessageSquareText className="w-5 h-5" />ترجمه متن
        </button>

        <button onClick={onOpenSettings} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-white/80 hover:text-white hover:border-[#ff00ea]/50 group">
          <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />تنظیمات پیشرفته
        </button>
      </aside>
    </>
  );
};
