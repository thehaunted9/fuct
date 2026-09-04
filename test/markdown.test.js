import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
globalThis.document = dom.window.document;

const { parseMarkdown, sanitizeHtml } = await import('../js/utils/markdown.js');

test('removes executable markup and event handlers', () => {
  const output = sanitizeHtml('<p onclick="steal()">Safe</p><img src=x onerror="steal()"><script>steal()</script>');
  assert.equal(output, '<p>Safe</p>steal()');
  assert.doesNotMatch(output, /onclick|onerror|<script|<img/i);
});

test('removes unsafe link protocols', () => {
  const output = sanitizeHtml('<a href="javascript:steal()" title="bad">Click</a>');
  assert.equal(output, '<a>Click</a>');
});

test('plain-text fallback escapes HTML before inserting line breaks', () => {
  const output = parseMarkdown('<img src=x onerror=steal()>\nNext');
  assert.equal(output, '<p>&lt;img src=x onerror=steal()&gt;<br>Next</p>');
});
