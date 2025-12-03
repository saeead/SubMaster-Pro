
import { SubtitleBlock } from '../types';
import { BATCH_SIZE, OVERLAP_SIZE, OPTIMIZATION_CONFIG } from '../constants';

// Helper to convert timestamp string to milliseconds
const timeToMs = (timeString: string): number => {
  // Supports "00:00:00,000" (SRT) and "00:00:00.000" (VTT)
  const cleanTime = timeString.replace(',', '.');
  const [h, m, s] = cleanTime.split(':');
  const [sec, ms] = s.split('.');
  
  return (
    parseInt(h) * 3600000 +
    parseInt(m) * 60000 +
    parseInt(sec) * 1000 +
    parseInt(ms)
  );
};

// Helper to convert milliseconds to SRT timestamp format
const msToTime = (ms: number): string => {
  const date = new Date(ms);
  const h = Math.floor(ms / 3600000).toString().padStart(2, '0');
  const m = Math.floor((ms % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  const milli = (ms % 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
};

/**
 * Parses an SRT file content using robust Regex pattern
 */
export const parseSRT = (content: string): SubtitleBlock[] => {
  const normalizeLineEndings = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks: SubtitleBlock[] = [];
  
  const srtPattern = /(\d+)\s+(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([\s\S]*?)(?=\n\n|\n*$)/g;
  
  let match;
  while ((match = srtPattern.exec(normalizeLineEndings)) !== null) {
    blocks.push({
      id: parseInt(match[1]),
      index: parseInt(match[1]),
      startTime: match[2],
      endTime: match[3],
      originalText: match[4].trim(),
      translatedText: ''
    });
  }

  return blocks;
};

/**
 * Parses a VTT file content using robust Regex pattern
 */
export const parseVTT = (content: string): SubtitleBlock[] => {
  const normalizeLineEndings = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks: SubtitleBlock[] = [];
  
  const vttPattern = /(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+([\s\S]*?)(?=\n\n|\n*$)/g;
  
  let match;
  let indexCounter = 1;
  
  while ((match = vttPattern.exec(normalizeLineEndings)) !== null) {
    const startTime = match[1].replace('.', ',');
    const endTime = match[2].replace('.', ',');
    
    blocks.push({
      id: indexCounter,
      index: indexCounter,
      startTime: startTime,
      endTime: endTime,
      originalText: match[3].trim(),
      translatedText: ''
    });
    indexCounter++;
  }

  return blocks;
};

/**
 * OPTIMIZES subtitle blocks by merging short, fragmented lines.
 * This ensures "Complete Sentences" for the AI and better flow.
 */
export const optimizeSubtitleBlocks = (blocks: SubtitleBlock[]): SubtitleBlock[] => {
  if (blocks.length === 0) return [];

  const optimized: SubtitleBlock[] = [];
  let current = { ...blocks[0] }; // Start with first block

  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i];
    
    // Logic for deciding to merge
    const currentDuration = timeToMs(current.endTime) - timeToMs(current.startTime);
    const gap = timeToMs(next.startTime) - timeToMs(current.endTime);
    const combinedTextLength = current.originalText.length + next.originalText.length;
    
    // Check for Sentence Endings (., ?, !)
    const isSentenceEnd = /[.?!]$/.test(current.originalText);
    
    // Conditions to MERGE:
    // 1. Current block is short duration OR Gap is very small (continuous speech)
    // 2. Not a sentence end (implies fragmented thought)
    // 3. Combined length is within limits
    // 4. Gap isn't a "Scene Change" (> MAX_MERGE_GAP_MS)
    
    const shouldMerge = 
      !isSentenceEnd && 
      gap <= OPTIMIZATION_CONFIG.MAX_MERGE_GAP_MS &&
      combinedTextLength <= OPTIMIZATION_CONFIG.MAX_MERGE_CHARACTERS &&
      (currentDuration < OPTIMIZATION_CONFIG.MIN_DURATION_MS || gap < 200);

    if (shouldMerge) {
      // MERGE ACTION
      // Extend current block's end time to next block's end time
      current.endTime = next.endTime;
      // Combine text with space
      current.originalText = `${current.originalText} ${next.originalText}`;
      // Note: We keep current.startTime and current.id
    } else {
      // PUSH & RESET
      optimized.push(current);
      current = { ...next };
    }
  }
  
  // Push the final block
  optimized.push(current);

  // Re-index the blocks to be sequential (1, 2, 3...)
  return optimized.map((b, idx) => ({
    ...b,
    id: idx + 1,
    index: idx + 1
  }));
};

export interface SubtitleChunk {
  id: number;
  blocks: SubtitleBlock[]; 
  targetStartIndex: number; 
  targetEndIndex: number;
}

export const smartChunking = (blocks: SubtitleBlock[], chunkSize: number = BATCH_SIZE): SubtitleChunk[] => {
  const chunks: SubtitleChunk[] = [];
  const overlap = OVERLAP_SIZE;
  
  for (let i = 0; i < blocks.length; i += chunkSize) {
    const start = Math.max(0, i - overlap);
    const end = Math.min(blocks.length, i + chunkSize + overlap);
    const chunkBlocks = blocks.slice(start, end);
    const relativeStart = i - start;
    const targetCount = Math.min(chunkSize, blocks.length - i);
    const relativeEnd = relativeStart + targetCount;

    chunks.push({
      id: chunks.length,
      blocks: chunkBlocks,
      targetStartIndex: relativeStart,
      targetEndIndex: relativeEnd
    });
  }
  
  return chunks;
};

export const stringifySRT = (blocks: SubtitleBlock[]): string => {
  return blocks.map(block => {
    const text = block.translatedText && block.translatedText.trim() !== '' 
      ? block.translatedText 
      : block.originalText;
      
    return `${block.index}\n${block.startTime} --> ${block.endTime}\n${text}`;
  }).join('\n\n');
};

export const stringifyVTT = (blocks: SubtitleBlock[]): string => {
  const content = blocks.map(block => {
    const start = block.startTime.replace(',', '.');
    const end = block.endTime.replace(',', '.');
    
    const text = block.translatedText && block.translatedText.trim() !== '' 
      ? block.translatedText 
      : block.originalText;

    return `${start} --> ${end}\n${text}`;
  }).join('\n\n');

  return `WEBVTT\n\n${content}`;
};

export const generateSubtitleFile = (blocks: SubtitleBlock[], format: 'srt' | 'vtt'): string => {
  if (format === 'srt') {
    return stringifySRT(blocks);
  } else {
    return stringifyVTT(blocks);
  }
};

export const downloadFile = (filename: string, content: string) => {
  const element = document.createElement('a');
  const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};
