import React from 'react';
import { Languages } from 'lucide-react';
import { APP_CONFIG } from '../constants';

export const Header: React.FC = () => {
  return (
    <header className="w-full py-6 px-6 border-b border-white/10 glass sticky top-0 z-30 mb-8 md:mb-0">
      <div className="flex items-center justify-between">
        
        {/* Version Badge - Swapped to Right (First element in RTL) */}
        <div className="hidden md:block">
           <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50 font-mono">v{APP_CONFIG.version}</span>
        </div>

        {/* Logo/Title - Swapped to Left (Second element in RTL) */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#00f0ff] blur-lg opacity-40 rounded-full"></div>
            <div className="relative bg-gradient-to-br from-[#0a0e27] to-[#1a1f4d] p-3 rounded-2xl border border-white/10">
               <Languages className="w-6 h-6 text-[#00f0ff]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-montserrat font-bold text-white tracking-tight">
              SubMaster <span className="text-[#00f0ff]">Pro</span>
            </h1>
            <p className="text-xs text-[#a0aec0] font-medium tracking-wide">ترجمه هوشمند، نتیجه حرفه‌ای</p>
          </div>
        </div>
        
      </div>
    </header>
  );
};