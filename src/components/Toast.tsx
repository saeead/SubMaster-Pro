import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 fade-in duration-300 w-full max-w-md px-4">
      <div className="glass bg-[#0a0e27]/95 border border-red-500/50 text-white p-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.2)] flex items-start gap-4 backdrop-blur-xl">
        <div className="p-2 bg-red-500/20 rounded-full flex-shrink-0 mt-0.5">
           <AlertCircle className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
            <strong className="block text-sm font-bold text-red-200 mb-1">خطا</strong>
            <p className="text-sm text-white/80 leading-relaxed">{message}</p>
        </div>
        <button 
            onClick={onClose} 
            className="p-1 hover:bg-white/10 rounded-full transition-colors -mr-1 text-white/50 hover:text-white"
        >
             <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};