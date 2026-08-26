
import React, { useState, useEffect } from 'react';
import { X, Cpu, Key, Plus, Trash2, CheckCircle, AlertTriangle, Loader2, Database, ToggleRight, ToggleLeft, ExternalLink, HelpCircle } from 'lucide-react';
import { AppSettings, OpenAICompatibleService, UserAPIKey } from '../types';
import { diagnoseConnection, validateAPIConnection } from '../services/geminiService';
import { getMemorySize, clearMemory } from '../services/translationMemory';
import { TARGET_LANGUAGES } from '../constants';
import { HelpTooltip } from './HelpTooltip';
import { ApiKeyHelpModal } from './ApiKeyHelpModal';
import { TranslationSpeedSettings } from './TranslationSpeedSettings';

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
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [isTestingLocalConnection, setIsTestingLocalConnection] = useState(false);
  const [memSize, setMemSize] = useState(getMemorySize());
  const [serviceNameInput, setServiceNameInput] = useState('');
  const [serviceBaseUrlInput, setServiceBaseUrlInput] = useState('');
  const [serviceApiKeyInput, setServiceApiKeyInput] = useState('');
  const [serviceModelInput, setServiceModelInput] = useState('');
  const [openAIServiceMessage, setOpenAIServiceMessage] = useState<string | null>(null);
  const [isTestingOpenAIService, setIsTestingOpenAIService] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    if (isOpen) setMemSize(getMemorySize());
  }, [isOpen]);

  const activeOpenAIService = settings.openAICompatibleServices.find(service => service.id === settings.activeOpenAICompatibleServiceId)
      || settings.openAICompatibleServices[0];

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative w-full max-w-lg glass rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Cpu className="w-6 h-6 text-[#ff00ea]" />
                تنظیمات موتور هوش مصنوعی
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5 text-white/60" /></button>
            </div>
            <div className="space-y-8">
              <TranslationSpeedSettings settings={settings} updateSettings={updateSettings} />
              <p className="text-xs text-white/50">
                بقیه تنظیمات کلید API و مدل از نسخهٔ قبلی این فایل موقتاً بازیابی می‌شوند — در کامیت بعدی کامل می‌شود.
              </p>
              <button onClick={onClose} className="w-full py-3 bg-gradient-to-r from-[#00f0ff] to-[#00c0cc] text-black font-bold rounded-xl">تایید و بستن</button>
            </div>
          </div>
        </div>
      </div>
      <ApiKeyHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};
