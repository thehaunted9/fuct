/**
 * Grok API client — OpenAI-compatible streaming.
 * Streams Server-Sent Events from https://api.x.ai/v1/chat/completions
 * and yields text tokens one by one.
 */

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

/**
 * Stream a Grok chat completion, yielding text tokens as they arrive.
 *
 * @param {object} params
 * @param {string} params.apiKey
 * @param {string} params.model            e.g. 'grok-3'
 * @param {string} params.systemPrompt
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {number} [params.maxTokens]      Default 2048
 * @param {AbortSignal} [params.signal]    For cancellation
 * @yields {string} Text tokens
 * @throws {Error} On API errors or non-2xx HTTP
 */
export async function* streamGrok({ apiKey, model, systemPrompt, messages, maxTokens = 2048, signal }) {
  const body = {
    model: model ?? 'grok-4',
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ]
  };

  const res = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    let errMsg = `Grok API error: ${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      errMsg += ` — ${errBody.error?.message ?? JSON.stringify(errBody)}`;
    } catch (_) { /* ignore */ }
    throw new Error(errMsg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete last line for next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6); // Remove "data: " prefix
      if (data === '[DONE]') return;

      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch (_) {
        // Malformed SSE chunk — skip
      }
    }
  }
}

/**
 * Non-streaming single call — for short tasks like "Test Connection".
 * @param {object} params  Same as streamGrok but no `signal`
 * @returns {Promise<string>} Full response text
 */
export async function callGrok({ apiKey, model, systemPrompt, messages, maxTokens = 256 }) {
  const res = await fetch(GROK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model ?? 'grok-4',
      max_tokens: maxTokens,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ]
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Grok API error: ${res.status} — ${errBody.error?.message ?? res.statusText}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}
