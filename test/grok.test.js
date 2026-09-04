import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSSELine } from '../js/api/grok.js';

test('parses SSE tokens with or without a space after data', () => {
  const payload = JSON.stringify({ choices: [{ delta: { content: 'hello' } }] });
  assert.equal(parseSSELine(`data: ${payload}`).token, 'hello');
  assert.equal(parseSSELine(`data:${payload}`).token, 'hello');
});

test('recognizes the streaming completion marker', () => {
  assert.deepEqual(parseSSELine('data: [DONE]'), { done: true, token: '' });
});

test('ignores malformed SSE data without throwing', () => {
  assert.deepEqual(parseSSELine('data: {nope'), { done: false, token: '' });
});
