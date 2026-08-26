
export interface SubtitleBlock {
  id: number;
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText?: string;
  index: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  READY = 'READY',
  TRANSLATING = 'TRANSLATING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED'
}

export interface Modification {
  blockId: number;
  oldState: Partial<SubtitleBlock>;
  newState: Partial<SubtitleBlock>;
  groupId?: string; 
  timestamp: string;
}

export interface SubtitleFile {
  id: string;
  name: string;
  size: number;
  type: 'SRT' | 'VTT' | 'ASS';
  originalType: 'SRT' | 'VTT' | 'ASS';
  blocks: SubtitleBlock[];
  status: AppStatus;
  progress: number;
  progressMessage?: string;
  diagnostic?: TranslationDiagnostic | null;
  processingDuration?: string | null;
  netflixErrors?: NetflixError[];
  processedCount: number;
  modificationsMade: Modification[];
  historyPointer: number;
}

export interface TranslationStats {
  totalBlocks: number;
  translatedBlocks: number;
  estimatedTimeRemaining: number;
  startTime: number;
}

export interface BatchRequest {
  id: number;
  text: string;
  previousTranslatedText?: string;
  problemHint?: string;
}

export interface BatchResponse {
  id: number;
  translatedText: string;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface TranslationDiagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  cause: string;
  recovery: string;
  technicalDetails?: string;
  timestamp: string;
}

export interface UserAPIKey {
  key: string;
  isValid: boolean;
  isRateLimited: boolean;
  addedAt: number;
  label?: string;
}

export interface GlossaryItem {
  term: string;
  translation: string;
}

export type ToneType = 'conversational' | 'formal' | 'news' | 'movie' | 'podcast';
export type TopicType = 'educational' | 'entertainment' | 'podcast' | 'news' | 'sports';
export type ModelType = 'standard' | 'professional' | 'flash' | 'flash_lite';
export type AIProvider = 'gemini' | 'lm_studio' | 'openai_compatible';
export type TargetLanguage = 'fa' | 'en' | 'ru' | 'zh' | 'de' | 'es';
export type OutputStandard = 'normal' | 'netflix' | 'bbc' | 'broadcast';
export type TranslationMethod = 'default' | 'paragraph' | 'skeleton_str';
export type TranslationSpeedMode = 'fast' | 'quality';

export interface OpenAICompatibleService {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  tone: ToneType;
  topic: TopicType;
  temperature: number;
  outputFormat: 'srt' | 'vtt' | 'ass';
  outputStandard: OutputStandard;
  translationMethod: TranslationMethod;
  model: ModelType;
  aiProvider: AIProvider;
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  openAICompatibleServices: OpenAICompatibleService[];
  activeOpenAICompatibleServiceId?: string;
  customPrompt: string;
  apiKeys: UserAPIKey[];
  enableTranslationMemory: boolean;
  /** fast = skip critical review pass; quality = current two-pass behavior */
  translationSpeedMode: TranslationSpeedMode;
  glossary: GlossaryItem[];
  doNotTranslateTerms: string;
  theme: 'dark' | 'light';
  targetLanguage: TargetLanguage;
}

export type TranslationJobStatus = 'queued' | 'running' | 'paused' | 'cancelled' | 'failed' | 'completed';

export interface TranslationJob {
  id: string;
  fileId: string;
  status: TranslationJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export type AdjustmentMode = 'seconds' | 'percent' | 'recalculate' | 'fixed';

export interface AdjustmentConfig {
  mode: AdjustmentMode;
  value: number;
  target: 'start' | 'end' | 'both' | 'shift';
}

export interface NetflixError {
  blockId: number;
  types: ('cps' | 'min_duration' | 'max_duration' | 'max_lines' | 'max_chars' | 'gap')[];
  message: string;
}

export interface StyleConfig {
  useStyles: boolean;
  templateId?: string;
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  backgroundOpacity: number;
  isBold: boolean;
  borderStyle: 'outline' | 'box' | 'none'; 
  outlineWidth: number;
  shadowDepth: number;
  alignment: number;
}

export interface VttStyleConfig {
  useStyles: boolean;
  fontFamily: string;
  fontSize: string; 
  color: string; 
  backgroundColor: string; 
  textShadow: string;
}

export interface StyleTemplate {
  id: string;
  name: string;
  config: StyleConfig;
}
