
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
 * Counts words in a string accurately
 */
const countWords = (text: string): number => {
  return text.trim().split(/\s+/).length;
};

/**
 * Checks if text ends with sentence-ending punctuation
 */
const isSentenceComplete = (text: string): boolean => {
  return /[.?!؟]$/.test(text.trim());
};

/**
 * OPTIMIZES subtitle blocks by merging them to fit word count constraints.
 * Enforces:
 * 1. Min 12 words / Max 24 words per block (where possible).
 * 2. Sentence integrity (avoid splitting S-V-O).
 * 3. Dynamic timing based on reading speed.
 * 4. Standard gaps between blocks.
 */
export const optimizeSubtitleBlocks = (blocks: SubtitleBlock[]): SubtitleBlock[] => {
  if (blocks.length === 0) return [];

  const optimized: SubtitleBlock[] = [];
  let current = { ...blocks[0] }; 

  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i];
    
    // 1. Calculate Metrics
    const currentWordCount = countWords(current.originalText);
    const nextWordCount = countWords(next.originalText);
    const totalWords = currentWordCount + nextWordCount;
    
    const currentEndTimeMs = timeToMs(current.endTime);
    const nextStartTimeMs = timeToMs(next.startTime);
    const gap = nextStartTimeMs - currentEndTimeMs;

    // 2. Conditions to MERGE
    // We merge if:
    // - Gap implies continuous speech (not a scene change)
    // - AND (Current block is too short OR Sentence is incomplete)
    // - AND Merging won't exceed maximum word limit
    
    const isGapAcceptable = gap <= OPTIMIZATION_CONFIG.MAX_MERGE_GAP_MS;
    const isUnderMaxLimit = totalWords <= OPTIMIZATION_CONFIG.MAX_WORDS_PER_BLOCK;
    const needsMoreWords = currentWordCount < OPTIMIZATION_CONFIG.MIN_WORDS_PER_BLOCK;
    const sentenceIncomplete = !isSentenceComplete(current.originalText);

    const shouldMerge = isGapAcceptable && isUnderMaxLimit && (needsMoreWords || sentenceIncomplete);

    if (shouldMerge) {
      // MERGE ACTION
      current.endTime = next.endTime; // Extend duration to cover next block
      current.originalText = `${current.originalText} ${next.originalText}`;
      // Continue loop to try merging more into 'current'
    } else {
      // COMMIT ACTION
      // Before pushing, optimize timing for readability
      
      // Calculate target duration based on reading speed
      const targetDuration = countWords(current.originalText) * OPTIMIZATION_CONFIG.MS_PER_WORD;
      const currentStartMs = timeToMs(current.startTime);
      let calculatedEndMs = currentStartMs + targetDuration;
      
      // Ensure we don't overlap with the NEXT block (which is 'next')
      // Leave a standard gap
      const maxAllowedEndMs = timeToMs(next.startTime) - OPTIMIZATION_CONFIG.STANDARD_GAP_MS;
      
      // We can extend ONLY if there is room. We shouldn't shrink drastically unless necessary.
      // Use the actual end time if it's longer than target, but clamp to next start.
      const originalEndMs = timeToMs(current.endTime);
      
      // Rule: Extend if too fast, but don't overlap next block.
      // Rule: Keep original duration if it's already long enough.
      const finalEndMs = Math.min(Math.max(calculatedEndMs, originalEndMs), maxAllowedEndMs);
      
      // If finalEndMs < currentStartMs, it means overlap was inevitable or data issue.
      // Fallback to original end time or a small duration.
      if (finalEndMs > currentStartMs) {
         current.endTime = msToTime(finalEndMs);
      }

      optimized.push(current);
      current = { ...next };
    }
  }
  
  // Push the final block
  optimized.push(current);

  // Final Pass: Ensure Standard Gaps globally
  // (The merge loop ensures gaps between current & next, but let's double check sequential integrity)
  for (let i = 0; i < optimized.length - 1; i++) {
     const b1 = optimized[i];
     const b2 = optimized[i+1];
     const end1 = timeToMs(b1.endTime);
     const start2 = timeToMs(b2.startTime);
     
     if (end1 >= start2 - OPTIMIZATION_CONFIG.STANDARD_GAP_MS) {
         // Fix overlap or too small gap
         const newEnd = start2 - OPTIMIZATION_CONFIG.STANDARD_GAP_MS;
         if (newEnd > timeToMs(b1.startTime)) {
             b1.endTime = msToTime(newEnd);
         }
     }
  }

  // Re-index
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
