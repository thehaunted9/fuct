import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('generated bundle boots without browser runtime errors', async () => {
  const html = await readFile(path.join(root, 'bundle.html'), 'utf8');
  const runtimeErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => runtimeErrors.push(error));

  const dom = new JSDOM(html, {
    url: 'https://example.test/bundle.html',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.structuredClone = globalThis.structuredClone;
    }
  });

  await new Promise(resolve => dom.window.setTimeout(resolve, 25));

  assert.equal(runtimeErrors.length, 0, runtimeErrors.map(error => error.message).join('\n'));
  assert.ok(dom.window.document.getElementById('app'));
  assert.equal(dom.window.document.getElementById('welcome-screen')?.classList.contains('hidden'), false);
  dom.window.close();
});
