import React from 'react';
import { Settings, Check, FileText } from 'lucide-react';
import { AppSettings, ToneType, TopicType } from '../types';
import { TONE_OPTIONS, TOPIC_OPTIONS } from '../constants';

interface SidebarProps {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ settings, updateSettings, onOpenSettings }) => {
  return (
    <aside className="w-full md:w-72 glass flex flex-col h-auto md:h-screen md:sticky md:top-0 p-6 gap-8 border-l border-white/10 z-20">
      
      {/* Tone Selection */}
      <div className="space-y-3">
        <label className="text-sm text-[#00f0ff] font-semibold tracking-wide uppercase">لحن ترجمه</label>
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
      <div className="space-y-3">
        <label className="text-sm text-[#ff00ea] font-semibold tracking-wide uppercase">موضوع محتوا</label>
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

      {/* Output Format */}
      <div className="space-y-3">
        <label className="text-sm text-white/70 font-semibold tracking-wide uppercase">فرمت خروجی</label>
        <div className="flex bg-[#0a0e27]/50 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => updateSettings({ outputFormat: 'vtt' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settings.outputFormat === 'vtt' ? 'bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-white/50 hover:text-white'}`}
          >
            VTT
          </button>
          <button 
            onClick={() => updateSettings({ outputFormat: 'srt' })}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settings.outputFormat === 'srt' ? 'bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' : 'text-white/50 hover:text-white'}`}
          >
            SRT
          </button>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* Settings Button */}
      <button 
        onClick={onOpenSettings}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-white/80 hover:text-white hover:border-[#ff00ea]/50 group"
      >
        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
        <span>تنظیمات پیشرفته</span>
      </button>

    </aside>
  );
};
