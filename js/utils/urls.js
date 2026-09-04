/** Return a media URL only when it uses an explicitly supported scheme. */
export function safeMediaUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';

  // Relative paths are safe and useful when the project is served locally.
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:'
      ? url
      : '';
  } catch (_) {
    return '';
  }
}
