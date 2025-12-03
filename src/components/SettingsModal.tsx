
import React, { useState } from 'react';
import { X, Cpu, Key, Plus, Trash2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { AppSettings, UserAPIKey } from '../types';
import { validateAPIConnection } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [newKey, setNewKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    
    // Check duplicates
    if (settings.apiKeys.some(k => k.key === newKey.trim())) {
      setValidationError('این کلید قبلاً اضافه شده است.');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    const isValid = await validateAPIConnection(newKey.trim());

    if (isValid) {
      const newKeyObj: UserAPIKey = {
        key: newKey.trim(),
        isValid: true,
        isRateLimited: false,
        addedAt: Date.now(),
        label: `Personal Key ${settings.apiKeys.length + 1}`
      };
      
      updateSettings({ apiKeys: [...settings.apiKeys, newKeyObj] });
      setNewKey('');
    } else {
      setValidationError('کلید نامعتبر است یا امکان اتصال وجود ندارد.');
    }
    setIsValidating(false);
  };

  const removeKey = (keyToRemove: string) => {
    updateSettings({ apiKeys: settings.apiKeys.filter(k => k.key !== keyToRemove) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-lg glass rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="w-6 h-6 text-[#ff00ea]" />
              تنظیمات موتور هوش مصنوعی
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          <div className="space-y-8">
            
            {/* API Key Management Section */}
            <div className="space-y-4">
              <h3 className="text-sm text-[#00f0ff] font-bold uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4" />
                مدیریت کلیدهای API
              </h3>
              
              <div className="bg-[#0a0e27]/50 rounded-xl p-4 border border-white/10 space-y-4">
                <p className="text-xs text-white/60 leading-relaxed">
                  نرم‌افزار برای عملکرد نیاز به کلیدهای API شخصی شما دارد. چندین کلید وارد کنید تا در صورت اتمام اعتبار یکی، به صورت خودکار از بعدی استفاده شود.
                </p>

                {/* Input Area */}
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={newKey}
                    onChange={(e) => { setNewKey(e.target.value); setValidationError(null); }}
                    placeholder="کلید API جدید را وارد کنید..."
                    className="flex-1 bg-[#0a0e27] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-[#00f0ff] focus:outline-none"
                  />
                  <button 
                    onClick={handleAddKey}
                    disabled={!newKey || isValidating}
                    className="bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/20 px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  </button>
                </div>
                
                {validationError && (
                  <p className="text-xs text-red-400 flex items-center gap-1 animate-in fade-in">
                    <AlertTriangle className="w-3 h-3" />
                    {validationError}
                  </p>
                )}

                {/* Key List */}
                <div className="space-y-2 mt-4">
                  {/* User Keys */}
                  {settings.apiKeys.map((k, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#0a0e27] rounded-lg border border-white/10 group hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${k.isValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                        <div className="flex flex-col">
                           <span className="text-xs text-white font-mono">
                             {k.key.slice(0, 4)}...{k.key.slice(-4)}
                           </span>
                           <span className="text-[10px] text-white/40">
                             {k.label} {k.isRateLimited && <span className="text-yellow-500 font-bold ml-1">(Rate Limited)</span>}
                           </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeKey(k.key)}
                        className="text-white/20 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  {settings.apiKeys.length === 0 && (
                     <div className="text-center py-4 text-xs text-red-400/80 bg-red-500/5 rounded-lg border border-red-500/10">
                        ⚠️ هیچ کلید API تعریف نشده است. لطفا حداقل یک کلید وارد کنید.
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-4">
               <label className="text-sm text-white/70 block font-bold">انتخاب مدل پردازشی</label>
               
               <div className="grid grid-cols-1 gap-3">
                  <div 
                    onClick={() => updateSettings({ model: 'standard' })}
                    className={`
                        cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3
                        ${settings.model === 'standard' 
                            ? 'bg-[#00f0ff]/10 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]' 
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }
                    `}
                  >
                      <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${settings.model === 'standard' ? 'border-[#00f0ff]' : 'border-white/30'}`}>
                          {settings.model === 'standard' && <div className="w-2 h-2 rounded-full bg-[#00f0ff]" />}
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm">پردازش استاندارد (Gemini 2.5 Pro)</h3>
                        <p className="text-xs text-white/50 mt-1">تعادل عالی بین سرعت و دقت.</p>
                      </div>
                  </div>

                  <div 
                    onClick={() => updateSettings({ model: 'professional' })}
                    className={`
                        cursor-pointer p-4 rounded-xl border transition-all flex items-start gap-3
                        ${settings.model === 'professional' 
                            ? 'bg-[#ff00ea]/10 border-[#ff00ea] shadow-[0_0_15px_rgba(255,0,234,0.15)]' 
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }
                    `}
                  >
                      <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center ${settings.model === 'professional' ? 'border-[#ff00ea]' : 'border-white/30'}`}>
                          {settings.model === 'professional' && <div className="w-2 h-2 rounded-full bg-[#ff00ea]" />}
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm">پردازش حرفه‌ای (Gemini 3 Pro)</h3>
                        <p className="text-xs text-white/50 mt-1">دقت بالاتر برای متون تخصصی. (ممکن است کندتر باشد)</p>
                      </div>
                  </div>
               </div>
            </div>

            <button 
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black font-bold rounded-xl shadow-lg shadow-[#00f0ff]/20 hover:shadow-[#00f0ff]/40 transition-all mt-4"
            >
                تایید و بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
