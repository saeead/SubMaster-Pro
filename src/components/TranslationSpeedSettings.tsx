import React from 'react';
import { Zap } from 'lucide-react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
}

/** Wave 1: Fast vs Quality translation speed toggle. */
export const TranslationSpeedSettings: React.FC<Props> = ({ settings, updateSettings }) => {
  const mode = settings.translationSpeedMode || 'quality';
  return (
    <div className="space-y-4">
      <h3 className="text-sm text-[#00f0ff] font-bold uppercase tracking-wider flex items-center gap-2">
        <Zap className="w-4 h-4" />
        سرعت ترجمه
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => updateSettings({ translationSpeedMode: 'fast' })}
          className={`p-4 rounded-xl border text-right transition-all ${
            mode === 'fast'
              ? 'bg-[#00f0ff]/10 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="text-sm font-medium text-white">سریع (Fast)</div>
          <div className="text-[11px] text-white/50 mt-1 leading-relaxed">
            یک پاس ترجمه — بدون بازبینی اجباری. مناسب پیش‌نویس و فایل‌های بزرگ.
          </div>
        </button>
        <button
          type="button"
          onClick={() => updateSettings({ translationSpeedMode: 'quality' })}
          className={`p-4 rounded-xl border text-right transition-all ${
            mode === 'quality'
              ? 'bg-[#00f0ff]/10 border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="text-sm font-medium text-white">باکیفیت (Quality)</div>
          <div className="text-[11px] text-white/50 mt-1 leading-relaxed">
            بازبینی موارد مشکوک با درخواست دوم. کمی کندتر، پایدارتر.
          </div>
        </button>
      </div>
      <p className="text-[11px] text-white/40 leading-relaxed">
        فاصله بین batchها به‌صورت هوشمند تنظیم می‌شود. با چند کلید API معتبر، pacing فشرده‌تر اعمال می‌شود.
      </p>
    </div>
  );
};
