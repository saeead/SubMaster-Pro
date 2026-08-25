/** Skeleton STR phases 1 and 2. This module intentionally owns its parsing and
 * marker protocol so existing translation methods remain untouched. */
export type SkeletonFileType = 'srt' | 'vtt' | 'sbv' | 'lrc' | 'ass';
export interface SkeletonSplit { fileType: SkeletonFileType; originalLines: string[]; contentLines: string[]; contentIndices: number[]; assContentStartIndex: number; }
export interface AssPrepared { cleanLine: string; leadingTags: string; breaks: string[]; verbatim?: string; }

const TIMECODE = /^(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}[ \t]+-->[ \t]+(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}/;
const SBV = /^\d+:\d{2}:\d{2}\.\d{1,3},\d+:\d{2}:\d{2}\.\d{1,3}$/;
const LRC = /^\[\d{2}:\d{2}(?:\.\d{2,3})?\]/;
const invisible = /[\s\u200B\u200C\u200D\u2060\uFEFF]/g;
export const isBlankTarget = (value: string) => value.replace(invisible, '') === '';

export const detectSkeletonFileType = (text: string): SkeletonFileType => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sample = lines.filter(line => line.trim()).slice(0, 50);
  if (sample[0]?.trim() === 'WEBVTT') return 'vtt';
  const arrows = sample.filter(line => TIMECODE.test(line.trim())).length;
  const sbv = sample.filter(line => SBV.test(line.trim())).length;
  const ass = sample.filter(line => /^Dialogue:\s*[^,]+,\s*[^,]+,\s*[^,]+,/i.test(line) || /^\[Script Info\]$/i.test(line.trim())).length;
  if (ass > arrows && ass > sbv && ass > 0) return 'ass';
  if (arrows) return 'srt';
  if (!arrows && !sbv && sample.some(line => LRC.test(line.trim()))) return 'lrc';
  if (sbv) return 'sbv';
  throw new Error('Unsupported subtitle format: no recognizable subtitle content was found.');
};

const isCueNumber = (lines: string[], index: number, lastSequence: number): boolean => {
  if (!/^\d+$/.test(lines[index].trim()) || !TIMECODE.test((lines[index + 1] || '').trim())) return false;
  const previousBlank = index === 0 || lines[index - 1].trim() === '';
  return previousBlank || Number(lines[index].trim()) === lastSequence + 1;
};

