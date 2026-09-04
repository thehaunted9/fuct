/**
 * Thin wrapper around marked.js with story-specific configuration.
 * marked.js is loaded as a global via lib/marked.min.js in index.html.
 */

let _marked = null;

function getMarked() {
  if (_marked) return _marked;
  if (typeof marked === 'undefined') {
    // Fallback: return plain text renderer
    return { parse: text => `<p>${escapeHtml(String(text)).replace(/\n/g, '<br>')}</p>` };
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
  return sanitizeHtml(getMarked().parse(String(text)));
}

const ALLOWED_TAGS = new Set([
  'A', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'EM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HR', 'LI', 'OL', 'P', 'PRE', 'STRONG', 'UL'
]);

/**
 * Sanitize rendered Markdown using a deliberately small allow-list.
 * Raw HTML, event handlers, styles, and unsafe URL protocols are removed.
 */
export function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');

  const elements = [...template.content.querySelectorAll('*')];
  for (const element of elements) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      continue;
    }

    const href = element.tagName === 'A' ? element.getAttribute('href') : null;
    const title = element.tagName === 'A' ? element.getAttribute('title') : null;
    [...element.attributes].forEach(attribute => element.removeAttribute(attribute.name));

    if (element.tagName === 'A' && href && isSafeLink(href)) {
      element.setAttribute('href', href);
      if (title) element.setAttribute('title', title);
      element.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  }

  return template.innerHTML;
}

export function isSafeLink(value) {
  const href = String(value ?? '').trim();
  if (!href) return false;
  if (href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return true;
  }

  try {
    const protocol = new URL(href, document.baseURI).protocol;
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch (_) {
    return false;
  }
}

/**
 * Sanitize raw text for safe insertion (no markdown parsing).
 * Escapes HTML entities only.
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
