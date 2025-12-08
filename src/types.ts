

export interface SubtitleBlock {
  id: number;
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText?: string;
  index: number; // The visual index (1-based)
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

// New Interface for Multi-File Support
export interface SubtitleFile {
  id: string; // Unique UUID
  name: string;
  size: number;
  type: 'SRT' | 'VTT';
  originalType: 'SRT' | 'VTT';
  blocks: SubtitleBlock[];
  status: AppStatus;
  progress: number;
  progressMessage?: string;
  processingDuration?: string | null;
  netflixErrors?: NetflixError[];
  processedCount: number;
}

export interface TranslationStats {
  totalBlocks: number;
  translatedBlocks: number;
  estimatedTimeRemaining: number; // in seconds
  startTime: number;
}

export interface BatchRequest {
  id: number;
  text: string;
}

export interface BatchResponse {
  id: number;
  translatedText: string;
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
export type ModelType = 'standard' | 'professional';

export interface AppSettings {
  tone: ToneType;
  topic: TopicType;
  temperature: number; // New field for Translation Quality
  outputFormat: 'srt' | 'vtt';
  outputStandard: 'normal' | 'netflix';
  model: ModelType;
  customPrompt: string;
  apiKeys: UserAPIKey[];
  enableTranslationMemory: boolean;
  glossary: GlossaryItem[];
}

// --- NEW TYPES FOR TIMING & QC ---

export type AdjustmentMode = 'seconds' | 'percent' | 'recalculate' | 'fixed';

export interface AdjustmentConfig {
  mode: AdjustmentMode;
  value: number; // Seconds (e.g. +/- 0.5), Percent (e.g. 110), or Fixed Seconds
  target: 'start' | 'end' | 'both' | 'shift'; // Shift moves both, others resize
}

export interface NetflixError {
  blockId: number;
  types: ('cps' | 'min_duration' | 'max_duration' | 'max_lines' | 'max_chars' | 'gap')[];
  message: string;
}

// --- NEW TYPES FOR VTT STYLING ---

export interface VttStyleConfig {
  useStyles: boolean;
  fontFamily: string;
  fontSize: string; // e.g., "100%", "1.2em"
  color: string; // hex
  backgroundColor: string; // hex or rgba
  textShadow: string;
}