export const filterSubLines = (originalLines: string[], fileType: SkeletonFileType): Omit<SkeletonSplit, 'fileType'> => {
  const contentLines: string[] = [], contentIndices: number[] = [];
  const push = (line: string, index: number) => { if (!isBlankTarget(line)) { contentLines.push(line); contentIndices.push(index); } };
  if (fileType === 'ass') {
    let inEvents = false, start = 9;
    for (const line of originalLines) { if (/^\[Events\]$/i.test(line.trim())) inEvents = true; if (inEvents && /^Format:/i.test(line.trim())) { start = Math.max(0, line.slice(line.indexOf(':') + 1).split(',').length - 1); break; } }
    if (start === 9) { const commas = originalLines.filter(line => /^Dialogue:/i.test(line)).slice(0, 100).map(line => (line.match(/,/g) || []).length); if (commas.length) start = Math.min(...commas); }
    originalLines.forEach((line, index) => { if (/^Dialogue:/i.test(line.trim())) { const body = line.slice(line.indexOf(':') + 1); const text = body.split(',').slice(start).join(','); if (!isBlankTarget(text)) { contentLines.push(text); contentIndices.push(index); } } });
    return { originalLines, contentLines, contentIndices, assContentStartIndex: start };
  }
  if (fileType === 'lrc') { originalLines.forEach((line, index) => { const lyric = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').replace(/<\d{2}:\d{2}(?:\.\d{2,3})?>/g, ''); if (!isBlankTarget(lyric)) { contentLines.push(lyric); contentIndices.push(index); } }); return { originalLines, contentLines, contentIndices, assContentStartIndex: 9 }; }
  let started = false, lastSequence = 0, skippingVttBlock = false;
  originalLines.forEach((line, index) => {
    const trimmed = line.trim(); const boundary = index === 0 || originalLines[index - 1].trim() === '';
    if (fileType === 'vtt') {
      if (boundary && /^(NOTE|STYLE|REGION)(?:\s|$)/.test(trimmed)) skippingVttBlock = true;
      if (skippingVttBlock && TIMECODE.test(trimmed)) skippingVttBlock = false;
      if (skippingVttBlock || trimmed === 'WEBVTT' || /^X-TIMESTAMP-MAP/i.test(trimmed)) return;
      if (TIMECODE.test(trimmed)) { started = true; return; }
      if (started && trimmed && TIMECODE.test((originalLines[index + 1] || '').trim()) && boundary) return;
    } else if (fileType === 'sbv') { if (SBV.test(trimmed)) { started = true; return; } }
    else { if (isCueNumber(originalLines, index, lastSequence)) { lastSequence = Number(trimmed); return; } if (TIMECODE.test(trimmed)) { started = true; return; } }
    if (started && trimmed && !(fileType === 'sbv' && SBV.test(trimmed))) push(fileType === 'vtt' ? line.replace(/<\/?c\b[^>]*>/gi, '').replace(/<\d+:\d{2}:\d{2}\.\d{1,3}>/g, '') : line, index);
  });
  return { originalLines, contentLines, contentIndices, assContentStartIndex: 9 };
};

export const splitSkeleton = (text: string): SkeletonSplit => { const originalLines = text.replace(/\r\n?/g, '\n').split('\n'); const fileType = detectSkeletonFileType(text); return { fileType, ...filterSubLines(originalLines, fileType) }; };

export const prepareAssForTranslation = (line: string): AssPrepared => {
  if (/\{\\p[1-9]\}/i.test(line)) return { cleanLine: '', leadingTags: '', breaks: [], verbatim: line };
  const leading = line.match(/^(?:\{[^}]*\})+/)?.[0] || ''; const breaks: string[] = [];
  let clean = line.slice(leading.length).replace(/(?:\{[^}]*\})*\\[Nn](?:\{[^}]*\})*/g, match => `###${breaks.push(match) - 1}###`).replace(/\{[^}]*\}/g, '');
  if (!clean.replace(/###\d+###/g, '').match(/\p{L}/u)) return { cleanLine: '', leadingTags: '', breaks: [], verbatim: line };
  return { cleanLine: clean, leadingTags: leading, breaks };
};
export const restoreAssAfterTranslation = (translation: string, prepared: AssPrepared): string => {
  if (prepared.verbatim !== undefined) return prepared.verbatim;
  let output = translation.replace(/[\r\n]+/g, '\\N');
  prepared.breaks.forEach((value, index) => { const exact = new RegExp(`###${index}###`, 'g'); const loose = new RegExp(`#\{1,3} ?${index} ?#\{1,3}`, 'g'); output = output.replace(exact, value).replace(loose, value); });
  return prepared.leadingTags + output.replace(/#{1,3} ?\d+ ?#{1,3}/g, '');
};

export const buildContextPayload = (lines: string[], start: number, end: number, window = 20): string => { const padding = Math.min(50, Math.max(1, Math.floor(window / 2))); return lines.slice(Math.max(0, start - padding), Math.min(lines.length, end + padding)).map((line, relative) => { const absolute = Math.max(0, start - padding) + relative; return absolute >= start && absolute < end ? `[TRANSLATE_${absolute - start}]${line}[/TRANSLATE_${absolute - start}]` : `[CONTEXT]${line}[/CONTEXT]`; }).join('\n'); };
export const SKELETON_STR_SYSTEM_PROMPT = 'You are a professional subtitle translator. Respond only with the tagged lines. Do not add explanations, comments, markdown fences, or any extra text.';
export const buildSkeletonUserPrompt = (content: string, count: number): string => `Context: This is part of a subtitle file. Only translate the lines marked with [TRANSLATE_X][/TRANSLATE_X] tags. Use [CONTEXT][/CONTEXT] lines only for understanding.\n\nCRITICAL REQUIREMENTS:\n1. You MUST translate ALL ${count} lines marked with [TRANSLATE_X] tags\n2. Do NOT skip any numbers from 0 to ${count - 1}\n3. Keep the exact format: [TRANSLATE_X]translation[/TRANSLATE_X]\n4. NEVER merge lines; retain one tag per source line.\n\n${content}`;

export const extractTranslatedLinesWithNumbers = (response: string, expectedCount: number, sourceLines: string[], contextLines: string[]): string[] => {
  const output = Array<string>(expectedCount).fill(''); const pattern = /\[TRANSLATE_(\d+)\]([\s\S]*?)\[\/(?:TRANSLATE|TRANSLTranslate)_\1\]/g; let match: RegExpExecArray | null; let hasOverflow = false;
  while ((match = pattern.exec(response))) { const id = Number(match[1]); if (id === expectedCount) hasOverflow = true; if (id >= 0 && id < expectedCount && output[id] === '') output[id] = match[2].replace(/\[\/?(?:TRANSLATE(?:_\d+)?|TRANSLTranslate_\d+|CONTEXT)\]/g, '').trim(); }
  if (expectedCount > 1 && hasOverflow && output[0] === '') return Array(expectedCount).fill('');
  for (let i = 0; i < expectedCount; i++) if (!output[i] && !isBlankTarget(sourceLines[i] || '')) for (let previous = i - 1; previous >= 0; previous--) { if (!isBlankTarget(sourceLines[previous] || '')) { output[previous] = ''; break; } }
  return output.map((value, index) => value && contextLines.some((context, contextIndex) => contextIndex !== index && context === value) ? '' : value);
};
