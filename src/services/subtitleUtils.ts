

import { SubtitleBlock, AdjustmentConfig, NetflixError, VttStyleConfig, StyleConfig } from '../types';
import { BATCH_SIZE, OVERLAP_SIZE, OPTIMIZATION_CONFIG } from '../constants';

// Helper to convert timestamp string to milliseconds
export const timeToMs = (timeString: string): number => {
  if (!timeString) return 0;
  // Supports "0:00:00.00" (ASS), "00:00:00,000" (SRT), "00:00:00.000" (VTT)
  const cleanTime = timeString.replace(',', '.').trim();
  const parts = cleanTime.split(':');
  
  if (parts.length < 2) return 0;

  const h = parts.length === 3 ? parseInt(parts[0]) : 0;
  const m = parseInt(parts[parts.length === 3 ? 1 : 0]);
  const sParts = parts[parts.length === 3 ? 2 : 1].split('.');
  const sec = parseInt(sParts[0]);
  let ms = 0;
  if (sParts[1]) {
      // Handle ASS 2-digit centiseconds vs SRT/VTT 3-digit milliseconds
      ms = sParts[1].length === 2 ? parseInt(sParts[1]) * 10 : parseInt(sParts[1].padEnd(3, '0').substring(0,3));
  }
  
  return (h * 3600000 + m * 60000 + sec * 1000 + ms);
};

