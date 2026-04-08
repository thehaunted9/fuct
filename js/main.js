/**
 * main.js — Application entry point.
 * Initializes all modules and wires up the story generation engine.
 */

// ── State ────────────────────────────────────────────────────────────────────
import store from './state/store.js';
import { getSession, setStreaming, setStoryId, setInitialized } from './state/session.js';
import { appendNode, initTree, getTree, finalizeNodeText, getHistoryMessages, createArc } from './state/story-tree.js';
import { getActiveCharacter, getAllCharacters } from './state/characters.js';
import { getWorld, getActiveLocation, setActiveLocation } from './state/world.js';

// ── Persistence ───────────────────────────────────────────────────────────────
import { triggerAutosave, loadStoryIntoStore } from './persistence/autosave.js';
import { listStories } from './persistence/db.js';

// ── API ───────────────────────────────────────────────────────────────────────
import { streamGrok } from './api/grok.js';
import { buildSystemPrompt, buildMessages, buildOpeningPrompt, buildTransitionPrompt, buildArcPrompt } from './api/prompts.js';

// ── UI ────────────────────────────────────────────────────────────────────────
import { initAppShell } from './ui/app-shell.js';
import { initStoryPanel } from './ui/story-panel.js';
import { initInputPanel } from './ui/input-panel.js';
import { initSidebarLeft } from './ui/sidebar-left.js';
import { initSidebarRight } from './ui/sidebar-right.js';
import { initSettingsModal } from './ui/settings-modal.js';
import { initWizard } from './ui/wizard.js';
import { initCharacterEditor } from './ui/character-editor.js';
import { initWorldEditor } from './ui/world-editor.js';
import { initTimelineViewer } from './ui/timeline-viewer.js';
import { initMediaPanel } from './ui/media-panel.js';
import bus from './utils/events.js';
import { uid } from './utils/uid.js';

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // Initialize all UI modules
  initAppShell();
  initStoryPanel();
  initInputPanel();
  initSidebarLeft();
  initSidebarRight();
  initSettingsModal();
  initWizard();
  initCharacterEditor();
  initWorldEditor();
  initTimelineViewer();
  initMediaPanel();

  // Wire story generation events
  bus.on('story:generate', _onGenerate);
  bus.on('story:begin', _onStoryBegin);
  bus.on('story:transition', _onTransition);
  bus.on('story:load', ({ storyId }) => _loadStory(storyId));

  // Keyboard shortcuts (global)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('dialog[open]').forEach(d => d.close());
    }
  });

  // Check for existing stories
  const session = getSession();
  if (!session.apiKey) {
    // First time — show settings prompt
    _showWelcome();
  } else {
    // Try to restore the most recent story
    await _tryRestoreLastStory();
  }
}

// ── Story Generation ─────────────────────────────────────────────────────────

async function _onGenerate({ userInput, mode }) {
  const session = getSession();
  if (session.isStreaming) return;
  if (!session.apiKey) {
    bus.emit('toast', { message: 'Add your Grok API key in Settings (⚙).', type: 'error' });
    return;
  }

  const tree = getTree();
  if (!tree?.rootId) {
    bus.emit('toast', { message: 'Start a new story first.', type: 'error' });
    return;
  }

  const world = getWorld();
  const location = getActiveLocation();
  const char = getActiveCharacter();
  const allChars = Object.values(getAllCharacters());
  const historyMessages = getHistoryMessages(tree.activeNodeId, 15);

  const systemPrompt = buildSystemPrompt({ world, location, activeChar: char, allChars, mode });
  const messages = buildMessages({ historyMessages, userInput, mode, activeChar: char });

  await _stream({
    systemPrompt,
    messages,
    userInput,
    mode,
    actorName: char?.name ?? 'Player',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: world?.activeLocationId ?? null,
      activeArcId: tree.activeArcId
    }
  });
}

