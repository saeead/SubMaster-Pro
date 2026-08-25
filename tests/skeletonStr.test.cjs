const assert = require('node:assert/strict');
const path = require('node:path');
const skeleton = require(path.join(__dirname, '..', 'src/services/methods/skeleton_str/index.ts'));
function test(name, fn) { try { fn(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; } }

test('SRT skeleton keeps timestamps and compact cue numbers out of content', () => {
  const input = '1\n00:00:01,000 --> 00:00:02,000\nHello\n2\n00:00:03,000 --> 00:00:04,000\n3';
  const split = skeleton.splitSkeleton(input);
  assert.equal(split.fileType, 'srt'); assert.deepEqual(split.contentLines, ['Hello', '3']); assert.deepEqual(split.contentIndices, [2, 5]);
});
test('VTT blocks and cue identifiers never enter dialogue while NOTE dialogue does', () => {
  const input = 'WEBVTT\n\nNOTE note\nsecret\n\nSTYLE\n::cue {}\n\ncue-id\n00:00:01.000 --> 00:00:02.000\nNOTE spoken';
  const split = skeleton.splitSkeleton(input); assert.deepEqual(split.contentLines, ['NOTE spoken']);
});
test('ASS tags round-trip and drawings are never translation targets', () => {
  const prepared = skeleton.prepareAssForTranslation('{\\an8}Hello{\\i1}\\N{\\i0}world');
  assert.equal(prepared.cleanLine, 'Hello###0###world');
  assert.equal(skeleton.restoreAssAfterTranslation('سلام###0###دنیا', prepared), '{\\an8}سلام{\\i1}\\N{\\i0}دنیا');
  assert.equal(skeleton.prepareAssForTranslation('{\\p1}m 0 0 l 1 1').verbatim, '{\\p1}m 0 0 l 1 1');
});
test('marker extraction rejects 1-based numbering and merge responses', () => {
  assert.deepEqual(skeleton.extractTranslatedLinesWithNumbers('[TRANSLATE_1]a[/TRANSLATE_1][TRANSLATE_2]b[/TRANSLATE_2]', 2, ['one', 'two'], []), ['', '']);
  assert.deepEqual(skeleton.extractTranslatedLinesWithNumbers('[TRANSLATE_0]both[/TRANSLATE_0][TRANSLATE_1][/TRANSLATE_1]', 2, ['one', 'two'], []), ['', '']);
});
test('echoing context is rejected, while an identical own source is allowed', () => {
  assert.deepEqual(skeleton.extractTranslatedLinesWithNumbers('[TRANSLATE_0]next[/TRANSLATE_0]', 1, ['self'], ['self', 'next']), ['']);
  assert.deepEqual(skeleton.extractTranslatedLinesWithNumbers('[TRANSLATE_0]Tokyo[/TRANSLATE_0]', 1, ['Tokyo'], ['Tokyo']), ['Tokyo']);
});
test('LRC keeps multiple timestamps and skips instrumental anchors', () => {
  const split = skeleton.splitSkeleton('[00:01.00][00:02.00]Hello\n[00:03.00]'); assert.equal(split.fileType, 'lrc'); assert.deepEqual(split.contentLines, ['Hello']);
});
test('ASS vote tie does not hijack SRT dialogue', () => { assert.equal(skeleton.detectSkeletonFileType('1\n00:00:01,000 --> 00:00:02,000\nDialogue: hello\n[Script Info]'), 'srt'); });