// Helper to convert milliseconds to SRT timestamp format
export const msToTime = (ms: number): string => {
  const safeMs = Math.max(0, ms); 
  const date = new Date(safeMs);
  const h = Math.floor(safeMs / 3600000).toString().padStart(2, '0');
  const m = Math.floor((safeMs % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((safeMs % 60000) / 1000).toString().padStart(2, '0');
  const milli = (safeMs % 1000).toString().padStart(3, '0');
  return `${h}:${m}:${s},${milli}`;
};

// Convert ms to ASS timestamp (H:MM:SS.cc)
export const msToAssTime = (ms: number): string => {
  const safeMs = Math.max(0, ms);
  const h = Math.floor(safeMs / 3600000).toString(); // Single digit hour allowed
  const m = Math.floor((safeMs % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((safeMs % 60000) / 1000).toString().padStart(2, '0');
  const cs = Math.floor((safeMs % 1000) / 10).toString().padStart(2, '0'); // Centiseconds
  return `${h}:${m}:${s}.${cs}`;
};

// Hex #RRGGBB to ASS &HAABBGGRR
// Opacity: 0-100 (100 = Opaque/Visible, 0 = Transparent/Invisible)
export const hexToAssColor = (hex: string, opacity: number = 100): string => {
    // ASS Alpha: 00 (Opaque) -> FF (Transparent).
    // So: 100% opacity -> 00 alpha. 0% opacity -> FF alpha.
    const alphaVal = Math.round(255 - (Math.max(0, Math.min(100, opacity)) / 100) * 255);
    const alphaHex = alphaVal.toString(16).padStart(2, '0').toUpperCase();

    if (!hex) return `&H${alphaHex}FFFFFF`;
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
        const r = clean.substring(0, 2);
        const g = clean.substring(2, 4);
        const b = clean.substring(4, 6);
        return `&H${alphaHex}${b}${g}${r}`; // &HAABBGGRR
    }
    return `&H${alphaHex}FFFFFF`;
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
 * Parses SSA/ASS file content
 */
export const parseASS = (content: string): SubtitleBlock[] => {
  const normalizeLineEndings = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks: SubtitleBlock[] = [];
  
  // Regex to find "Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  // Note: ASS format can vary slightly in header definition, but Format: usually defines order.
  // We assume standard "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  
  const lines = normalizeLineEndings.split('\n');
  let indexCounter = 1;
  let inEvents = false;
  
  for (const line of lines) {
      if (line.trim() === '[Events]') {
          inEvents = true;
          continue;
      }
      if (!inEvents) continue;
      
      if (line.startsWith('Dialogue:')) {
          const parts = line.split(',');
          if (parts.length >= 10) {
              const start = parts[1].trim();
              const end = parts[2].trim();
              // Text is everything after the 9th comma (index 9)
              const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/{.*?}/g, '').trim(); // Clean tags
              
              // Convert ASS time (0:00:00.00) to SRT time (00:00:00,000) for internal use
              const startMs = timeToMs(start);
              const endMs = timeToMs(end);
              
              blocks.push({
                  id: indexCounter,
                  index: indexCounter,
                  startTime: msToTime(startMs),
                  endTime: msToTime(endMs),
                  originalText: text,
                  translatedText: ''
              });
              indexCounter++;
          }
      }
  }

  return blocks;
};

const countWords = (text: string): number => {
  return text.trim().split(/\s+/).length;
};

const countChars = (text: string): number => {
  return text.replace(/[\r\n]+/g, '').length;
};

const isSentenceComplete = (text: string): boolean => {
  // Checks for . ! ? ; and also Persian equivalents like ؟
  // Also ignores trailing quotes like "End."
  return /[.?!؟!;]['"]?$/.test(text.trim());
};

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
 * Advanced Semantic Block Optimization
 * Merges blocks to keep sentences together while respecting hard limits.
 */
export const optimizeSubtitleBlocks = (blocks: SubtitleBlock[], standard: 'normal' | 'netflix' = 'normal'): SubtitleBlock[] => {
  if (blocks.length === 0) return [];

  const config = standard === 'netflix' ? OPTIMIZATION_CONFIG.NETFLIX : OPTIMIZATION_CONFIG.NORMAL;
  const MAX_DURATION_MS = standard === 'netflix' ? 7000 : 12000;
  
  const optimized: SubtitleBlock[] = [];
  
  // "Accumulator" buffer for building semantic blocks
  let bufferBlock: SubtitleBlock = { ...blocks[0] };
  
  for (let i = 1; i < blocks.length; i++) {
    const nextBlock = blocks[i];
    
    // Metrics for decision making
    const bufferWords = countWords(bufferBlock.originalText);
    const nextWords = countWords(nextBlock.originalText);
    const totalWords = bufferWords + nextWords;
    
    const bufferChars = countChars(bufferBlock.originalText);
    const nextChars = countChars(nextBlock.originalText);
    
    const bufferEndMs = timeToMs(bufferBlock.endTime);
    const nextStartMs = timeToMs(nextBlock.startTime);
    const nextEndMs = timeToMs(nextBlock.endTime);
    const bufferStartMs = timeToMs(bufferBlock.startTime);
    
    const gapMs = nextStartMs - bufferEndMs;
    const combinedDurationMs = nextEndMs - bufferStartMs;

    // --- DECISION LOGIC ---

    // 1. Hard Constraints (Must Break)
    const isGapTooLarge = gapMs > config.MAX_MERGE_GAP_MS;
    const isTooLongDuration = combinedDurationMs > MAX_DURATION_MS;
    const isTooManyWords = totalWords > config.MAX_WORDS_PER_BLOCK;
    const isTooManyChars = (bufferChars + nextChars) > config.MAX_MERGE_CHARACTERS;
    const isDialogueSwitch = bufferBlock.originalText.trim().startsWith('-') && nextBlock.originalText.trim().startsWith('-');

    const mustBreak = isGapTooLarge || isTooLongDuration || isTooManyWords || isTooManyChars || isDialogueSwitch;

    // 2. Semantic Logic (Should Merge?)
    // If the current buffer is NOT a complete sentence, we aggressively want to merge,
    // provided hard constraints aren't violated.
    const isBufferIncomplete = !isSentenceComplete(bufferBlock.originalText);
    
    // 3. Optimization Logic (Too Short?)
    // If the buffer IS a complete sentence but very short, and the next one is close, merge them
    // to create a more readable block (unless Netflix/Strict mode prefers simpler blocks).
    const isBufferTooShort = bufferWords < config.MIN_WORDS_PER_BLOCK;

    if (!mustBreak && (isBufferIncomplete || isBufferTooShort)) {
        // --- MERGE ---
        bufferBlock.endTime = nextBlock.endTime;
        
        // Handle text joining
        const bufferEndsWithHyphen = bufferBlock.originalText.trim().endsWith('-');
        const nextStartsWithHyphen = nextBlock.originalText.trim().startsWith('-');
        const isDialogList = bufferBlock.originalText.includes('\n-') || bufferBlock.originalText.startsWith('-');

        if (nextStartsWithHyphen || isDialogList) {
            // New line for dialogue
             bufferBlock.originalText = `${bufferBlock.originalText}\n${nextBlock.originalText}`;
        } else {
            // Standard sentence join
            bufferBlock.originalText = `${bufferBlock.originalText.trim()} ${nextBlock.originalText.trim()}`;
        }

    } else {
        // --- FINALIZE BUFFER & START NEW ---
        
        // Final sanity check on timing before pushing
        // Ensure minimum reading time for the finished block if it wasn't merged
        const minReadingTime = countWords(bufferBlock.originalText) * config.MS_PER_WORD;
        const currentDuration = timeToMs(bufferBlock.endTime) - timeToMs(bufferBlock.startTime);
        
        if (currentDuration < minReadingTime) {
            // Extend end time slightly if space allows (without overlapping next)
            const maxAllowedEnd = nextStartMs - config.STANDARD_GAP_MS;
            const targetEnd = timeToMs(bufferBlock.startTime) + minReadingTime;
            const finalEnd = Math.min(targetEnd, maxAllowedEnd);
            
            if (finalEnd > timeToMs(bufferBlock.startTime)) {
                bufferBlock.endTime = msToTime(finalEnd);
            }
        }

        optimized.push(bufferBlock);
        bufferBlock = { ...nextBlock };
    }
  }
  
  // Push the final leftover block
  optimized.push(bufferBlock);

  // Post-Processing: Ensure Gap Consistency
  for (let i = 0; i < optimized.length - 1; i++) {
     const b1 = optimized[i];
     const b2 = optimized[i+1];
     const end1 = timeToMs(b1.endTime);
     const start2 = timeToMs(b2.startTime);
     
     if (end1 >= start2 - config.STANDARD_GAP_MS) {
         const newEnd = start2 - config.STANDARD_GAP_MS;
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

/**
 * Post-Processing: Optimizes Persian text structure AFTER translation.
 * Merges blocks if Persian text is incomplete (ending in conjunctions) or visually unbalanced.
 */
export const optimizePersianStructure = (blocks: SubtitleBlock[]): SubtitleBlock[] => {
    if (blocks.length === 0) return [];
    
    const processed: SubtitleBlock[] = [];
    const MAX_GAP = 1200; // 1.2s max gap to consider merging for continuity
    const MAX_CHARS = 85; // Safety limit
    
    // Conjunctions that signal "More to come" in Persian
    const connectors = ['که', 'و', 'ولی', 'اما', 'اگر', 'چون', 'تا', 'پس'];
    
    let buffer = { ...blocks[0] };
    
    for (let i = 1; i < blocks.length; i++) {
        const next = blocks[i];
        
        // Get Texts
        const textA = buffer.translatedText || buffer.originalText || '';
        const textB = next.translatedText || next.originalText || '';
        
        // --- Analysis ---
        const gap = timeToMs(next.startTime) - timeToMs(buffer.endTime);
        const combinedLen = textA.length + textB.length + 1;
        
        // 1. Check for hanging connectors (e.g., "می‌دانم که")
        const endsWithConnector = connectors.some(c => textA.trim().endsWith(` ${c}`));
        
        // 2. Check for Sentence Incompleteness (No punctuation at end of A)
        const isIncomplete = !/[.?!؟!;]$/.test(textA.trim());
        
        // 3. Check for Dialogue Dash (Don't merge different speakers)
        const isDialogue = textA.startsWith('-') || textB.startsWith('-');
        
        const shouldMerge = !isDialogue && 
                            gap < MAX_GAP && 
                            combinedLen < MAX_CHARS &&
                            (endsWithConnector || (isIncomplete && gap < 500)); // Stricter gap check if just incomplete
        
        if (shouldMerge) {
            // Merge
            buffer.endTime = next.endTime;
            buffer.translatedText = `${textA.trim()} ${textB.trim()}`;
            // We also merge original text to keep data consistent, though translated is what matters here
            buffer.originalText = `${buffer.originalText} ${next.originalText}`; 
            
            // Re-balance the merged text if it has lines
            buffer.translatedText = formatPersianSubtitle(buffer.translatedText);
        } else {
            // Apply formatting to buffer before pushing
            if (buffer.translatedText) {
                buffer.translatedText = formatPersianSubtitle(buffer.translatedText);
            }
            processed.push(buffer);
            buffer = { ...next };
        }
    }
    
    // Process final buffer
    if (buffer.translatedText) {
        buffer.translatedText = formatPersianSubtitle(buffer.translatedText);
    }
    processed.push(buffer);

    // Re-index
    return processed.map((b, idx) => ({ ...b, id: idx + 1, index: idx + 1 }));
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

export const stringifyVTT = (blocks: SubtitleBlock[], styles?: StyleConfig): string => {
  let header = `WEBVTT\n\n`;
  const styleClass = 'styled';

  if (styles && styles.useStyles) {
    header += `STYLE\n::cue(.${styleClass}) {\n`;
    header += `  font-family: "${styles.fontFamily}";\n`;
    const sizePct = styles.fontSize ? Math.round((styles.fontSize / 18) * 100) : 100;
    header += `  font-size: ${sizePct}%;\n`;
    header += `  color: ${styles.primaryColor};\n`;
    
    // VTT Background color (Box)
    if (styles.borderStyle === 'box') {
        const hex = styles.backgroundColor;
        const opacity = styles.backgroundOpacity ?? 100;
        // hex to rgb
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        header += `  background-color: rgba(${r}, ${g}, ${b}, ${opacity / 100});\n`;
    } else {
        header += `  background-color: transparent;\n`;
    }
    
    if (styles.borderStyle === 'outline') {
         header += `  text-shadow: -1px -1px 0 ${styles.secondaryColor}, 1px -1px 0 ${styles.secondaryColor}, -1px 1px 0 ${styles.secondaryColor}, 1px 1px 0 ${styles.secondaryColor};\n`;
    }
    
    header += `  text-align: center;\n`;
    header += `}\n\n`;
  }

  const content = blocks.map(block => {
    const start = block.startTime.replace(',', '.');
    const end = block.endTime.replace(',', '.');
    
    let text = block.translatedText && block.translatedText.trim() !== '' 
      ? block.translatedText 
      : block.originalText;

    if (styles && styles.useStyles) {
       text = `<c.${styleClass}>${text}</c>`;
    }

    return `${start} --> ${end}\n${text}`;
  }).join('\n\n');

  return `${header}${content}`;
};

export const stringifyASS = (blocks: SubtitleBlock[], styles?: StyleConfig): string => {
  // Default values
  const font = styles?.fontFamily || 'Arial';
  const size = styles?.fontSize || 20;
  const primary = hexToAssColor(styles?.primaryColor || '#FFFFFF');
  const secondary = hexToAssColor(styles?.secondaryColor || '#000000'); // Outline/Shadow
  const opacity = styles?.backgroundOpacity !== undefined ? styles.backgroundOpacity : 100;
  const back = hexToAssColor(styles?.backgroundColor || '#000000', opacity); // Box color with Opacity
  const bold = styles?.isBold ? -1 : 0;
  const borderStyle = styles?.borderStyle === 'box' ? 3 : 1;
  const outline = styles?.outlineWidth || 2;
  const shadow = styles?.shadowDepth || 0;
  const align = styles?.alignment || 2;

  const header = `[Script Info]
Title: SubMaster Pro Generated
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${size},${primary},&H000000FF,${secondary},${back},${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},${align},10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const content = blocks.map(block => {
      const start = msToAssTime(timeToMs(block.startTime));
      const end = msToAssTime(timeToMs(block.endTime));
      
      let text = block.translatedText && block.translatedText.trim() !== '' 
      ? block.translatedText 
      : block.originalText;
      
      // Convert newlines to \N
      text = text.replace(/\n/g, '\\N');

      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + content;
};

export const generateSubtitleFile = (blocks: SubtitleBlock[], format: 'srt' | 'vtt' | 'ass', styles?: StyleConfig): string => {
  if (format === 'srt') {
    return stringifySRT(blocks);
  } else if (format === 'ass') {
    return stringifyASS(blocks, styles);
  } else {
    return stringifyVTT(blocks, styles);
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
          startMs -= msValue / 2;
          endMs += msValue / 2;
        }
        break;

      case 'percent':
        const multiplier = config.value / 100;
        const newDuration = duration * multiplier;
        endMs = startMs + newDuration;
        break;

      case 'fixed':
        const fixedDurationMs = config.value * 1000;
        endMs = startMs + fixedDurationMs;
        break;

      case 'recalculate':
        const charCount = countChars(textToUse);
        const idealDurationSec = charCount / (config.value || 20); 
        const idealDurationMs = idealDurationSec * 1000;
        const constrainedDuration = Math.max(833, idealDurationMs); 
        endMs = startMs + constrainedDuration;
        break;
    }

    if (endMs <= startMs) endMs = startMs + 833; 
    
    if (config.mode !== 'seconds' || config.target !== 'shift') {
       if (endMs > nextBlockStart - 84) { 
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

    const maxLineLength = Math.max(...lines.map(l => l.length));
    if (maxLineLength > 42) blockErrors.push('max_chars');

    if (lines.length > 2) blockErrors.push('max_lines');

    const cps = durationSec > 0 ? charCount / durationSec : 0;
    if (cps > 20) blockErrors.push('cps');

    if (durationSec < 0.833) blockErrors.push('min_duration');

    if (durationSec > 7) blockErrors.push('max_duration');

    if (idx < blocks.length - 1) {
      const nextStart = timeToMs(blocks[idx+1].startTime);
      const gap = nextStart - endMs;
      if (gap < 83 && gap > -500) { 
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

const smartSplitText = (text: string, maxLen: number = 42): string => {
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;

  const words = clean.split(' ');
  const targetSplit = clean.length / 2;
  
  let currentLen = 0;
  let splitIndex = 0;
  
  for (let i = 0; i < words.length; i++) {
    currentLen += words[i].length + 1; 
    if (currentLen >= targetSplit) {
       splitIndex = i;
       break;
    }
  }

  const p1 = words.slice(0, splitIndex + 1).join(' ');
  const p2 = words.slice(splitIndex + 1).join(' ');
  
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

export const fixNetflixStandards = (blocks: SubtitleBlock[]): SubtitleBlock[] => {
  let sorted = [...blocks].sort((a, b) => timeToMs(a.startTime) - timeToMs(b.startTime));
  sorted = JSON.parse(JSON.stringify(sorted));

  const CPS_LIMIT = 20; 
  const MIN_DURATION_MS = 833; 
  const MAX_DURATION_MS = 7000; 
  const MIN_GAP_MS = 84; 

  return sorted.map((block, idx) => {
    let text = block.translatedText || block.originalText || "";
    text = text.trim();
    const lines = text.split('\n');
    if (lines.length > 2 || lines.some((l: string) => l.length > 42)) {
      text = smartSplitText(text, 42);
      block.translatedText = text;
    }
    
    const charCount = countChars(text);
    let idealDurationMs = (charCount / CPS_LIMIT) * 1000;

    if (idealDurationMs < MIN_DURATION_MS) idealDurationMs = MIN_DURATION_MS;
    if (idealDurationMs > MAX_DURATION_MS) idealDurationMs = MAX_DURATION_MS;

    const startMs = timeToMs(block.startTime);
    let endMs = startMs + idealDurationMs;

    if (idx < sorted.length - 1) {
        const nextBlock = sorted[idx + 1];
        const nextStartMs = timeToMs(nextBlock.startTime);
        const maxAllowedEndMs = nextStartMs - MIN_GAP_MS;

        if (endMs > maxAllowedEndMs) {
            endMs = maxAllowedEndMs;
        }

        if (endMs <= startMs) {
            const emergencyGap = 20; 
            if (nextStartMs - startMs > emergencyGap) {
                endMs = nextStartMs - emergencyGap;
            } else {
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