async function _onStoryBegin({ initialConflict }) {
  const session = getSession();
  if (!session.apiKey) {
    bus.emit('toast', { message: 'Set your Grok API key in Settings before starting.', type: 'error' });
    bus.emit('settings:open');
    return;
  }

  const world = getWorld();
  const location = getActiveLocation();
  const char = getActiveCharacter();

  // Initialize the story tree
  const storyId = uid('story');
  setStoryId(storyId);
  initTree({
    narrativeText: '',
    locationId: world?.activeLocationId ?? null,
    activeCharacterId: char?.id ?? null
  });

  setInitialized(true);

  const { systemPrompt, messages } = buildOpeningPrompt({
    world,
    location,
    activeChar: char,
    initialConflict
  });

  await _stream({
    systemPrompt,
    messages,
    userInput: '',
    mode: 'narrator',
    actorName: 'Narrator',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: world?.activeLocationId ?? null,
      activeArcId: 'arc_main'
    },
    isOpening: true
  });

  bus.emit('sidebar:refresh');
}

async function _onTransition({ fromLocationName, toLocation }) {
  const session = getSession();
  if (!session.apiKey || !toLocation) return;

  const world = getWorld();
  const char = getActiveCharacter();

  const { systemPrompt, messages } = buildTransitionPrompt({
    fromLocationName,
    toLocation,
    world,
    activeChar: char
  });

  await _stream({
    systemPrompt,
    messages,
    userInput: `[Travel to ${toLocation.name}]`,
    mode: 'narrator',
    actorName: 'Narrator',
    sessionSnapshot: {
      activeCharacterId: char?.id ?? null,
      locationId: toLocation.id,
      activeArcId: getTree()?.activeArcId ?? 'arc_main'
    }
  });

  bus.emit('sidebar:refresh');
}

// ── Core Streaming Engine ─────────────────────────────────────────────────────

async function _stream({ systemPrompt, messages, userInput, mode, actorName, sessionSnapshot, isOpening = false }) {
  const session = getSession();
  const abortController = new AbortController();
  setStreaming(true, abortController);

  bus.emit('stream:start', { userInput, mode, actorName });

  let fullText = '';
  let nodeId = null;

  try {
    const gen = streamGrok({
      apiKey: session.apiKey,
      model: session.model ?? 'grok-3',
      systemPrompt,
      messages,
      maxTokens: 1024,
      signal: abortController.signal
    });

    for await (const token of gen) {
      fullText += token;
      bus.emit('stream:token', { text: token });
    }

    // Persist the completed node
    if (isOpening) {
      // Update root node text
      const tree = getTree();
      if (tree?.rootId) {
        finalizeNodeText(tree.rootId, fullText, fullText);
      }
    } else {
      nodeId = appendNode({
        userInput,
        narrativeText: fullText,
        deltaText: fullText,
        actorId: mode === 'narrator' ? 'narrator' : (sessionSnapshot?.activeCharacterId ?? 'narrator'),
        sessionSnapshot
      });
    }

    bus.emit('stream:end');
    triggerAutosave();

  } catch (err) {
    if (err.name === 'AbortError') {
      // User cancelled — still save what we have
      if (fullText && !isOpening) {
        appendNode({
          userInput,
          narrativeText: fullText,
          deltaText: fullText,
          actorId: mode === 'narrator' ? 'narrator' : (sessionSnapshot?.activeCharacterId ?? 'narrator'),
          sessionSnapshot
        });
      }
      bus.emit('stream:end');
    } else {
      bus.emit('stream:error', { message: err.message });
      bus.emit('toast', { message: `Generation error: ${err.message}`, type: 'error' });
    }
  } finally {
    setStreaming(false, null);
  }
}

// ── Story Load / Restore ──────────────────────────────────────────────────────

async function _loadStory(storyId) {
  try {
    await loadStoryIntoStore(storyId);
    setInitialized(true);
    bus.emit('story:loaded');
    bus.emit('sidebar:refresh');
    bus.emit('toast', { message: 'Story loaded.', type: 'success' });
  } catch (err) {
    bus.emit('toast', { message: `Failed to load story: ${err.message}`, type: 'error' });
  }
}

async function _tryRestoreLastStory() {
  try {
    const stories = await listStories();
    if (stories.length > 0) {
      await _loadStory(stories[0].id);
    } else {
      _showWelcome();
    }
  } catch (_) {
    _showWelcome();
  }
}

function _showWelcome() {
  // Show the welcome screen (visible by default, hidden once story starts)
  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.classList.remove('hidden');
}

// ── Start ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot);
