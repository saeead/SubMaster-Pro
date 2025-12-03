
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
  ERROR = 'ERROR'
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

export type ToneType = 'conversational' | 'formal' | 'news' | 'movie' | 'podcast';
export type TopicType = 'educational' | 'entertainment' | 'podcast' | 'news' | 'sports';
export type ModelType = 'standard' | 'professional';

export interface AppSettings {
  tone: ToneType;
  topic: TopicType;
  outputFormat: 'srt' | 'vtt';
  model: ModelType;
  customPrompt: string;
  apiKeys: UserAPIKey[];
}
