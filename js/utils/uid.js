/** Generate a short random ID with an optional prefix. */
export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
