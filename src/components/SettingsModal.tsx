
import React, { useState, useEffect } from 'react';
import { X, Cpu, Key, Plus, Trash2, CheckCircle, AlertTriangle, Loader2, Database, ToggleRight, ToggleLeft } from 'lucide-react';
import { AppSettings, UserAPIKey } from '../types';
import { validateAPIConnection } from '../services/geminiService';
import { getMemorySize, clearMemory } from '../services/translationMemory';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, updateSettings }) => {
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [memSize, setMemSize] = useState(getMemorySize());

  // Update memory size whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setMemSize(getMemorySize());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddKeys = async () => {
    if (!newKeyInput.trim()) return;
    
    setIsValidating(true);
    setValidationError(null);
    setSuccessMessage(null);

    const rawKeys = newKeyInput.split(/[\n\r, ]+/);
    const uniqueCandidates: string[] = Array.from(new Set(rawKeys.map(k => k.trim()).filter(k => k.length > 0)));

    if (uniqueCandidates.length === 0) {
        setIsValidating(false);
        return;
    }

    const keysToAdd: UserAPIKey[] = [];
    let duplicateCount = 0;
    let invalidCount = 0;

    await Promise.all(uniqueCandidates.map(async (keyStr) => {
        if (settings.apiKeys.some(k => k.key === keyStr)) {
            duplicateCount++;
            return;
        }

        const isValid = await validateAPIConnection(keyStr);
        if (isValid) {
            keysToAdd.push({
                key: keyStr,
                isValid: true,
                isRateLimited: false,
                addedAt: Date.now(),
                label: `Personal Key`
            });
        } else {
            invalidCount++;
        }
    }));

    if (keysToAdd.length > 0) {
        const startIndex = settings.apiKeys.length + 1;
        const labeledKeys = keysToAdd.map((k, i) => ({
            ...k,
            label: `Personal Key ${startIndex + i}`
        }));
        
        updateSettings({ apiKeys: [...settings.apiKeys, ...labeledKeys] });
        setNewKeyInput('');
        
        let msg = `${keysToAdd.length} کلید با موفقیت اضافه شد.`;
        if (duplicateCount > 0) msg += ` (${duplicateCount} تکراری)`;
        if (invalidCount > 0) msg += ` (${invalidCount} نامعتبر)`;
        setSuccessMessage(msg);
    } else {
        if (duplicateCount > 0 && invalidCount === 0) {
            setValidationError('همه کلیدهای وارد شده تکراری هستند.');
        } else {
            setValidationError('هیچ کلید معتبری یافت نشد. لطفاً از صحت کلیدها اطمینان حاصل کنید.');
        }
    }

    setIsValidating(false);
  };

  const removeKey = (keyToRemove: string) => {
    updateSettings({ apiKeys: settings.apiKeys.filter(k => k.key !== keyToRemove) });
  };

  const handleClearMemory = () => {
      if (confirm('آیا از پاک کردن تمام حافظه ترجمه اطمینان دارید؟')) {
          clearMemory();
          setMemSize(0);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
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
            
            {/* Translation Memory */}
            <div className="space-y-4">
                <h3 className="text-sm text-[#00f0ff] font-bold uppercase tracking-wider flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    حافظه ترجمه (Translation Memory)
                </h3>
                
                <div 
                    onClick={() => updateSettings({ enableTranslationMemory: !settings.enableTranslationMemory })}
                    className={`
                        cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all
                        ${settings.enableTranslationMemory ? 'bg-[#00f0ff]/10 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                    `}
                >
                    <div className="flex flex-col">
                        <span className="text-white font-medium text-sm">استفاده از حافظه ترجمه</span>
                        <span className="text-xs text-white/50 mt-1">
                            ذخیره و استفاده مجدد از جملات تکراری برای افزایش سرعت و کاهش هزینه. ({memSize} جمله ذخیره شده)
                        </span>
                    </div>
                    <div className={`transition-colors ${settings.enableTranslationMemory ? 'text-[#00f0ff]' : 'text-white/30'}`}>
                        {settings.enableTranslationMemory ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </div>
                </div>
                
                {settings.enableTranslationMemory && memSize > 0 && (
                    <button 
                        onClick={handleClearMemory}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" />
                        پاکسازی حافظه
                    </button>
                )}
            </div>

            {/* API Key Management */}
            <div className="space-y-4">
              <h3 className="text-sm text-[#00f0ff] font-bold uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4" />
                مدیریت کلیدهای API
              </h3>
              
              <div className="bg-[#0a0e27]/50 rounded-xl p-4 border border-white/10 space-y-4">
                <p className="text-xs text-white/60 leading-relaxed">
                  کلیدهای API خود را وارد کنید. می‌توانید چندین کلید را به صورت همزمان وارد کنید.
                </p>

                <div className="flex flex-col gap-2">
                  <textarea 
                    value={newKeyInput}
                    onChange={(e) => { setNewKeyInput(e.target.value); setValidationError(null); setSuccessMessage(null); }}
                    placeholder="کلیدهای API را اینجا وارد کنید..."
                    className="w-full bg-[#0a0e27] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-[#00f0ff] focus:outline-none min-h-[100px] resize-y custom-scrollbar font-mono leading-6"
                  />
                  <button 
                    onClick={handleAddKeys}
                    disabled={!newKeyInput.trim() || isValidating}
                    className="w-full bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/20 py-2 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    <span>{isValidating ? 'در حال بررسی...' : 'افزودن کلیدها'}</span>
                  </button>
                </div>
                
                {validationError && (
                  <p className="text-xs text-red-400 flex items-center gap-1 animate-in fade-in bg-red-500/5 p-2 rounded border border-red-500/10">
                    <AlertTriangle className="w-3 h-3" />
                    {validationError}
                  </p>
                )}
                
                {successMessage && (
                  <p className="text-xs text-green-400 flex items-center gap-1 animate-in fade-in bg-green-500/5 p-2 rounded border border-green-500/10">
                    <CheckCircle className="w-3 h-3" />
                    {successMessage}
                  </p>
                )}

                <div className="space-y-2 mt-4 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {settings.apiKeys.map((k, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#0a0e27] rounded-lg border border-white/10 group hover:border-white/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${k.isValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-xs text-white font-mono truncate">
                             {k.key.slice(0, 8)}...{k.key.slice(-6)}
                           </span>
                           <span className="text-[10px] text-white/40 truncate">
                             {k.label} {k.isRateLimited && <span className="text-yellow-500 font-bold ml-1">(Rate Limited)</span>}
                           </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeKey(k.key)}
                        className="text-white/20 hover:text-red-400 transition-colors p-1"
                        title="حذف کلید"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
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
                        <h3 className="text-white font-medium text-sm">پردازش حرفه‌ای (Gemini 3 Pro Preview)</h3>
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
