/**
 * Thin wrapper around marked.js with story-specific configuration.
 * marked.js is loaded as a global via lib/marked.min.js in index.html.
 */

let _marked = null;

function getMarked() {
  if (_marked) return _marked;
  if (typeof marked === 'undefined') {
    // Fallback: return plain text renderer
    return { parse: text => `<p>${text.replace(/\n/g, '<br>')}</p>` };
  }
  marked.setOptions({
    breaks: true,       // single newlines become <br>
    gfm: true,          // GitHub-flavored markdown
    mangle: false,
    headerIds: false,
  });
  _marked = marked;
  return _marked;
}

/**
 * Parse a markdown string into safe HTML for story display.
 * @param {string} text
 * @returns {string} HTML
 */
export function parseMarkdown(text) {
  if (!text) return '';
  return getMarked().parse(text);
}

/**
 * Sanitize raw text for safe insertion (no markdown parsing).
 * Escapes HTML entities only.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
