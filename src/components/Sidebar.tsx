
import React from 'react';
import { Ban, Settings, BookOpen, MessageSquareText, ShieldCheck, X, Languages } from 'lucide-react';
import { AppSettings, ToneType, TopicType, OutputStandard, TargetLanguage } from '../types';
import { TONE_OPTIONS, TOPIC_OPTIONS, TARGET_LANGUAGES } from '../constants';
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


        <div className="space-y-3 rounded-xl border border-[#00f0ff]/15 bg-[#00f0ff]/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="do-not-translate-terms" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#00f0ff]">
              <Ban className="h-4 w-4" />
              استثناعات ترجمه
            </label>
            {settings.doNotTranslateTerms.trim() && (
              <span className="rounded-full bg-[#00f0ff]/15 px-2 py-0.5 text-[10px] font-bold text-[#00f0ff]">
                {settings.doNotTranslateTerms.split(',').map(term => term.trim()).filter(Boolean).length} مورد
              </span>
            )}
          </div>
          <textarea
            id="do-not-translate-terms"
            value={settings.doNotTranslateTerms}
            onChange={(e) => updateSettings({ doNotTranslateTerms: e.target.value })}
            placeholder="مثلاً: React, API, SubMaster"
            className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-[#0a0e27]/60 p-3 text-sm leading-6 text-white placeholder:text-white/35 transition-all focus:border-[#00f0ff]/60 focus:outline-none"
            dir="auto"
          />
          <p className="text-[10px] leading-5 text-white/45">
            کلمات را با ویرگول انگلیسی (,) جدا کنید تا مدل آن‌ها را عیناً حفظ کند و ترجمه نکند.
          </p>
        </div>

        {settings.topic === 'educational' && (
           <div className="animate-in fade-in">
               <button onClick={onOpenGlossary} className="w-full py-3 px-4 rounded-xl border border-[#ff00ea]/30 bg-[#ff00ea]/10 hover:bg-[#ff00ea]/20 text-white font-medium flex items-center justify-between transition-all">
                  <div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#ff00ea]" /><span className="text-sm">واژه‌نامه اختصاصی</span></div>
                  {settings.glossary.length > 0 && <span className="bg-[#ff00ea] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{settings.glossary.length}</span>}
               </button>
           </div>
        )}

        <div className="space-y-3 rounded-2xl border border-primary/15 bg-surface/70 p-4 shadow-sm">
          <div className="flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /><label className="text-xs font-bold uppercase tracking-wide text-text-muted">زبان مقصد</label></div>
          <div className="relative">
            <select value={settings.targetLanguage} onChange={(e) => updateSettings({ targetLanguage: e.target.value as TargetLanguage })} className="w-full cursor-pointer appearance-none rounded-xl border border-border bg-background/70 px-4 py-3 pl-10 text-sm font-bold text-text outline-none transition-all hover:bg-surfaceHighlight focus:border-primary focus:ring-2 focus:ring-primary/20">
              {Object.entries(TARGET_LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        {/* Standards Selection */}
        <div className="space-y-3 rounded-2xl border border-secondary/15 bg-surface/70 p-4 shadow-sm">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-secondary" /><label className="text-xs font-bold uppercase tracking-wide text-text-muted">استاندارد خروجی</label></div>
          <div className="relative">
            <select value={settings.outputStandard} onChange={(e) => updateSettings({ outputStandard: e.target.value as OutputStandard })} className="w-full cursor-pointer appearance-none rounded-xl border border-border bg-background/70 px-4 py-3 pl-10 text-sm font-bold text-text outline-none transition-all hover:bg-surfaceHighlight focus:border-secondary focus:ring-2 focus:ring-secondary/20">
              <option value="normal">Normal — بدون محدودیت خاص</option>
              <option value="netflix">Netflix — ۴۲ کاراکتر | ۲۰ CPS</option>
              <option value="bbc">BBC — ۳۷ کاراکتر | ۱۷ CPS</option>
              <option value="broadcast">Broadcast — ۳۹ کاراکتر | ۱۸ CPS</option>
            </select>
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
