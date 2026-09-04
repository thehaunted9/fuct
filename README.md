# Story Builder

A browser-based interactive story builder with branching narratives, parallel arcs, character and world management, Grok streaming, IndexedDB persistence, JSON sharing, and browser text-to-speech.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm start
```

Open `http://localhost:4173`. Windows users can run `start.bat` for the same setup. The generated `bundle.html` is a standalone alternative that can be opened directly; do not edit it by hand.

## Development

The modular application in `index.html`, `js/`, and `style/` is the source of truth.

```bash
npm test
npm run check:syntax
npm run build
npm run verify:bundle
```

`npm run check` performs all of those validations. CI also regenerates `bundle.html` and fails if the committed bundle is stale.

## Persistence and imports

Stories are stored locally in IndexedDB. Exports use the versioned `StoryBundle` JSON schema. Imports are limited to 5 MB, validated before state hydration, assigned a new story ID to prevent accidental overwrites, and rejected if graph references, media URLs, or collection shapes are unsafe.

## Security

- Rendered Markdown is sanitized with a small HTML allow-list before reaching the DOM.
- Imported story IDs and graph relationships are validated.
- Media URLs allow only HTTP(S), blob URLs, or relative paths.
- The Grok API key is session-only by default. Persisting it requires selecting “Remember the API key on this device.”
- `index.html` uses a restrictive Content Security Policy. The generated standalone bundle permits its own inline scripts because all application code is intentionally embedded in that file.

Do not use a remembered API key on a shared device. API calls are sent directly from the browser to xAI and require a compatible xAI account and model.

## Manual release checks

Automated tests mock or isolate persistence and streaming parsing. Before release, test a real Grok request with a non-production key and verify Chrome, Firefox, and Safari behavior for streaming, cancellation, IndexedDB reload, dialogs, and text-to-speech.
