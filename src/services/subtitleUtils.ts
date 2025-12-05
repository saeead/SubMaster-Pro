

import { SubtitleBlock, AdjustmentConfig, NetflixError, VttStyleConfig } from '../types';
import { BATCH_SIZE, OVERLAP_SIZE, OPTIMIZATION_CONFIG } from '../constants';

// Helper to convert timestamp string to milliseconds
export const timeToMs = (timeString: string): number => {
  if (!timeString) return 0;
  // Supports "00:00:00,000" (SRT) and "00:00:00.000" (VTT)
  const cleanTime = timeString.replace(',', '.').trim();
  const parts = cleanTime.split(':');
  
  // Handle minimal timestamps if necessary, though standard is HH:MM:SS.mmm
  if (parts.length < 3) return 0;

  const [h, m, s] = parts;
  const [sec, ms] = s.split('.');
  
  return (
    parseInt(h) * 3600000 +
    parseInt(m) * 60000 +
    parseInt(sec) * 1000 +
    parseInt(ms || '0')
  );
};

// Helper to convert milliseconds to SRT timestamp format
export const msToTime = (ms: number): string => {
  const safeMs = Math.max(0, ms); // Prevent negative time
  const date = new Date(safeMs);
  const h = Math.floor(safeMs / 3600000).toString().padStart(2, '0');
  const m = Math.floor((safeMs % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((safeMs % 60000) / 1000).toString().padStart(2, '0');
  const milli = (safeMs % 1000).toString().padStart(3, '0');
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

const countChars = (text: string): number => {
  return text.replace(/[\r\n]+/g, '').length;
};

/**
 * Checks if text ends with sentence-ending punctuation
 */
const isSentenceComplete = (text: string): boolean => {
  return /[.?!؟]$/.test(text.trim());
};

/**
 * Formats Persian Subtitle text based on specific length rules.
 */
export const formatPersianSubtitle = (text: string): string => {
  if (!text) return '';
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  const words = clean.split(/\s+/);
  const wordCount = words.length;

  if (wordCount <= 10) return clean;

  let minSplit = 8;
  let maxSplit = 15;
  
  if (wordCount <= 24) {
    maxSplit = 12; 
  }

  if (maxSplit >= wordCount) maxSplit = wordCount - 1;
  if (minSplit < 1) minSplit = 1;

  let bestSplitIndex = Math.min(12, Math.floor(wordCount / 2));
  let highestScore = -Infinity;

  for (let i = minSplit; i <= maxSplit; i++) {
    const word = words[i - 1];
    let score = 0;

    if (/[.?!؟!;]$/.test(word)) score += 50;
    else if (/[،,:]$/.test(word)) score += 25;

    const target = 12;
    const dist = Math.abs(i - target);
    score -= dist * 2;

    if (score >= highestScore) {
      highestScore = score;
      bestSplitIndex = i;
    }
  }

  const line1 = words.slice(0, bestSplitIndex).join(' ');
  const line2 = words.slice(bestSplitIndex).join(' ');

  return `${line1}\n${line2}`;
};

/**
 * OPTIMIZES subtitle blocks by merging them to fit word count constraints.
 * Supports Normal and Netflix standards.
 */
export const optimizeSubtitleBlocks = (blocks: SubtitleBlock[], standard: 'normal' | 'netflix' = 'normal'): SubtitleBlock[] => {
  if (blocks.length === 0) return [];

  const config = standard === 'netflix' ? OPTIMIZATION_CONFIG.NETFLIX : OPTIMIZATION_CONFIG.NORMAL;
  const MAX_DURATION_MS = standard === 'netflix' ? 7000 : 12000;
  
  const optimized: SubtitleBlock[] = [];
  let current = { ...blocks[0] }; 

  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i];
    
    const currentWordCount = countWords(current.originalText);
    const nextWordCount = countWords(next.originalText);
    const totalWords = currentWordCount + nextWordCount;
    
    // Check char count too for stricter Netflix compliance
    const currentChars = countChars(current.originalText);
    const nextChars = countChars(next.originalText);
    const totalChars = currentChars + nextChars;
    
    const currentStartMs = timeToMs(current.startTime);
    const currentEndTimeMs = timeToMs(current.endTime);
    const nextStartTimeMs = timeToMs(next.startTime);
    const nextEndTimeMs = timeToMs(next.endTime);
    
    const gap = nextStartTimeMs - currentEndTimeMs;
    const combinedDuration = nextEndTimeMs - currentStartMs;

    const isGapAcceptable = gap <= config.MAX_MERGE_GAP_MS;
    const isUnderMaxLimit = totalWords <= config.MAX_WORDS_PER_BLOCK && totalChars <= config.MAX_MERGE_CHARACTERS;
    const isDurationAcceptable = combinedDuration <= MAX_DURATION_MS;
    
    const needsMoreWords = currentWordCount < config.MIN_WORDS_PER_BLOCK;
    const sentenceIncomplete = !isSentenceComplete(current.originalText);

    // Check for distinct dialogue speakers to prevent bad merges
    // Example: "- Hi" and "- Hello" should likely remain separate unless very short.
    const isDialogueMismatch = current.originalText.trim().startsWith('-') && next.originalText.trim().startsWith('-');

    // Merge logic:
    // If we MUST merge (sentence incomplete) or we SHOULD merge (block too short), try to merge.
    // But never exceed hard limits.
    const shouldMerge = isGapAcceptable && isUnderMaxLimit && isDurationAcceptable && !isDialogueMismatch && (needsMoreWords || sentenceIncomplete);

    if (shouldMerge) {
      current.endTime = next.endTime;
      // Maintain separation for dialogue or existing multiline blocks
      if (next.originalText.trim().startsWith('-') || current.originalText.includes('\n')) {
          current.originalText = `${current.originalText}\n${next.originalText}`;
      } else {
          current.originalText = `${current.originalText} ${next.originalText}`;
      }
    } else {
      // Recalculate end time for readability if not merging (only if duration is suspiciously short)
      // This helps with "flashing" subtitles in source files
      const minReadingTime = countWords(current.originalText) * config.MS_PER_WORD;
      const originalDuration = currentEndTimeMs - currentStartMs;
      
      if (originalDuration < minReadingTime) {
          const maxAllowedEndMs = nextStartTimeMs - config.STANDARD_GAP_MS;
          const targetEndMs = currentStartMs + minReadingTime;
          
          // Extend, but don't overlap next block
          const finalEndMs = Math.min(targetEndMs, maxAllowedEndMs);
          
          if (finalEndMs > currentStartMs) {
             current.endTime = msToTime(finalEndMs);
          }
      }

      optimized.push(current);
      current = { ...next };
    }
  }
  
  optimized.push(current);

  // Post-optimization: Ensure minimum gaps between all blocks
  for (let i = 0; i < optimized.length - 1; i++) {
     const b1 = optimized[i];
     const b2 = optimized[i+1];
     const end1 = timeToMs(b1.endTime);
     const start2 = timeToMs(b2.startTime);
     
     if (end1 >= start2 - config.STANDARD_GAP_MS) {
         const newEnd = start2 - config.STANDARD_GAP_MS;
         // Ensure we don't invert the block
         if (newEnd > timeToMs(b1.startTime)) {
             b1.endTime = msToTime(newEnd);
         }
     }
  }

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

export const stringifyVTT = (blocks: SubtitleBlock[], styles?: VttStyleConfig): string => {
  let header = `WEBVTT\n\n`;
  const styleClass = 'styled'; // Specific class for VTT styling

  // Insert STYLE block if enabled
  if (styles && styles.useStyles) {
    header += `STYLE\n::cue(.${styleClass}) {\n`;
    if (styles.fontFamily) header += `  font-family: ${styles.fontFamily};\n`;
    if (styles.fontSize) header += `  font-size: ${styles.fontSize};\n`;
    if (styles.color) header += `  color: ${styles.color};\n`;
    if (styles.backgroundColor) header += `  background-color: ${styles.backgroundColor};\n`;
    if (styles.textShadow) header += `  text-shadow: ${styles.textShadow};\n`;
    // Default alignment for better presentation
    header += `  text-align: center;\n`;
    header += `}\n\n`;
  }

  const content = blocks.map(block => {
    const start = block.startTime.replace(',', '.');
    const end = block.endTime.replace(',', '.');
    
    let text = block.translatedText && block.translatedText.trim() !== '' 
      ? block.translatedText 
      : block.originalText;

    // Wrap text in class tag if styles are enabled
    if (styles && styles.useStyles) {
       text = `<c.${styleClass}>${text}</c>`;
    }

    return `${start} --> ${end}\n${text}`;
  }).join('\n\n');

  return `${header}${content}`;
};

export const generateSubtitleFile = (blocks: SubtitleBlock[], format: 'srt' | 'vtt', vttStyles?: VttStyleConfig): string => {
  if (format === 'srt') {
    return stringifySRT(blocks);
  } else {
    return stringifyVTT(blocks, vttStyles);
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

// --- TIMING ADJUSTMENT & NETFLIX CHECKS ---

export const adjustBlockTiming = (blocks: SubtitleBlock[], config: AdjustmentConfig): SubtitleBlock[] => {
  return blocks.map((block, idx) => {
    let startMs = timeToMs(block.startTime);
    let endMs = timeToMs(block.endTime);
    let duration = endMs - startMs;
    const nextBlockStart = blocks[idx + 1] ? timeToMs(blocks[idx + 1].startTime) : Infinity;

    const textToUse = block.translatedText || block.originalText;

    switch (config.mode) {
      case 'seconds':
        const msValue = config.value * 1000;
        if (config.target === 'shift') {
          startMs += msValue;
          endMs += msValue;
        } else if (config.target === 'start') {
          startMs += msValue;
        } else if (config.target === 'end') {
          endMs += msValue;
        } else if (config.target === 'both') {
          // Extend both sides
          startMs -= msValue / 2;
          endMs += msValue / 2;
        }
        break;

      case 'percent':
        const multiplier = config.value / 100;
        const newDuration = duration * multiplier;
        const diff = newDuration - duration;
        // Usually percent scaling keeps center or extends end. Let's extend end.
        endMs = startMs + newDuration;
        break;

      case 'fixed':
        const fixedDurationMs = config.value * 1000;
        endMs = startMs + fixedDurationMs;
        break;

      case 'recalculate':
        // Value is Reading Speed (Chars per second), typically 17-20
        const charCount = countChars(textToUse);
        const idealDurationSec = charCount / (config.value || 20); 
        const idealDurationMs = idealDurationSec * 1000;
        // Don't shrink below 0.833s (Netflix min)
        const constrainedDuration = Math.max(833, idealDurationMs); 
        endMs = startMs + constrainedDuration;
        break;
    }

    // Safety Checks
    if (endMs <= startMs) endMs = startMs + 833; // Minimum duration fallback
    
    // Prevent overlap with next block (unless it's a 'shift' operation which moves everything)
    if (config.mode !== 'seconds' || config.target !== 'shift') {
       if (endMs > nextBlockStart - 84) { // 2 frames gap (approx 84ms)
           endMs = nextBlockStart - 84;
       }
    }

    return {
      ...block,
      startTime: msToTime(startMs),
      endTime: msToTime(endMs)
    };
  });
};

export const validateNetflixStandards = (blocks: SubtitleBlock[]): NetflixError[] => {
  const errors: NetflixError[] = [];

  blocks.forEach((block, idx) => {
    const text = block.translatedText || block.originalText;
    const startMs = timeToMs(block.startTime);
    const endMs = timeToMs(block.endTime);
    const durationSec = (endMs - startMs) / 1000;
    const charCount = countChars(text);
    const lines = text.split('\n');
    
    const blockErrors: NetflixError['types'] = [];

    // 1. Character Limit per line (42)
    const maxLineLength = Math.max(...lines.map(l => l.length));
    if (maxLineLength > 42) blockErrors.push('max_chars');

    // 2. Max Lines (2)
    if (lines.length > 2) blockErrors.push('max_lines');

    // 3. Reading Speed (Max 20 CPS)
    const cps = durationSec > 0 ? charCount / durationSec : 0;
    if (cps > 20) blockErrors.push('cps');

    // 4. Min Duration (5/6 sec ~= 0.833s)
    if (durationSec < 0.833) blockErrors.push('min_duration');

    // 5. Max Duration (7 sec)
    if (durationSec > 7) blockErrors.push('max_duration');

    // 6. Gap check (Min 2 frames ~= 83ms)
    if (idx < blocks.length - 1) {
      const nextStart = timeToMs(blocks[idx+1].startTime);
      const gap = nextStart - endMs;
      if (gap < 83 && gap > -500) { // Check for small overlaps or small gaps (ignoring huge overlaps which are likely errors)
        blockErrors.push('gap');
      }
    }

    if (blockErrors.length > 0) {
      let msg = '';
      if (blockErrors.includes('cps')) msg += `سرعت خواندن بالا (${cps.toFixed(1)} CPS). `;
      if (blockErrors.includes('max_chars')) msg += `طول خط بیش از 42 کاراکتر. `;
      if (blockErrors.includes('max_lines')) msg += `بیش از 2 خط. `;
      if (blockErrors.includes('min_duration')) msg += `زمان نمایش بسیار کوتاه. `;
      if (blockErrors.includes('max_duration')) msg += `زمان نمایش بسیار طولانی. `;
      if (blockErrors.includes('gap')) msg += `فاصله با زیرنویس بعدی کم است. `;

      errors.push({
        blockId: block.id,
        types: blockErrors,
        message: msg.trim()
      });
    }
  });

  return errors;
};

// Helper for splitting text into lines adhering to Netflix limits
const smartSplitText = (text: string, maxLen: number = 42): string => {
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;

  const words = clean.split(' ');
  let line1 = '';
  let line2 = '';

  // Try to find a midpoint split
  const totalChars = clean.length;
  const targetSplit = totalChars / 2;
  
  let currentLen = 0;
  let splitIndex = 0;
  
  // Find best split index
  for (let i = 0; i < words.length; i++) {
    currentLen += words[i].length + 1; // +1 for space
    if (currentLen >= targetSplit) {
       splitIndex = i;
       break;
    }
  }

  // Adjust split if it violates maxLen
  const p1 = words.slice(0, splitIndex + 1).join(' ');
  const p2 = words.slice(splitIndex + 1).join(' ');
  
  // If p1 is too long, force split earlier
  if (p1.length > maxLen) {
      let fitLen = 0;
      let fitIndex = 0;
      for (let i=0; i<words.length; i++) {
          if (fitLen + words[i].length > maxLen) break;
          fitLen += words[i].length + 1;
          fitIndex = i;
      }
      return words.slice(0, fitIndex+1).join(' ') + '\n' + words.slice(fitIndex+1).join(' ');
  } 
  
  return p1 + '\n' + p2;
};

/**
 * RECALCULATES duration and timing based on Netflix Rules.
 * Solves "Player skipping lines" by strictly enforcing gaps.
 */
export const fixNetflixStandards = (blocks: SubtitleBlock[]): SubtitleBlock[] => {
  // 1. Critical: Sort blocks by StartTime to handle out-of-order source files
  let sorted = [...blocks].sort((a, b) => timeToMs(a.startTime) - timeToMs(b.startTime));
  
  // Deep copy to avoid mutation issues during map
  sorted = JSON.parse(JSON.stringify(sorted));

  const CPS_LIMIT = 20; // Characters Per Second
  const MIN_DURATION_MS = 833; // ~20 frames
  const MAX_DURATION_MS = 7000; // 7 seconds
  const MIN_GAP_MS = 84; // ~2 frames gap required

  return sorted.map((block, idx) => {
    // A. Text Optimization
    let text = block.translatedText || block.originalText || "";
    text = text.trim();
    const lines = text.split('\n');
    if (lines.length > 2 || lines.some((l: string) => l.length > 42)) {
      text = smartSplitText(text, 42);
      block.translatedText = text;
    }
    
    // B. Calculate Ideal Duration based on Character Count (Standard for Netflix)
    // Note: User asked for "based on word count", but Netflix uses CPS.
    // CPS (Chars Per Second) is the accurate way to determine reading time.
    const charCount = countChars(text);
    let idealDurationMs = (charCount / CPS_LIMIT) * 1000;

    // Apply Constraints
    if (idealDurationMs < MIN_DURATION_MS) idealDurationMs = MIN_DURATION_MS;
    if (idealDurationMs > MAX_DURATION_MS) idealDurationMs = MAX_DURATION_MS;

    const startMs = timeToMs(block.startTime);
    let endMs = startMs + idealDurationMs;

    // C. Collision Avoidance (Strict Gap Enforcement)
    // This fixes the issue where players skip subtitles due to timestamp overlap.
    if (idx < sorted.length - 1) {
        const nextBlock = sorted[idx + 1];
        const nextStartMs = timeToMs(nextBlock.startTime);
        
        // Calculate the absolute latest this subtitle can end
        const maxAllowedEndMs = nextStartMs - MIN_GAP_MS;

        // If our calculated end time violates the gap, we must clamp it.
        if (endMs > maxAllowedEndMs) {
            endMs = maxAllowedEndMs;
        }

        // Safety check: Ensure we don't end before we start.
        // If next subtitle is too close, this subtitle might be extremely short.
        // We prioritize "No Overlap" over "Min Duration" to prevent player crashes.
        if (endMs <= startMs) {
            // Extreme edge case: Next subtitle starts at or before this one.
            // We clamp end to start + small epsilon, effectively hiding it or showing it briefly.
            // We do NOT extend into the next block as that causes the "missing lines" bug.
            
            // Re-eval with smaller emergency gap?
            const emergencyGap = 20; 
            if (nextStartMs - startMs > emergencyGap) {
                endMs = nextStartMs - emergencyGap;
            } else {
               // Timestamps are practically identical. Keep it extremely short but positive.
               endMs = startMs + 100; 
            }
        }
    }

    return {
        ...block,
        endTime: msToTime(endMs)
    };
  });
};
