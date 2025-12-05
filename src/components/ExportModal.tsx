
import React, { useState, useEffect } from 'react';
import { Download, X, Palette, Type, LayoutTemplate } from 'lucide-react';
import { VttStyleConfig } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (format: 'srt' | 'vtt', styles?: VttStyleConfig) => void;
  defaultFormat: 'srt' | 'vtt';
}

const FONT_OPTIONS = [
  { label: 'Default (Sans-Serif)', value: 'sans-serif' },
  { label: 'Vazirmatn (فارسی)', value: 'Vazirmatn, sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Courier New (Monospace)', value: '"Courier New", monospace' },
  { label: 'Times New Roman (Serif)', value: '"Times New Roman", serif' },
];

const SIZE_OPTIONS = [
  { label: 'Small', value: '80%' },
  { label: 'Normal', value: '100%' },
  { label: 'Large', value: '125%' },
  { label: 'Extra Large', value: '150%' },
  { label: 'Huge', value: '200%' },
];

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, onConfirm, defaultFormat }) => {
  const [format, setFormat] = useState<'srt' | 'vtt'>(defaultFormat);
  const [useStyles, setUseStyles] = useState(false);
  
  const [styles, setStyles] = useState<VttStyleConfig>({
    useStyles: false,
    fontFamily: 'Vazirmatn, sans-serif',
    fontSize: '100%',
    color: '#ffffff',
    backgroundColor: '#00000080', // Semi-transparent black
    textShadow: 'none'
  });

  useEffect(() => {
    setFormat(defaultFormat);
  }, [defaultFormat, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(format, { ...styles, useStyles });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl glass rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Download className="w-6 h-6 text-[#ff00ea]" />
            تنظیمات خروجی
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
          
          {/* Format Selection */}
          <div className="space-y-3">
             <label className="text-sm text-white/70 font-bold block">فرمت فایل</label>
             <div className="flex bg-[#0a0e27]/50 p-1.5 rounded-xl border border-white/10">
                <button 
                  onClick={() => setFormat('srt')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${format === 'srt' ? 'bg-[#00f0ff] text-[#0a0e27] shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-white/50 hover:text-white'}`}
                >
                  SRT (Standard)
                </button>
                <button 
                  onClick={() => setFormat('vtt')}
                  className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${format === 'vtt' ? 'bg-[#ff00ea] text-white shadow-[0_0_15px_rgba(255,0,234,0.4)]' : 'text-white/50 hover:text-white'}`}
                >
                  WebVTT (Styled)
                </button>
             </div>
             <p className="text-xs text-white/40 px-1">
               {format === 'srt' 
                  ? 'فرمت استاندارد و ساده بدون قابلیت تغییر رنگ و فونت. مناسب برای اکثر پلیرها.' 
                  : 'فرمت پیشرفته وب با قابلیت شخصی‌سازی ظاهر زیرنویس.'}
             </p>
          </div>

          {/* VTT Styling Options */}
          {format === 'vtt' && (
            <div className="space-y-6 animate-in slide-in-from-top-2">
               
               {/* Improved Toggle Switch UI */}
               <div 
                    onClick={() => setUseStyles(!useStyles)}
                    className={`
                        flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer select-none group
                        ${useStyles 
                            ? 'bg-[#ff00ea]/10 border-[#ff00ea]/50 shadow-[0_0_15px_rgba(255,0,234,0.1)]' 
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'
                        }
                    `}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${useStyles ? 'bg-[#ff00ea] text-white' : 'bg-white/10 text-white/50'}`}>
                            <Palette className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className={`text-sm font-bold transition-colors ${useStyles ? 'text-white' : 'text-white/70'}`}>
                                تنظیمات ظاهری (Styles)
                            </span>
                            <span className="text-xs text-white/40">
                                تغییر رنگ، فونت و سایز زیرنویس
                            </span>
                        </div>
                    </div>

                    <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${useStyles ? 'bg-[#ff00ea]' : 'bg-[#0a0e27] border border-white/20'}`}>
                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-lg transform transition-transform duration-300 ${useStyles ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                </div>

               {useStyles && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
                    {/* Controls */}
                    <div className="space-y-5">
                       
                       <div className="space-y-2">
                          <label className="text-xs text-[#00f0ff] font-bold flex items-center gap-1">
                             <Type className="w-3 h-3" /> نوع فونت
                          </label>
                          <select 
                            value={styles.fontFamily}
                            onChange={(e) => setStyles({...styles, fontFamily: e.target.value})}
                            className="w-full bg-[#0a0e27] border border-white/10 rounded-lg p-2 text-white text-sm focus:border-[#ff00ea] outline-none"
                          >
                             {FONT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                       </div>

                       <div className="space-y-2">
                          <label className="text-xs text-[#00f0ff] font-bold flex items-center gap-1">
                             <LayoutTemplate className="w-3 h-3" /> سایز نوشته
                          </label>
                          <select 
                            value={styles.fontSize}
                            onChange={(e) => setStyles({...styles, fontSize: e.target.value})}
                            className="w-full bg-[#0a0e27] border border-white/10 rounded-lg p-2 text-white text-sm focus:border-[#ff00ea] outline-none"
                          >
                             {SIZE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-xs text-[#00f0ff] font-bold flex items-center gap-1">
                                 <Palette className="w-3 h-3" /> رنگ متن
                              </label>
                              <div className="flex items-center gap-2 bg-[#0a0e27] p-2 rounded-lg border border-white/10">
                                 <input 
                                   type="color" 
                                   value={styles.color}
                                   onChange={(e) => setStyles({...styles, color: e.target.value})}
                                   className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                 />
                                 <span className="text-xs text-white/60 font-mono">{styles.color}</span>
                              </div>
                           </div>

                           <div className="space-y-2">
                              <label className="text-xs text-[#00f0ff] font-bold flex items-center gap-1">
                                 <Palette className="w-3 h-3" /> پس‌زمینه
                              </label>
                               <div className="flex items-center gap-2 bg-[#0a0e27] p-2 rounded-lg border border-white/10">
                                 <input 
                                   type="color" // HTML color input doesn't support alpha well visually, but standard VTT accepts hex/rgba
                                   value={styles.backgroundColor.slice(0, 7)} // Basic hex for picker
                                   onChange={(e) => setStyles({...styles, backgroundColor: e.target.value})}
                                   className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                 />
                                 <span className="text-xs text-white/60 font-mono">Solid</span>
                              </div>
                           </div>
                       </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-800 rounded-xl overflow-hidden border border-white/20 relative min-h-[200px] flex items-end justify-center pb-8 bg-[url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
                        <div className="absolute inset-0 bg-black/20"></div>
                        <div className="relative z-10 max-w-[90%] text-center">
                            <span 
                                style={{
                                    fontFamily: styles.fontFamily.split(',')[0].replace(/"/g, ''),
                                    fontSize: styles.fontSize === '100%' ? '16px' : styles.fontSize === '80%' ? '13px' : styles.fontSize === '125%' ? '20px' : styles.fontSize === '150%' ? '24px' : '32px',
                                    color: styles.color,
                                    backgroundColor: styles.backgroundColor,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    lineHeight: '1.5',
                                    display: 'inline-block'
                                }}
                            >
                                این یک متن نمونه زیرنویس است
                                <br />
                                Sample Subtitle Text
                            </span>
                        </div>
                    </div>
                 </div>
               )}
            </div>
          )}

        </div>

        <div className="p-6 border-t border-white/10 flex justify-end">
           <button 
              onClick={handleConfirm}
              className="bg-gradient-to-r from-[#00f0ff] to-[#ff00ea] text-white font-bold py-3 px-8 rounded-xl shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] transition-all flex items-center gap-2"
           >
              <Download className="w-5 h-5" />
              دانلود فایل نهایی
           </button>
        </div>

      </div>
    </div>
  );
};
