import React from 'react';
import { Languages } from 'lucide-react';
import { APP_CONFIG } from '../constants';

interface HeaderProps {
    theme: 'dark' | 'light';
}

export const Header: React.FC<HeaderProps> = ({ theme }) => {
  return (
    <header className="w-full py-6 px-6 border-b border-border glass sticky top-0 z-30 mb-8 md:mb-0 transition-colors duration-300">
      <div className="flex items-center justify-between">
        
        {/* Version Badge */}
        <div className="hidden md:flex items-center gap-4">
           <span className="px-3 py-1 rounded-full border border-border bg-surface text-xs text-text-muted font-mono">v{APP_CONFIG.version}</span>
        </div>

        {/* Logo/Title */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-primary' : 'bg-primary'} blur-lg opacity-40 rounded-full`}></div>
            <div className="relative bg-gradient-to-br from-background to-surface p-3 rounded-2xl border border-border">
               <Languages className="w-6 h-6 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-montserrat font-bold text-text tracking-tight">
              SubMaster <span className="text-primary">Pro</span>
            </h1>
            <p className="text-xs text-text-muted font-medium tracking-wide">ترجمه هوشمند، نتیجه حرفه‌ای</p>
          </div>
        </div>

        {/* Mobile placeholder to balance layout if needed, or just empty */}
        <div className="md:hidden w-8"></div>
        
      </div>
    </header>
  );
};