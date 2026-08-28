const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

const repoRoot = path.resolve(__dirname, '..');

Module._extensions['.ts'] = function(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  });
  return module._compile(outputText, filename);
};

const utils = require(path.join(repoRoot, 'src/services/subtitleUtils.ts'));
const constants = require(path.join(repoRoot, 'src/constants.ts'));

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('parseSRT and stringifySRT round-trip content', () => {
  const input = '1\n00:00:01,000 --> 00:00:03,000\nHello\nworld\n\n2\n00:00:04,000 --> 00:00:05,500\nSecond line';
  const blocks = utils.parseSRT(input);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].originalText, 'Hello\nworld');
  assert.equal(utils.stringifySRT(blocks), input);
});

test('parseVTT handles line endings and stringifyVTT preserves cues', () => {
  const input = 'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.500\r\nHello VTT\r\n\r\n00:00:03.000 --> 00:00:04.000\r\nNext cue';
  const blocks = utils.parseVTT(input);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].startTime, '00:00:01,000');
  const output = utils.stringifyVTT(blocks);
  assert.ok(output.startsWith('WEBVTT'));
  assert.ok(output.includes('00:00:01.000 --> 00:00:02.500'));
});

test('parseASS extracts dialogue text and stringifyASS converts timing format', () => {
  const input = '[Script Info]\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,{\\i1}Hello, world!{\\i0}';
  const blocks = utils.parseASS(input);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].originalText, 'Hello, world!');
  const output = utils.stringifyASS(blocks);
  assert.ok(output.includes('Dialogue: 0,0:00:01.00,0:00:02.50,Default,,0,0,0,,Hello, world!'));
});

test('adaptive translation settings favor local and flash providers', () => {
  assert.equal(constants.getAdaptiveBatchDelay('lm_studio', 'standard'), 0);
  assert.equal(constants.getAdaptiveBatchDelay('gemini', 'flash'), 800);
  assert.equal(constants.getAdaptiveTranslationBatchSize('gemini', 'flash', 'default'), 36);
  assert.equal(constants.getAdaptiveTranslationBatchSize('gemini', 'professional', 'default'), 14);
  assert.equal(constants.getAdaptiveTranslationBatchSize('lm_studio', 'standard', 'skeleton_str'), 24);
  assert.equal(constants.getAdaptiveTranslationBatchSize('gemini', 'standard', 'subtitle_translator'), 8);
  assert.equal(constants.getAdaptiveTranslationBatchSize('gtx', 'standard', 'subtitle_translator'), 6);
});

test('translation method prompts preserve meaning and distinguish transport contracts', () => {
  const paragraph = constants.getMethodTranslationInstruction('paragraph', 'fa');
  const standard = constants.getMethodTranslationInstruction('default', 'fa');
  const skeleton = constants.getMethodTranslationInstruction('skeleton_str', 'fa');
  const subtitleTranslator = constants.getMethodTranslationInstruction('subtitle_translator', 'fa');
  assert.match(paragraph, /never summarize, omit, or replace a full cue/i);
  assert.match(paragraph, /own marker/i);
  assert.match(standard, /JSON item/i);
  assert.match(skeleton, /requested tagged line/i);
  assert.match(subtitleTranslator, /rockbenben\/subtitle-translator/i);
  assert.match(subtitleTranslator, /professionally written native subtitles/i);
  assert.match(paragraph, /original source term in parentheses/i);
});

test('Skeleton STR system instruction does not request JSON output', () => {
  const skeletonInstruction = constants.getSystemInstruction('conversational', 'podcast', '', 'netflix', [], '', 'fa', 'skeleton_str');
  const standardInstruction = constants.getSystemInstruction('conversational', 'podcast', '', 'netflix', [], '', 'fa', 'default');
  const subtitleTranslatorInstruction = constants.getSystemInstruction('conversational', 'podcast', '', 'netflix', [], '', 'fa', 'subtitle_translator');
  assert.doesNotMatch(skeletonInstruction, /فرمت خروجی \(JSON Array\)/);
  assert.doesNotMatch(subtitleTranslatorInstruction, /فرمت خروجی \(JSON Array\)/);
  assert.match(standardInstruction, /فرمت خروجی \(JSON Array\)/);
});
